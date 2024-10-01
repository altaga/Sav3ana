import {SOLANA_RPC} from '@env';
import {Connection, Keypair, PublicKey} from '@solana/web3.js';
import {utils} from 'ethers';
import React, {Component, Fragment} from 'react';
import {
  Dimensions,
  Image,
  Linking,
  Modal,
  NativeEventEmitter,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import checkMark from '../assets/checkMark.png';
import GlobalStyles, {mainColor, secondaryColor} from '../styles/styles';
import {blockchain} from './constants';
import ContextModule from './contextModule';
import {
  epsilonRound,
  findIndexByProperty,
  getEncryptedStorageValue,
  verifyWallet,
} from './utils';

const baseTransactionsModalState = {
  stage: 0, // 0
  loading: true,
  explorerURL: '',
  gas: '0.0',
};

class TransactionsModal extends Component {
  constructor(props) {
    super(props);
    this.state = baseTransactionsModalState;
    this.provider = new Connection(SOLANA_RPC, 'confirmed');
    this.EventEmitter = new NativeEventEmitter();
  }

  static contextType = ContextModule;

  async componentDidUpdate(prevProps) {
    if (prevProps.signer !== this.props.signer) {
      console.log('Signer Ready on TransactionsModal');
    }
  }

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

  async checkTransaction() {
    let publicKey;
    if (this.context.value.transactionData.walletSelector === 0) {
      publicKey = this.context.value.publicKey;
    }
    if (this.context.value.transactionData.walletSelector === 1) {
      publicKey = this.context.value.publicKeySavings;
    }
    console.log(publicKey);
    const transaction = this.context.value.transactionData.transaction;
    const recentBlockhash = (await this.provider.getLatestBlockhash())
      .blockhash;
    transaction.recentBlockhash = recentBlockhash;
    transaction.feePayer = new PublicKey(publicKey);
    // next
    const gasFee = await transaction.getEstimatedFee(this.provider);
    this.setState({
      gas: utils.formatUnits(gasFee.toString(), blockchain.decimals),
      loading: false,
    });
  }

  async processTransaction() {
    let wallet;
    if (this.context.value.transactionData.walletSelector === 0) {
      let privateKey = await getEncryptedStorageValue('privateKey');
      wallet = Keypair.fromSecretKey(Uint8Array.from(privateKey.split(',')));
    }
    if (this.context.value.transactionData.walletSelector === 1) {
      let privateKey = await getEncryptedStorageValue('privateKeySavings');
      wallet = Keypair.fromSecretKey(Uint8Array.from(privateKey.split(',')));
    }
    const recentBlockhash = (await this.provider.getLatestBlockhash())
      .blockhash;
    const transaction = this.context.value.transactionData.transaction;
    transaction.recentBlockhash = recentBlockhash;
    transaction.feePayer = wallet.publicKey;
    transaction.sign(wallet);
    const txnSignature = await this.provider.sendRawTransaction(
      transaction.serialize(),
      {
        maxRetries: 5,
      },
    );
    this.setState({
      explorerURL: `${blockchain.blockExplorer}tx/${txnSignature}?cluster=${blockchain.cluster}`,
      loading: false,
    });
  }

  render() {
    return (
      <Modal
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
        }}
        visible={this.context.value.isTransactionActive}
        transparent={true}
        onShow={async () => {
          await this.setStateAsync(baseTransactionsModalState);
          await this.checkTransaction();
        }}
        animationType="slide">
        <View
          style={{
            height: '100%',
            width: '100%',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderWidth: 2,
            borderRadius: 25,
            borderColor: mainColor,
            backgroundColor: '#000000',
            paddingVertical: 10,
          }}>
          {this.state.stage === 0 && (
            <React.Fragment>
              <View style={{width: '100%', gap: 20, alignItems: 'center'}}>
                <Text
                  style={{
                    textAlign: 'center',
                    color: 'white',
                    fontSize: 20,
                    width: '100%',
                    marginTop: 10,
                  }}>
                  Transaction:
                </Text>
                <Text
                  style={{
                    textAlign: 'center',
                    color: 'white',
                    fontSize: 26,
                    width: '100%',
                    marginBottom: 10,
                  }}>
                  {this.context.value.transactionData.label}
                </Text>
                <Text
                  style={{
                    textAlign: 'center',
                    color: 'white',
                    fontSize: 20,
                    width: '100%',
                    marginTop: 10,
                  }}>
                  To Address:
                </Text>
                <Text
                  style={{
                    textAlign: 'center',
                    color: 'white',
                    fontSize: verifyWallet(
                      this.context.value.transactionData.to,
                    )
                      ? 20
                      : 24,
                    width: '100%',
                    marginBottom: 10,
                  }}>
                  {verifyWallet(this.context.value.transactionData.to)
                    ? this.context.value.transactionData.to.substring(0, 21) +
                      '\n' +
                      this.context.value.transactionData.to.substring(21)
                    : this.context.value.transactionData.to}
                </Text>
                <Text
                  style={{
                    textAlign: 'center',
                    color: 'white',
                    fontSize: 20,
                    width: '100%',
                    marginTop: 10,
                  }}>
                  Amount (or Equivalent):
                </Text>
                <Text
                  style={{
                    textAlign: 'center',
                    color: 'white',
                    fontSize: 24,
                    width: '100%',
                    marginBottom: 10,
                  }}>
                  {epsilonRound(this.context.value.transactionData.amount, 8)}{' '}
                  {this.context.value.transactionData.tokenSymbol}
                  {'\n ( $'}
                  {epsilonRound(
                    this.context.value.transactionData.amount *
                      this.context.value.usdConversion[
                        findIndexByProperty(
                          blockchain.tokens,
                          'symbol',
                          this.context.value.transactionData.tokenSymbol,
                        )
                      ],
                    6,
                  )}
                  {' USD )'}
                </Text>

                <Text
                  style={{
                    textAlign: 'center',
                    color: 'white',
                    fontSize: 20,
                    width: '100%',
                    marginTop: 10,
                  }}>
                  Gas:
                </Text>
                <Text
                  style={{
                    textAlign: 'center',
                    color: 'white',
                    fontSize: 24,
                    width: '100%',
                    marginBottom: 10,
                  }}>
                  {this.state.loading ? (
                    'Calculating...'
                  ) : (
                    <Fragment>
                      {epsilonRound(this.state.gas, 8)} {blockchain.token}
                      {'\n ( $'}
                      {epsilonRound(
                        this.state.gas * this.context.value.usdConversion[0],
                        6,
                      )}
                      {' USD )'}
                    </Fragment>
                  )}
                </Text>

                {this.context.value.savingsFlag &&
                  this.context.value.transactionData.walletSelector === 0 &&
                  this.context.value.transactionData.command === 'transfer' && (
                    <Text
                      style={{
                        textAlign: 'center',
                        color: 'white',
                        fontSize: 20,
                        width: '100%',
                        marginTop: 10,
                      }}>
                      Saved Amount:{' '}
                      {epsilonRound(
                        this.context.value.transactionData.amountBulk[
                          this.context.value.transactionData.amountBulk.length -
                            1
                        ],
                        9,
                      )}{' '}
                      {blockchain.token}
                    </Text>
                  )}
              </View>
              <View style={{gap: 10, width: '100%', alignItems: 'center'}}>
                <Pressable
                  disabled={this.state.loading}
                  style={[
                    GlobalStyles.buttonStyle,
                    this.state.loading ? {opacity: 0.5} : {},
                  ]}
                  onPress={() => {
                    this.setState({
                      loading: true,
                      stage: 1,
                    });
                    this.processTransaction();
                  }}>
                  <Text
                    style={{
                      color: 'white',
                      fontSize: 24,
                      fontWeight: 'bold',
                    }}>
                    Execute
                  </Text>
                </Pressable>
                <Pressable
                  style={[GlobalStyles.buttonCancelStyle]}
                  onPress={async () => {
                    this.context.setValue({
                      isTransactionActive: false,
                    });
                  }}>
                  <Text style={GlobalStyles.buttonCancelText}>Cancel</Text>
                </Pressable>
              </View>
            </React.Fragment>
          )}
          {this.state.stage === 1 && (
            <React.Fragment>
              <Image
                source={checkMark}
                alt="check"
                style={{width: 200, height: 200}}
              />
              <Text
                style={{
                  marginTop: '20%',
                  textShadowRadius: 1,
                  fontSize: 28,
                  fontWeight: 'bold',
                  color: this.state.loading ? mainColor : secondaryColor,
                }}>
                {this.state.loading ? 'Processing...' : 'Completed'}
              </Text>
              <ScrollView
                style={{width: '100%', marginVertical: '15%'}}
                contentContainerStyle={{
                  height: 'auto',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                {this.context.value.transactionData.labelBulk.map(
                  (_, index) => {
                    return (
                      <View
                        key={index}
                        style={[
                          GlobalStyles.networkShow,
                          {width: Dimensions.get('screen').width * 0.9},
                        ]}>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-around',
                          }}>
                          <View style={{marginHorizontal: 20}}>
                            <Text style={{fontSize: 20, color: 'white'}}>
                              Transaction
                            </Text>
                            <Text style={{fontSize: 14, color: 'white'}}>
                              {
                                this.context.value.transactionData.labelBulk[
                                  index
                                ]
                              }
                            </Text>
                          </View>
                        </View>
                        <View
                          style={{
                            marginHorizontal: 20,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                          <View style={{marginHorizontal: 10}}>
                            {
                              blockchain.tokens[
                                findIndexByProperty(
                                  blockchain.tokens,
                                  'symbol',
                                  this.context.value.transactionData
                                    .tokenSymbolBulk[index],
                                )
                              ].icon
                            }
                          </View>
                          <Text style={{color: 'white'}}>
                            {`${epsilonRound(
                              this.context.value.transactionData.amountBulk[
                                index
                              ],
                              8,
                            )}`}{' '}
                            {
                              this.context.value.transactionData
                                .tokenSymbolBulk[index]
                            }
                          </Text>
                        </View>
                      </View>
                    );
                  },
                )}
              </ScrollView>
              <View style={{gap: 10, width: '100%', alignItems: 'center'}}>
                <Pressable
                  disabled={this.state.loading}
                  style={[
                    GlobalStyles.buttonStyle,
                    this.state.loading ? {opacity: 0.5} : {},
                  ]}
                  onPress={() => Linking.openURL(this.state.explorerURL)}>
                  <Text
                    style={{
                      fontSize: 24,
                      fontWeight: 'bold',
                      color: 'white',
                      textAlign: 'center',
                    }}>
                    View on Explorer
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    GlobalStyles.buttonStyle,
                    {
                      backgroundColor: secondaryColor,
                      borderColor: secondaryColor,
                    },
                    this.state.loading === '' ? {opacity: 0.5} : {},
                  ]}
                  onPress={async () => {
                    this.EventEmitter.emit('refresh');
                    this.context.setValue(
                      {
                        isTransactionActive: false,
                      },
                      () => this.setState(baseTransactionsModalState),
                    );
                  }}
                  disabled={this.state.loading}>
                  <Text
                    style={{
                      color: 'white',
                      fontSize: 24,
                      fontWeight: 'bold',
                    }}>
                    Done
                  </Text>
                </Pressable>
              </View>
            </React.Fragment>
          )}
        </View>
      </Modal>
    );
  }
}

export default TransactionsModal;
