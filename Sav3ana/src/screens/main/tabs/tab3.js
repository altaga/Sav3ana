import {GOOGLE_URL_API, SOLANA_RPC} from '@env';
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
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {serialize} from 'borsh';
import {ethers} from 'ethers';
import React, {Component, Fragment} from 'react';
import {
  Keyboard,
  NativeEventEmitter,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import CreditCard from 'react-native-credit-card';
import LinearGradient from 'react-native-linear-gradient';
import RNPickerSelect from 'react-native-picker-select';
import Crypto from 'react-native-quick-crypto';
import GlobalStyles, {mainColor} from '../../../styles/styles';
import {
  basePublicKey,
  blockchain,
  cardMemorySchema,
  CloudPublicKeyEncryption,
  ProgramInstruction,
  refreshTime,
  SolanaCardProgramID,
  transactionPayloadSchema,
} from '../../../utils/constants';
import ContextModule from '../../../utils/contextModule';
import {
  arraySum,
  epsilonRound,
  getAsyncStorageValue,
  randomNumber,
  setAsyncStorageValue,
} from '../../../utils/utils';
import ReadCard from '../components/readCard';

function setTokens(array) {
  return array.map((item, index) => {
    return {
      ...item,
      value: index.toString(),
      index: index,
      label: item.name,
      key: item.symbol,
    };
  });
}

const generator = require('creditcard-generator');

const baseTab3State = {
  // Transaction settings
  amount: '',
  tokenSelected: setTokens(blockchain.tokens)[0],
  // Card
  cvc: randomNumber(111, 999),
  expiry: '1228',
  name: 'Sav3ana Card',
  number: generator.GenCC('VISA'),
  imageFront: require('../../../assets/cardAssets/card-front.png'),
  imageBack: require('../../../assets/cardAssets/card-back.png'),
  // Utils
  stage: 0,
  selector: false,
  nfcSupported: true,
  loading: false,
  keyboardHeight: 0,
  cardInfo: {
    card: '',
    exp: '',
  },
};

export default class Tab3 extends Component {
  constructor(props) {
    super(props);
    this.state = baseTab3State;
    this.provider = new Connection(SOLANA_RPC, 'confirmed');
    this.EventEmitter = new NativeEventEmitter();
  }

  static contextType = ContextModule;

  async setupCloudCard() {
    return new Promise((resolve, reject) => {
      const myHeaders = new Headers();
      myHeaders.append('Content-Type', 'application/json');
      const raw = JSON.stringify({
        data: this.encryptCardData(
          `${this.state.cardInfo.card}${this.state.cardInfo.exp}`,
        ),
        pubKey: this.context.value.publicKey,
        pda: this.context.value.publicKeyCard,
      });
      const requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: raw,
        redirect: 'follow',
      };

      fetch(`${GOOGLE_URL_API}/AddCard`, requestOptions)
        .then(response => response.text())
        .then(result => resolve(result))
        .catch(error => reject(error));
    });
  }

  async setupChainCard() {
    const programId = new PublicKey(SolanaCardProgramID);
    const owner = new PublicKey(this.context.value.publicKey);
    let [pda] = await PublicKey.findProgramAddressSync(
      [Buffer.from('card'), owner.toBuffer()],
      programId,
    );
    this.context.setValue({publicKeyCard: pda.toBase58()});
    await setAsyncStorageValue({publicKeyCard: pda.toBase58()});
  }

  async componentDidMount() {
    this.EventEmitter.addListener('refresh', async () => {
      this.context.value.publicKeyCard === basePublicKey &&
        (await this.setupCard());
      Keyboard.dismiss();
      await setAsyncStorageValue({lastRefreshCard: Date.now()});
      this.refresh();
    });
    if (this.context.value.publicKeyCard !== basePublicKey) {
      console.log(this.context.value.publicKeyCard);
      const refreshCheck = Date.now();
      const lastRefresh = await this.getLastRefreshCard();
      if (refreshCheck - lastRefresh >= refreshTime) {
        console.log('Refreshing...');
        await setAsyncStorageValue({lastRefreshCard: Date.now()});
        await this.refresh();
      } else {
        console.log(
          `Next refresh Available: ${Math.round(
            (refreshTime - (refreshCheck - lastRefresh)) / 1000,
          )} Seconds`,
        );
      }
    }
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
        true,
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

  async addBalance() {
    const rentExemptionAmount =
      await this.provider.getMinimumBalanceForRentExemption(0);
    let preProcessedInstructions = [
      {
        to: this.context.value.publicKeyCard,
        amount: ethers.utils
          .parseUnits(this.state.amount, this.state.tokenSelected.decimals)
          .toBigInt(),
        amountFormatted: this.state.amount,
        token: this.state.tokenSelected,
        rentExemptionAmount,
      },
    ];
    const labelBulk = preProcessedInstructions.map(_ => 'Add Balance');
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
    await this.setStateAsync({loading: false});
    this.context.setValue({
      isTransactionActive: true,
      transactionData: {
        ...this.context.value.transactionData,
        // Wallet Selection
        walletSelector: 0,
        // Commands
        command: 'addBalance',
        // Transaction
        transaction,
        // Simple Display
        label: 'Add Balance',
        to: this.context.value.publicKeyCard,
        amount: this.state.amount,
        tokenSymbol: this.state.tokenSelected.symbol,
        // Bulk Display
        labelBulk,
        toBulk,
        amountBulk,
        tokenSymbolBulk,
      },
    });
  }

  async setupCard() {
    await this.setupChainCard();
    await this.setupCloudCard();
  }

  async createCard() {
    const programId = new PublicKey(SolanaCardProgramID);
    const owner = new PublicKey(this.context.value.publicKey);
    let [pda, bump] = await PublicKey.findProgramAddressSync(
      [Buffer.from('card'), owner.toBuffer()],
      programId,
    );
    const kind = ProgramInstruction.CreateCard;
    const seedMemory = {
      owner: owner.toBytes(),
      nfc: true,
      types: false,
      kind: 0,
      brand: 0,
    };
    const space = serialize(cardMemorySchema, seedMemory).length;
    const instruction = {
      instruction: kind,
      bump,
      space,
      ...seedMemory,
    };
    const data = Buffer.from(serialize(transactionPayloadSchema, instruction));
    console.log({
      bump,
      publicKey: pda.toBase58(),
      size: space ?? 0,
    });
    const transaction = new Transaction().add(
      new TransactionInstruction({
        keys: [
          {
            pubkey: owner,
            isSigner: true,
            isWritable: true,
          },
          {
            pubkey: pda,
            isSigner: false,
            isWritable: true,
          },
          {
            pubkey: SYSVAR_RENT_PUBKEY,
            isSigner: false,
            isWritable: false,
          },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        data,
        programId,
      }),
    );
    this.context.setValue({
      isTransactionActive: true,
      transactionData: {
        ...this.context.value.transactionData,
        // Wallet Selection
        walletSelector: 0,
        // Commands
        command: 'create',
        // Transaction
        transaction,
        // Simple Display
        label: 'Create Card',
        to: programId.toBase58(),
        amount: 0,
        // Bulk Display
        labelBulk: ['Create Card'],
        toBulk: [programId.toBase58()],
        amountBulk: [0],
        tokenSymbolBulk: ['SOL'],
      },
    });
  }

  async getCardBalance() {
    const publicKey = new PublicKey(this.context.value.publicKeyCard);
    let tokens = [...blockchain.tokens];
    tokens.shift();
    const tokenAccounts = tokens.map(token =>
      getAssociatedTokenAddressSync(
        new PublicKey(token.address),
        publicKey,
        true,
      ),
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
    const balancesCard = blockchain.tokens.map((token, index) =>
      ethers.utils.formatUnits(balancesTemp[index], token.decimals),
    );
    await setAsyncStorageValue({balancesCard});
    this.context.setValue({balancesCard});
    console.log('balancesCard', balancesCard);
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

  async refresh() {
    await this.setStateAsync({refreshing: true});
    await this.getCardBalance();
    await this.setStateAsync({refreshing: false});
  }

  async getLastRefreshCard() {
    try {
      const lastRefreshCard = await getAsyncStorageValue('lastRefreshCard');
      if (lastRefreshCard === null) throw 'Set First Date';
      return lastRefreshCard;
    } catch (err) {
      await setAsyncStorageValue({lastRefreshCard: 0});
      return 0;
    }
  }

  encryptCardData(cardData) {
    const encrypted = Crypto.publicEncrypt(
      {
        key: CloudPublicKeyEncryption,
      },
      Buffer.from(cardData, 'utf8'),
    );
    return encrypted.toString('base64');
  }

  render() {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          this.context.value.publicKeyCard !== basePublicKey && (
            <RefreshControl
              progressBackgroundColor={mainColor}
              refreshing={this.state.refreshing}
              onRefresh={async () => {
                await setAsyncStorageValue({
                  lastRefreshCard: Date.now().toString(),
                });
                await this.refresh();
              }}
            />
          )
        }
        style={GlobalStyles.tab3Container}
        contentContainerStyle={[
          GlobalStyles.tab3ScrollContainer,
          {
            height:
              this.context.value.publicKeyCard !== basePublicKey
                ? 'auto'
                : '100%',
          },
        ]}>
        {this.context.value.publicKeyCard !== basePublicKey ? (
          <Fragment>
            <View style={{height: 180, marginTop: 30}}>
              <CreditCard
                type={this.state.type}
                imageFront={this.state.imageFront}
                imageBack={this.state.imageBack}
                shiny={false}
                bar={false}
                number={this.state.number}
                name={this.state.name}
                expiry={this.state.expiry}
                cvc={this.state.cvc}
              />
            </View>
            <LinearGradient
              style={{
                justifyContent: 'center',
                alignItems: 'center',
                width: '100%',
                marginTop: 30,
              }}
              colors={['#000000', '#1a1a1a', '#000000']}>
              <Text style={[GlobalStyles.title]}>Card Balance</Text>
              <Text style={[GlobalStyles.balance]}>
                {`$ ${epsilonRound(
                  arraySum(
                    this.context.value.balancesCard.map(
                      (x, i) => x * this.context.value.usdConversion[i],
                    ),
                  ),
                  2,
                )} USD`}
              </Text>
            </LinearGradient>
            <View
              style={{
                flexDirection: 'row',
                width: '100%',
                justifyContent: 'space-evenly',
                alignItems: 'center',
                marginTop: 30,
              }}>
              <Pressable
                disabled={this.state.loading}
                style={[
                  this.state.selector
                    ? GlobalStyles.buttonSelectorStyle
                    : GlobalStyles.buttonSelectorSelectedStyle,
                ]}
                onPress={async () => {
                  this.setState({selector: false});
                }}>
                <Text style={[GlobalStyles.buttonText, {fontSize: 18}]}>
                  Tokens
                </Text>
              </Pressable>
              <Pressable
                disabled={this.state.loading}
                style={[
                  !this.state.selector
                    ? GlobalStyles.buttonSelectorStyle
                    : GlobalStyles.buttonSelectorSelectedStyle,
                ]}
                onPress={async () => {
                  this.setState({selector: true});
                }}>
                <Text style={[GlobalStyles.buttonText, {fontSize: 18}]}>
                  Add Balance
                </Text>
              </Pressable>
            </View>
            {this.state.selector ? (
              <View
                style={{
                  justifyContent: 'center',
                  alignItems: 'center',
                  width: '90%',
                  marginTop: 30,
                }}>
                <Text style={GlobalStyles.formTitleCard}>Amount</Text>
                <TextInput
                  style={[GlobalStyles.input, {width: '100%'}]}
                  keyboardType="decimal-pad"
                  value={this.state.amount}
                  onChangeText={value => this.setState({amount: value})}
                />
                <Text style={GlobalStyles.formTitleCard}>Select Token</Text>
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
                      width: '100%',
                    },
                  }}
                  value={this.state.tokenSelected.value}
                  items={setTokens(blockchain.tokens)}
                  onValueChange={index => {
                    this.setState({
                      tokenSelected: setTokens(blockchain.tokens)[
                        parseInt(index)
                      ],
                    });
                  }}
                />
                <View
                  style={{
                    width: '100%',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                  <Pressable
                    disabled={this.state.loading}
                    style={[
                      GlobalStyles.buttonStyle,
                      {
                        width: '100%',
                        padding: 10,
                        marginVertical: 25,
                      },
                      this.state.loading ? {opacity: 0.5} : {},
                    ]}
                    onPress={async () => {
                      await this.setStateAsync({loading: true});
                      await this.addBalance();
                      await this.setStateAsync({
                        loading: false,
                      });
                    }}>
                    <Text style={[GlobalStyles.buttonText]}>
                      {this.state.loading ? 'Adding...' : 'Add'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={{marginTop: 30}}>
                {blockchain.tokens.map((token, index) => (
                  <View key={index} style={GlobalStyles.network}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-around',
                      }}>
                      <View style={{marginHorizontal: 20}}>
                        <View>{token.icon}</View>
                      </View>
                      <View style={{justifyContent: 'center'}}>
                        <Text
                          style={{
                            fontSize: 18,
                            color: 'white',
                          }}>
                          {token.name}
                        </Text>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'flex-start',
                          }}>
                          <Text
                            style={{
                              fontSize: 12,
                              color: 'white',
                            }}>
                            {this.context.value.balancesCard[index] === 0
                              ? '0'
                              : this.context.value.balancesCard[index] < 0.001
                              ? '<0.01'
                              : epsilonRound(
                                  this.context.value.balancesCard[index],
                                  2,
                                )}{' '}
                            {token.symbol}
                          </Text>
                          <Text
                            style={{
                              fontSize: 12,
                              color: 'white',
                            }}>
                            {`  -  ($${epsilonRound(
                              this.context.value.usdConversion[index],
                              4,
                            )} USD)`}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={{marginHorizontal: 20}}>
                      <Text style={{color: 'white'}}>
                        $
                        {epsilonRound(
                          this.context.value.balancesCard[index] *
                            this.context.value.usdConversion[index],
                          2,
                        )}{' '}
                        USD
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Fragment>
        ) : (
          <Fragment>
            {
              // Stage 0
              this.state.stage === 0 && (
                <View
                  style={{
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: '90%',
                    height: '100%',
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
                    Create Card Account
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
                      onPress={() => this.setState({stage: 1})}>
                      <Text style={[GlobalStyles.buttonText]}>
                        {this.state.loading ? 'Creating...' : 'Create Account'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )
            }
            {
              // Stage 1
              this.state.stage === 1 && (
                <React.Fragment>
                  <View
                    style={{
                      justifyContent: 'space-around',
                      alignItems: 'center',
                      height: '100%',
                    }}>
                    <Text style={GlobalStyles.title}>
                      {' '}
                      Merge Physical Card to Card Account
                    </Text>
                    <ReadCard
                      cardInfo={async cardInfo => {
                        if (cardInfo) {
                          await this.setStateAsync({cardInfo});
                          this.createCard();
                        }
                      }}
                    />
                  </View>
                </React.Fragment>
              )
            }
          </Fragment>
        )}
      </ScrollView>
    );
  }
}
