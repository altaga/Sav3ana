import {SOLANA_RPC} from '@env';
import Slider from '@react-native-community/slider';
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import {mnemonicToSeedSync} from 'bip39';
import {Wallet, ethers} from 'ethers';
import React, {Component, Fragment} from 'react';
import {
  Dimensions,
  NativeEventEmitter,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import RNPickerSelect from 'react-native-picker-select';
import Crypto from 'react-native-quick-crypto';
import GlobalStyles, {mainColor} from '../../../styles/styles';
import {
  CloudPublicKeyEncryption,
  basePublicKey,
  blockchain,
  refreshTime,
} from '../../../utils/constants';
import ContextModule from '../../../utils/contextModule';
import {
  arraySum,
  epsilonRound,
  formatDate,
  getAsyncStorageValue,
  setAsyncStorageValue,
  setEncryptedStorageValue,
} from '../../../utils/utils';

const periodsAvailable = [
  {
    label: 'Daily',
    value: 1,
    periodValue: 86400,
  },
  {
    label: 'Weekly',
    value: 2,
    periodValue: 604800,
  },
  {
    label: 'Monthly',
    value: 3,
    periodValue: 2629800,
  },
  {
    label: 'Yearly',
    value: 4,
    periodValue: 31557600,
  },
];

const protocolsAvailable = [
  {
    label: 'Balanced',
    value: 1,
  },
  {
    label: 'Percentage',
    value: 2,
  },
];

const baseTab2State = {
  refreshing: false,
  loading: false,
};

export default class Tab2 extends Component {
  constructor(props) {
    super(props);
    this.state = baseTab2State;
    this.provider = new Connection(SOLANA_RPC, 'confirmed');
    this.EventEmitter = new NativeEventEmitter();
  }

  static contextType = ContextModule;

  async getLastRefreshSavings() {
    try {
      const lastRefreshSavings = await getAsyncStorageValue(
        'lastRefreshSavings',
      );
      if (lastRefreshSavings === null) throw 'Set First Date';
      return lastRefreshSavings;
    } catch (err) {
      await setAsyncStorageValue({lastRefreshSavings: 0});
      return 0;
    }
  }

  async componentDidMount() {
    console.log(this.context.value.publicKeySavings);
    this.EventEmitter.addListener('refresh', async () => {
      await setAsyncStorageValue({lastRefreshSavings: Date.now()});
      this.refresh();
    });
    if (this.context.value.publicKeySavings !== basePublicKey) {
      const lastRefresh = await this.getLastRefreshSavings();
      if (Date.now() - lastRefresh >= refreshTime) {
        console.log('Refreshing...');
        await setAsyncStorageValue({lastRefreshSavings: Date.now()});
        this.refresh();
      } else {
        console.log(
          `Next refresh Available: ${Math.round(
            (refreshTime - (Date.now() - lastRefresh)) / 1000,
          )} Seconds`,
        );
      }
    }
  }

  componentWillUnmount() {
    this.EventEmitter.removeAllListeners('refresh');
  }

  async refresh() {
    await this.setStateAsync({refreshing: true});
    await this.getSavingsBalance();
    await this.setStateAsync({refreshing: false});
  }

  async getSavingsBalance() {
    const publicKey = new PublicKey(this.context.value.publicKeySavings);
    let tokens = [...blockchain.tokens];
    tokens.shift();
    const tokenAccounts = tokens.map(token =>
      getAssociatedTokenAddressSync(new PublicKey(token.address), publicKey),
    );
    const balanceSol = await this.provider.getBalance(publicKey);
    const balanceTokens = await Promise.all(
      tokenAccounts.map(async account => {
        try {
          const balance = await this.provider.getTokenAccountBalance(account);
          return balance;
        } catch (error) {
          return {value: {amount: 0}};
        }
      }),
    );
    const balancesTemp = [
      balanceSol,
      ...balanceTokens.map(balance => balance.value.amount),
    ];
    const balancesSavings = blockchain.tokens.map((token, index) =>
      ethers.utils.formatUnits(balancesTemp[index], token.decimals),
    );
    await setAsyncStorageValue({balancesSavings});
    this.context.setValue({balancesSavings});
    console.log('balancesSavings', balancesSavings);
  }

  async changePeriod() {
    const savingsDate =
      Date.now() +
      periodsAvailable[this.context.value.periodSelected - 1].periodValue *
        1000;
    await setAsyncStorageValue({savingsDate});
    this.context.setValue({savingsDate});
  }

  createWallet() {
    this.setState({
      loading: true,
    });
    setTimeout(async () => {
      const wallet = Wallet.createRandom();
      const mnemonic = wallet.mnemonic.phrase;
      const seed = mnemonicToSeedSync(mnemonic, '');
      const newAccount = Keypair.fromSeed(seed.slice(0, 32));
      this.context.setValue({
        publicKeySavings: newAccount.publicKey.toBase58(),
      });
      await setEncryptedStorageValue({
        mnemonicSavings: mnemonic,
        privateKeySavings: newAccount._keypair.secretKey.toString(),
      });
      await setAsyncStorageValue({
        publicKeySavings: newAccount.publicKey.toBase58(),
      });
      this.componentDidMount();
    }, 100); // Delay for heavy load function
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
    if (data.token.symbol === 'SOL') {
      const balance = await this.provider.getBalance(new PublicKey(data.to));
      if (
        balance < data.rentExemptionAmount &&
        data.amount < data.rentExemptionAmount
      ) {
        instructions.push(
          SystemProgram.transfer({
            fromPubkey: new PublicKey(this.context.value.publicKeySavings),
            toPubkey: new PublicKey(data.to),
            lamports: data.rentExemptionAmount,
          }),
        );
      } else {
        instructions.push(
          SystemProgram.transfer({
            fromPubkey: new PublicKey(this.context.value.publicKeySavings),
            toPubkey: new PublicKey(data.to),
            lamports: data.amount,
          }),
        );
      }
    } else {
      const tokenAccountFrom = getAssociatedTokenAddressSync(
        new PublicKey(data.token.address),
        new PublicKey(this.context.value.publicKeySavings),
      );
      const tokenAccountTo = getAssociatedTokenAddressSync(
        new PublicKey(data.token.address),
        new PublicKey(data.to),
      );
      const exist = await this.checkExist(tokenAccountTo);
      if (!exist) {
        instructions.push(
          createAssociatedTokenAccountInstruction(
            new PublicKey(this.context.value.publicKeySavings),
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
          new PublicKey(this.context.value.publicKeySavings),
          data.amount,
        ),
      );
    }
    return instructions;
  }

  async bulkTransfer() {
    const rentExemptionAmount =
      await this.provider.getMinimumBalanceForRentExemption(0);
    const rentSol = parseFloat(
      ethers.utils.formatUnits(rentExemptionAmount, 9),
    );
    let preProcessedInstructions = [];
    this.context.value.balancesSavings.forEach((balance, index) => {
      if (
        index === 0
          ? parseFloat(balance).toFixed(9) > rentSol + 0.000005
          : balance > 0
      ) {
        const balanceModified =
          index === 0
            ? (parseFloat(balance) - rentSol - 0.000005).toString()
            : balance;
        preProcessedInstructions.push({
          to: this.context.value.publicKey,
          amount: ethers.utils
            .parseUnits(balanceModified, blockchain.tokens[index].decimals)
            .toBigInt(),
          amountFormatted: balanceModified,
          token: blockchain.tokens[index],
          index,
          rentExemptionAmount,
        });
      }
    });
    let amount = preProcessedInstructions.reduce(
      (acc, item) =>
        acc +
        (item.amountFormatted * this.context.value.usdConversion[item.index]) /
          this.context.value.usdConversion[0],
      0,
    );
    const labelBulk = preProcessedInstructions.map(_ => 'Transfer');
    const amountBulk = preProcessedInstructions.map(
      item => item.amountFormatted,
    );
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
    if (transactions.flat().length === 0) return;
    this.context.setValue({
      isTransactionActive: true,
      transactionData: {
        ...this.context.value.transactionData,
        // Wallet Selection
        walletSelector: 1,
        // Commands
        command: 'transfer',
        // Transaction
        transaction,
        // Simple Display
        label: 'Savings Withdrawal',
        to: this.context.value.publicKey,
        amount,
        // Bulk Display
        labelBulk,
        toBulk,
        amountBulk,
        tokenSymbolBulk,
      },
    });
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

  encryptSignatureData(signatureData) {
    const encrypted = Crypto.publicEncrypt(
      {
        key: CloudPublicKeyEncryption,
      },
      Buffer.from(signatureData, 'utf8'),
    );
    return encrypted.toString('base64');
  }

  render() {
    return (
      <ScrollView
      showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            progressBackgroundColor={mainColor}
            refreshing={this.state.refreshing}
            onRefresh={async () => {
              await setAsyncStorageValue({
                lastRefreshSavings: Date.now().toString(),
              });
              await this.refresh();
            }}
          />
        }
        style={GlobalStyles.tab2Container}
        contentContainerStyle={[GlobalStyles.tab2ScrollContainer]}>
        {this.context.value.publicKeySavings !== basePublicKey ? (
          <Fragment>
            <LinearGradient
              style={{
                justifyContent: 'center',
                alignItems: 'center',
                width: '100%',
                marginVertical: 40,
              }}
              colors={['#000000', '#1a1a1a', '#000000']}>
              <Text style={[GlobalStyles.title]}>Savings Balance</Text>
              <Text style={[GlobalStyles.balance]}>
                {`$ ${epsilonRound(
                  arraySum(
                    this.context.value.balancesSavings.map(
                      (x, i) => x * this.context.value.usdConversion[i],
                    ),
                  ),
                  2,
                )} USD`}
              </Text>
            </LinearGradient>
            <View
              style={{
                justifyContent: 'flex-start',
                alignItems: 'center',
                width: '90%',
                gap: 25,
              }}>
              <View
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignContent: 'center',
                  width: '100%',
                }}>
                <Text style={[GlobalStyles.formTitle]}>Activate Savings</Text>
                <Switch
                  style={{
                    transform: [{scaleX: 1.3}, {scaleY: 1.3}],
                  }}
                  trackColor={{
                    false: '#3e3e3e',
                    true: mainColor + '77',
                  }}
                  thumbColor={
                    this.context.value.savingsFlag ? mainColor : '#f4f3f4'
                  }
                  ios_backgroundColor="#3e3e3e"
                  onValueChange={async () => {
                    await setAsyncStorageValue({
                      savingsFlag: !this.context.value.savingsFlag,
                    });
                    await this.context.setValue({
                      savingsFlag: !this.context.value.savingsFlag,
                    });
                  }}
                  value={this.context.value.savingsFlag}
                />
              </View>
              {this.context.value.savingsFlag && (
                <React.Fragment>
                  <View
                    style={{
                      borderColor: mainColor,
                    }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        width: '100%',
                      }}>
                      <Text style={[GlobalStyles.formTitle]}>
                        Savings Period
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
                            width: '55%',
                          },
                        }}
                        value={this.context.value.periodSelected}
                        items={periodsAvailable}
                        onValueChange={async value => {
                          await setAsyncStorageValue({
                            periodSelected: value,
                          });
                          await this.context.setValue({
                            periodSelected: value,
                          });
                        }}
                      />
                    </View>
                    <Pressable
                      disabled={this.state.loading}
                      style={[
                        GlobalStyles.buttonStyle,
                        this.state.loading ? {opacity: 0.5} : {},
                      ]}
                      onPress={async () => {
                        await this.setStateAsync({loading: true});
                        await this.changePeriod();
                        await this.setStateAsync({loading: false});
                      }}>
                      <Text
                        style={{
                          color: 'white',
                          fontSize: 18,
                          fontWeight: 'bold',
                        }}>
                        {this.state.loading
                          ? 'Changing...'
                          : 'Change Savings Period'}
                      </Text>
                    </Pressable>
                  </View>
                  <View
                    style={{
                      width: '100%',
                    }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        width: '100%',
                      }}>
                      <Text style={[GlobalStyles.formTitle]}>
                        Savings Protocol
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
                            width: Dimensions.get('screen').width * 0.5,
                          },
                        }}
                        value={this.context.value.protocolSelected}
                        items={protocolsAvailable}
                        onValueChange={async protocolSelected => {
                          await setAsyncStorageValue({
                            protocolSelected,
                          });
                          await this.context.setValue({
                            protocolSelected,
                          });
                        }}
                      />
                    </View>
                    {this.context.value.protocolSelected === 2 && (
                      <View
                        style={{
                          display: 'flex',
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignContent: 'center',
                          width: '100%',
                        }}>
                        <Slider
                          value={this.context.value.percentage}
                          style={{
                            width: '85%',
                            height: 40,
                          }}
                          step={1}
                          minimumValue={1}
                          maximumValue={15}
                          minimumTrackTintColor="#FFFFFF"
                          maximumTrackTintColor={mainColor}
                          onValueChange={async value => {
                            await setAsyncStorageValue({
                              percentage: value,
                            });
                            this.context.setValue({
                              percentage: value,
                            });
                          }}
                        />
                        <Text
                          style={{
                            width: '15%',
                            fontSize: 24,
                            color: '#FFF',
                            fontWeight: 'bold',
                          }}>
                          {this.context.value.percentage}%
                        </Text>
                      </View>
                    )}
                  </View>
                  <View
                    style={{
                      display: 'flex',
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignContent: 'center',
                      width: '100%',
                    }}>
                    <Text style={[GlobalStyles.formTitle]}>
                      Next Withdraw Date
                    </Text>
                    <Pressable
                      /**
                            disabled={
                              this.state.loading ||
                              !(this.context.value.savingsDate < Date.now())
                            }
                            */
                      style={[
                        GlobalStyles.buttonStyle,
                        {width: '50%'},
                        this.state.loading ||
                        !(this.context.value.savingsDate < Date.now())
                          ? {opacity: 0.5}
                          : {},
                      ]}
                      onPress={async () => {
                        await this.setStateAsync({loading: true});
                        await this.bulkTransfer();
                        await this.setStateAsync({loading: false});
                      }}>
                      <Text
                        style={{
                          color: 'white',
                          fontSize: 18,
                          fontWeight: 'bold',
                        }}>
                        {!(this.context.value.savingsDate < Date.now())
                          ? formatDate(new Date(this.context.value.savingsDate))
                          : this.state.loading
                          ? 'Withdrawing...'
                          : 'Withdraw Now'}
                      </Text>
                    </Pressable>
                  </View>
                </React.Fragment>
              )}
            </View>
          </Fragment>
        ) : (
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              width: '90%',
            }}>
            <Text
              style={[
                GlobalStyles.exoTitle,
                {
                  textAlign: 'center',
                  fontSize: 24,
                  paddingBottom: 20,
                },
              ]}>
              Create Savings Account
            </Text>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                width: '100%',
              }}>
              <Pressable
                disabled={this.state.loading}
                style={[
                  GlobalStyles.buttonStyle,
                  this.state.loading ? {opacity: 0.5} : {},
                ]}
                onPress={() => this.createWallet()}>
                <Text style={[GlobalStyles.buttonText]}>
                  {this.state.loading ? 'Creating...' : 'Create Account'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    );
  }
}
