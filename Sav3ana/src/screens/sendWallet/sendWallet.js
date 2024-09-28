import { SOLANA_RPC } from '@env';
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import { ethers } from 'ethers';
import React, { Component, Fragment } from 'react';
import {
  Dimensions,
  Keyboard,
  NativeEventEmitter,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import RNPickerSelect from 'react-native-picker-select';
import IconIonIcons from 'react-native-vector-icons/Ionicons';
import Header from '../../components/header';
import GlobalStyles, { secondaryColor } from '../../styles/styles';
import { blockchain } from '../../utils/constants';
import ContextModule from '../../utils/contextModule';
import {
  balancedSaving,
  percentageSaving
} from '../../utils/utils';
import Cam from './components/cam';
import KeyboardAwareScrollViewComponent from './components/keyboardAvoid';

function setTokens(array) {
  return array.map((item, index) => {
    return {
      ...item,
      index,
      value: index.toString(),
      label: item.name,
      key: item.symbol,
    };
  });
}

const SendWalletBaseState = {
  // Transaction settings
  toAddress: [''], // ""
  amount: [''], //
  tokenSelected: [setTokens(blockchain.tokens)[0]], // ""
  transaction: [{}],
  scannerSelector: 0,
  // Status
  stage: 0,
  check: 'Check',
  errorText: '',
  loading: false,
};

class SendWallet extends Component {
  constructor(props) {
    super(props);
    this.state = SendWalletBaseState;
    this.provider = new Connection(SOLANA_RPC, 'confirmed');
    this.EventEmitter = new NativeEventEmitter();
  }

  static contextType = ContextModule;

  async componentDidMount() {
    console.log(this.context.value.publicKey);
    this.props.navigation.addListener('focus', async () => {
      console.log(this.props.route.name);
      this.EventEmitter.addListener('refresh', async () => {
        this.setState(SendWalletBaseState);
        Keyboard.dismiss();
      });
    });
    this.props.navigation.addListener('blur', async () => {
      this.setState(SendWalletBaseState);
      this.EventEmitter.removeAllListeners('refresh');
    });
  }

  async checkExist(account) {
    try {
      await getAccount(this.provider, account, 'confirmed', TOKEN_PROGRAM_ID);
      return true;
    } catch (error) {
      return false;
    }
  }

  async processInstruction(data) {
    let instructions = [];
    if (data.token.key === 'SOL') {
      const balance = await this.provider.getBalance(new PublicKey(data.to));
      if (
        balance < data.rentExemptionAmount &&
        data.amount < data.rentExemptionAmount
      ) {
        instructions.push(
          SystemProgram.transfer({
            fromPubkey: new PublicKey(this.context.value.publicKey),
            toPubkey: new PublicKey(data.to),
            lamports: data.rentExemptionAmount,
          }),
        );
      } else {
        instructions.push(
          SystemProgram.transfer({
            fromPubkey: new PublicKey(this.context.value.publicKey),
            toPubkey: new PublicKey(data.to),
            lamports: data.amount,
          }),
        );
      }
    } else {
      const tokenAccountFrom = getAssociatedTokenAddressSync(
        new PublicKey(data.token.address),
        new PublicKey(this.context.value.publicKey),
      );
      const tokenAccountTo = getAssociatedTokenAddressSync(
        new PublicKey(data.token.address),
        new PublicKey(data.to),
        true,
      );
      const exist = await this.checkExist(tokenAccountTo);
      if (!exist) {
        instructions.push(
          createAssociatedTokenAccountInstruction(
            new PublicKey(this.context.value.publicKey),
            tokenAccountTo,
            new PublicKey(data.to),
            new PublicKey(data.token.address),
            TOKEN_PROGRAM_ID,
          ),
        );
      }
      instructions.push(
        createTransferInstruction(
          tokenAccountFrom,
          tokenAccountTo,
          new PublicKey(this.context.value.publicKey),
          data.amount,
        ),
      );
    }
    return instructions;
  }

  async bulkTransfer() {
    const rentExemptionAmount =
      await this.provider.getMinimumBalanceForRentExemption(0);
    let preProcessedInstructions = this.state.transaction.map((_, index) => {
      return {
        to: this.state.toAddress[index],
        amount: ethers.utils
          .parseUnits(
            this.state.amount[index],
            this.state.tokenSelected[index].decimals,
          )
          .toBigInt(),
        amountFormatted: this.state.amount[index],
        token: this.state.tokenSelected[index],
        rentExemptionAmount,
      };
    });
    let amount = preProcessedInstructions.reduce(
      (acc, item) =>
        acc +
        (item.amountFormatted *
          this.context.value.usdConversion[item.token.index]) /
          this.context.value.usdConversion[0],
      0,
    );
    if (this.context.value.savingsFlag) {
      const savingsAmount =
        this.context.value.protocolSelected === 1
          ? balancedSaving(amount, this.context.value.usdConversion[0])
          : percentageSaving(amount, this.context.value.percentage);
      console.log(savingsAmount);
      preProcessedInstructions.push({
        to: this.context.value.publicKeySavings,
        amount: ethers.utils.parseUnits(savingsAmount.toFixed(9), 9).toBigInt(),
        amountFormatted: savingsAmount.toFixed(9),
        token: this.state.tokenSelected[0],
        rentExemptionAmount,
      });
      amount = amount + savingsAmount;
    }
    const labelBulk = preProcessedInstructions.map(_ => 'Transfer');
    const amountBulk = preProcessedInstructions.map(
      item => item.amountFormatted,
    );
    console.log(amountBulk);
    const tokenSymbolBulk = preProcessedInstructions.map(
      item => item.token.symbol,
    );
    const toBulk = preProcessedInstructions.map(item => item.to);
    const transactions = await Promise.all(
      preProcessedInstructions.map(instruction =>
        this.processInstruction(instruction),
      ),
    );
    const transaction = new Transaction();
    transactions.flat().map(item => {
      transaction.add(item);
    });
    let flag = false;
    if (this.context.value.savingsFlag && transactions.flat().length > 2) {
      flag = true;
    } else if (
      !this.context.value.savingsFlag &&
      transactions.flat().length > 1
    ) {
      flag = true;
    }
    this.context.setValue({
      isTransactionActive: true,
      transactionData: {
        ...this.context.value.transactionData,
        // Wallet Selection
        walletSelector: 0,
        // Commands
        command: 'transfer',
        // Transaction
        transaction,
        // Simple Display
        label: 'Bulk Transfer',
        to: 'Multiple Addresses',
        amount,
        tokenSymbol:
          // Bulk Display
          labelBulk,
        toBulk,
        amountBulk,
        tokenSymbolBulk,
      },
    });
    await this.setStateAsync({loading: false});
  }

  // Utils

  async setStateAsync(value) {
    return new Promise(resolve => {
      this.setState(
        {
          ...value,
        },
        () => resolve(),
      );
    });
  }

  render() {
    return (
      <SafeAreaView style={GlobalStyles.container}>
        <Header />
        {this.state.stage === 0 && (
          <KeyboardAwareScrollViewComponent>
            <SafeAreaView style={GlobalStyles.mainFull}>
              <ScrollView
                contentContainerStyle={{
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                {this.state.transaction.map((_, index, array) => (
                  <Fragment key={index}>
                    <View
                      style={{
                        alignItems: 'center',
                      }}>
                      {
                        // this is only for styling
                      }
                      {index === 0 && <View style={{marginTop: 20}} />}
                      <Text style={GlobalStyles.formTitleCard}>Address</Text>
                      <View
                        style={{
                          width: Dimensions.get('screen').width,
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}>
                        <View style={{width: '90%'}}>
                          <TextInput
                            multiline
                            numberOfLines={1}
                            style={[
                              GlobalStyles.input,
                              {fontSize: 20, height: 70, paddingHorizontal: 20},
                            ]}
                            keyboardType="default"
                            value={this.state.toAddress[index]}
                            onChangeText={value => {
                              let toAddress = [...this.state.toAddress];
                              toAddress[index] = value;
                              this.setState({toAddress});
                            }}
                          />
                        </View>
                        <Pressable
                          onPress={() => {
                            const scannerSelector = index;
                            this.setStateAsync({
                              scannerSelector,
                              stage: 10,
                            });
                          }}
                          style={{width: '10%'}}>
                          <IconIonIcons
                            name="qr-code"
                            size={30}
                            color={'white'}
                          />
                        </Pressable>
                      </View>
                      <Text style={GlobalStyles.formTitleCard}>
                        Select Token
                      </Text>
                      <RNPickerSelect
                        style={{
                          inputAndroidContainer: {
                            textAlign: 'center',
                          },
                          inputAndroid: {
                            textAlign: 'center',
                            color: 'gray',
                          },
                          viewContainer: {
                            ...GlobalStyles.input,
                            width: Dimensions.get('screen').width * 0.9,
                          },
                        }}
                        value={this.state.tokenSelected[index].value}
                        items={setTokens(blockchain.tokens)}
                        onValueChange={token => {
                          let tokenSelected = [...this.state.tokenSelected];
                          tokenSelected[index] = setTokens(blockchain.tokens)[
                            token
                          ];
                          this.setState({
                            tokenSelected,
                          });
                        }}
                      />
                      <Text style={GlobalStyles.formTitleCard}>Amount</Text>
                      <View
                        style={{
                          width: Dimensions.get('screen').width,
                          flexDirection: 'row',
                          justifyContent: 'space-around',
                          alignItems: 'center',
                        }}>
                        <View style={{width: '100%'}}>
                          <TextInput
                            style={[GlobalStyles.input]}
                            keyboardType="decimal-pad"
                            value={this.state.amount[index]}
                            onChangeText={value => {
                              let amount = [...this.state.amount];
                              amount[index] = value;
                              this.setState({amount});
                            }}
                          />
                        </View>
                      </View>
                    </View>
                    {this.state.check === 'Check Again' && (
                      <Text
                        style={{
                          fontSize: 20,
                          color: '#F00',
                          fontWeight: 'bold',
                          textAlign: 'center',
                          paddingHorizontal: 20,
                        }}>
                        {this.state.errorText}
                      </Text>
                    )}
                    {array.length - 1 !== index && (
                      <LinearGradient
                        style={{
                          justifyContent: 'center',
                          alignItems: 'center',
                          width: '100%',
                        }}
                        colors={['#000000', '#1a1a1a', '#000000']}>
                        <Text
                          style={[
                            GlobalStyles.formTitle,
                            {
                              color: '#ffffff',
                              fontSize: 14,
                              fontWeight: 'bold',
                              marginBottom: 10,
                            },
                          ]}>
                          Remove Transaction
                        </Text>
                        <Pressable
                          disabled={this.state.loading}
                          style={[
                            GlobalStyles.buttonStyleDot,
                            {
                              width: 40,
                              height: 40,
                              paddingBottom: 3,
                              paddingLeft: 0,
                            },
                          ]}
                          onPress={() => {
                            let [
                              amount,
                              toAddress,
                              transaction,
                              tokenSelected,
                            ] = [
                              [...this.state.amount],
                              [...this.state.toAddress],
                              [...this.state.transaction],
                              [...this.state.tokenSelected],
                            ];
                            amount.splice(index + 1, 1);
                            toAddress.splice(index + 1, 1);
                            transaction.splice(index + 1, 1);
                            tokenSelected.splice(index + 1, 1);
                            this.setState({
                              amount,
                              toAddress,
                              transaction,
                              tokenSelected,
                            });
                          }}>
                          <Text style={{fontSize: 20, color: 'white'}}>-</Text>
                        </Pressable>
                      </LinearGradient>
                    )}
                  </Fragment>
                ))}
                <LinearGradient
                  style={{
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: '100%',
                  }}
                  colors={['#000000', '#1a1a1a', '#000000']}>
                  <Text
                    style={[
                      GlobalStyles.formTitle,
                      {
                        color: '#ffffff',
                        fontSize: 14,
                        fontWeight: 'bold',
                        marginBottom: 10,
                      },
                    ]}>
                    Add Transaction
                  </Text>
                  <Pressable
                    disabled={this.state.loading}
                    style={[
                      GlobalStyles.buttonStyleDot,
                      {
                        width: 40,
                        height: 40,
                        paddingBottom: 3,
                        paddingLeft: 0,
                      },
                    ]}
                    onPress={() => {
                      let [amount, toAddress, transaction, tokenSelected] = [
                        [...this.state.amount],
                        [...this.state.toAddress],
                        [...this.state.transaction],
                        [...this.state.tokenSelected],
                      ];
                      amount.push('');
                      toAddress.push('');
                      transaction.push({});
                      tokenSelected.push(setTokens(blockchain.tokens)[0]);
                      this.setState({
                        amount,
                        toAddress,
                        transaction,
                        tokenSelected,
                      });
                    }}>
                    <Text style={{fontSize: 20, color: 'white'}}>+</Text>
                  </Pressable>
                </LinearGradient>
                <Pressable
                  disabled={this.state.loading}
                  style={[
                    GlobalStyles.buttonStyle,
                    this.state.loading ? {opacity: 0.5} : {},
                  ]}
                  onPress={async () => {
                    await this.setStateAsync({loading: true});
                    await this.bulkTransfer();
                    await this.setStateAsync({loading: false});
                  }}>
                  <Text style={[GlobalStyles.buttonText]}>
                    {this.state.check}
                  </Text>
                </Pressable>
              </ScrollView>
            </SafeAreaView>
          </KeyboardAwareScrollViewComponent>
        )}
        {
          // Scan QR
        }
        {this.state.stage === 10 && (
          <View style={[GlobalStyles.main, {justifyContent: 'space-evenly'}]}>
            <View>
              <Text style={{color: 'white', fontSize: 28}}>Scan QR</Text>
            </View>
            <View
              style={{
                height: Dimensions.get('screen').height * 0.5,
                width: Dimensions.get('screen').width * 0.8,
                marginVertical: 20,
                borderColor: secondaryColor,
                borderWidth: 5,
                borderRadius: 10,
              }}>
              <Cam
                callbackAddress={e => {
                  console.log(e);
                  let [toAddress] = [[...this.state.toAddress]];
                  toAddress[this.state.scannerSelector] = e;
                  this.setState({
                    toAddress,
                    stage: 0,
                  });
                }}
              />
            </View>
            <Pressable
              style={[GlobalStyles.buttonCancelStyle]}
              onPress={async () => {
                this.setState({
                  stage: 0,
                });
              }}>
              <Text style={GlobalStyles.buttonCancelText}>Cancel</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    );
  }
}

export default SendWallet;
