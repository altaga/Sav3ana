import { GOOGLE_URL_API, SOLANA_RPC } from '@env';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { Connection, PublicKey } from '@solana/web3.js';
import { ethers } from 'ethers';
import React, { Component, Fragment } from 'react';
import {
  Dimensions,
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from 'react-native';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import RNPrint from 'react-native-print';
import QRCode from 'react-native-qrcode-svg';
import Crypto from 'react-native-quick-crypto';
import VirtualKeyboard from 'react-native-virtual-keyboard';
import checkMark from '../../assets/checkMark.png';
import { logo } from '../../assets/logo';
import Header from '../../components/header';
import GlobalStyles, {
  mainColor,
  secondaryColor,
  tertiaryColor
} from '../../styles/styles';
import {
  CloudPublicKeyEncryption,
  basePublicKey,
  blockchain
} from '../../utils/constants';
import ContextModule from '../../utils/contextModule';
import {
  deleteLeadingZeros,
  epsilonRound,
  findIndexByProperty,
  formatInputText
} from '../../utils/utils';
import ReadCard from './components/readCard';

const BaseStatePaymentWallet = {
  // Base
  publicKeyCard: basePublicKey,
  balances: blockchain.tokens.map(() => 0),
  activeTokens: blockchain.tokens.map(() => false),
  stage: 0, // 0
  amount: '0.00', // "0.00"
  cardInfo: null,
  loading: true,
  status: 'Processing...',
  explorerURL: '',
  transactionDisplay: {
    amount: '0.00',
    name: blockchain.token,
    tokenAddress: blockchain.tokens[0].address,
    icon: blockchain.tokens[0].icon,
  },
  // QR print
  saveData: '',
};

class PaymentWallet extends Component {
  constructor(props) {
    super(props);
    this.state = BaseStatePaymentWallet;
    this.provider = new Connection(SOLANA_RPC, 'confirmed');
    this.svg = null;
  }

  static contextType = ContextModule;

  async getDataURL() {
    return new Promise(async (resolve, reject) => {
      this.svg.toDataURL(async data => {
        this.setState(
          {
            saveData: data,
          },
          () => resolve('ok'),
        );
      });
    });
  }

  async print() {
    await this.getDataURL();
    const results = await RNHTMLtoPDF.convert({
      html: `
        <div style="text-align: center;">
          <img src='${logo}' width="400px"></img>
          <h1 style="font-size: 3rem;">--------- Original Reciept ---------</h1>
          <h1 style="font-size: 3rem;">Date: ${new Date().toLocaleDateString()}</h1>
          <h1 style="font-size: 3rem;">Type: Card Payment</h1>
          <h1 style="font-size: 3rem;">------------------ • ------------------</h1>
          <h1 style="font-size: 3rem;">Transaction</h1>
          <h1 style="font-size: 3rem;">Amount: ${
            this.state.transactionDisplay.amount
          } ${this.state.transactionDisplay.name}</h1>
          <h1 style="font-size: 3rem;">------------------ • ------------------</h1>
          <img style="width:70%" src='${
            'data:image/png;base64,' + this.state.saveData
          }'></img>
      </div>
      `,
      fileName: 'print',
      base64: true,
    });
    await RNPrint.print({filePath: results.filePath});
  }

  componentDidMount() {
    this.props.navigation.addListener('focus', async () => {
      this.setState({
        loading: false,
      });
    });
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

  async processPayment(tx) {
    await this.setStateAsync({
      explorerURL: `${blockchain.blockExplorer}tx/${tx}?cluster=${blockchain.cluster}`,
      status: 'Confirmed',
      loading: false,
    });
  }

  async payFromCard(token) {
    let index = findIndexByProperty(
      blockchain.tokens,
      'address',
      token.address,
    );
    if (index === -1) {
      throw new Error('Token not found');
    }
    const amountCrypto = epsilonRound(
      parseFloat(deleteLeadingZeros(formatInputText(this.state.amount))) /
        this.context.value.usdConversion[index],
      blockchain.tokens[index].decimals,
    );
    return new Promise(async (resolve, reject) => {
      const myHeaders = new Headers();
      myHeaders.append('Content-Type', 'application/json');
      const raw = JSON.stringify({
        data: this.encryptCardData(
          `${this.state.cardInfo.card}${this.state.cardInfo.exp}`,
        ),
        toAddress: this.context.value.publicKey,
        amount: epsilonRound(amountCrypto, blockchain.tokens[index].decimals),
        decimals: blockchain.tokens[index].decimals,
        tokenAddress: blockchain.tokens[index].address,
        concept:"Payment",
      });
      await this.setStateAsync({
        transactionDisplay: {
          amount: epsilonRound(amountCrypto, blockchain.tokens[index].decimals),
          name: blockchain.tokens[index].symbol,
          tokenAddress: blockchain.tokens[index].address,
          icon: blockchain.tokens[index].icon,
        },
      });
      const requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: raw,
        redirect: 'follow',
      };
      fetch(`${GOOGLE_URL_API}/cardTransaction`, requestOptions)
        .then(response => response.text())
        .then(result => {
          if (result === 'Bad Request') {
            reject('Bad Request');
          } else {
            resolve(result);
          }
        })
        .catch(error => reject(error));
    });
  }

  async getAddressFromCard() {
    return new Promise((resolve, reject) => {
      const myHeaders = new Headers();
      myHeaders.append('Content-Type', 'application/json');
      const raw = JSON.stringify({
        data: this.encryptCardData(
          `${this.state.cardInfo.card}${this.state.cardInfo.exp}`,
        ),
      });
      const requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: raw,
        redirect: 'follow',
      };
      fetch(`${GOOGLE_URL_API}/getCard`, requestOptions)
        .then(response => response.text())
        .then(result => {
          if (result === 'Bad Request') {
            reject();
          } else {
            resolve(result);
          }
        })
        .catch(error => reject(error));
    });
  }

  async getBalances() {
    const publicKey = new PublicKey(this.state.publicKeyCard);
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
    const balances = blockchain.tokens.map((token, index) =>
      ethers.utils.formatUnits(balancesTemp[index], token.decimals),
    );
    const activeTokens = balances.map(
      (tokenBalance, index) =>
        tokenBalance >=
        parseFloat(deleteLeadingZeros(formatInputText(this.state.amount))) /
          this.context.value.usdConversion[index],
    );
    await this.setStateAsync({balances, activeTokens, stage: 2});
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
      <Fragment>
        <SafeAreaView style={[GlobalStyles.container]}>
          <Header />
          <View style={[GlobalStyles.mainFull]}>
            {this.state.stage === 0 && (
              <View
                style={{
                  height: '100%',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 40,
                }}>
                <Text style={GlobalStyles.title}>Enter Amount (USD)</Text>
                <Text style={{fontSize: 36, color: 'white'}}>
                  {deleteLeadingZeros(formatInputText(this.state.amount))}
                </Text>
                <VirtualKeyboard
                  style={{
                    width: '80vw',
                    fontSize: 40,
                    textAlign: 'center',
                    marginTop: -10,
                  }}
                  cellStyle={{
                    width: 50,
                    height: 50,
                    borderWidth: 1,
                    borderColor: '#77777777',
                    borderRadius: 5,
                    margin: 1,
                  }}
                  color="white"
                  pressMode="string"
                  onPress={amount => this.setState({amount})}
                  decimal
                />
                <View
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'space-evenly',
                    width: Dimensions.get('window').width,
                  }}>
                  <Pressable
                    style={GlobalStyles.buttonStyle}
                    onPress={() => this.setState({stage: 1})}>
                    <Text style={GlobalStyles.buttonText}>Pay with Card</Text>
                  </Pressable>
                </View>
              </View>
            )}
            {this.state.stage === 1 && (
              <View
                style={{
                  height: '100%',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 40,
                }}>
                <View style={{alignItems: 'center'}}>
                  <Text style={GlobalStyles.title}>Amount (USD)</Text>
                  <Text style={{fontSize: 36, color: 'white'}}>
                    $ {deleteLeadingZeros(formatInputText(this.state.amount))}
                  </Text>
                </View>
                <ReadCard
                  cardInfo={async cardInfo => {
                    if (cardInfo) {
                      await this.setStateAsync({cardInfo});
                      try {
                        const publicKeyCard = await this.getAddressFromCard();
                        await this.setStateAsync({publicKeyCard});
                        await this.getBalances();
                      } catch (error) {
                        this.setState({stage: 0});
                      }
                    }
                  }}
                />
                <View
                  key={
                    'This element its only to align the NFC reader in center'
                  }
                />
              </View>
            )}
            {this.state.stage === 2 && (
              <React.Fragment>
                <Text style={[GlobalStyles.title, {marginVertical: 50}]}>
                  Select Payment Token
                </Text>
                <ScrollView>
                  {blockchain.tokens
                    .filter((_, index) => this.state.activeTokens[index])
                    .map((token, index, array) => (
                      <View
                        key={index}
                        style={{
                          paddingBottom: array.length === index + 1 ? 0 : 20,
                          marginBottom: 20,
                        }}>
                        <Pressable
                          disabled={this.state.loading}
                          style={[
                            GlobalStyles.buttonStyle,
                            this.state.loading ? {opacity: 0.5} : {},
                          ]}
                          onPress={async () => {
                            try {
                              await this.setStateAsync({
                                status: 'Processing...',
                                stage: 3,
                                explorerURL: '',
                                loading: true,
                              });
                              const tx = await this.payFromCard(token);
                              this.processPayment(tx);
                            } catch (error) {
                              console.log(error);
                            }
                            await this.setStateAsync({loading: false});
                          }}>
                          <Text style={GlobalStyles.buttonText}>
                            Pay with {token.symbol}
                          </Text>
                        </Pressable>
                      </View>
                    ))}
                </ScrollView>
              </React.Fragment>
            )}
            {
              // Stage 3
              this.state.stage === 3 && (
                <View
                  style={{
                    paddingVertical: 20,
                    alignItems: 'center',
                    height: '100%',
                    justifyContent: 'space-between',
                  }}>
                  <Image
                    source={checkMark}
                    alt="check"
                    style={{width: 200, height: 200}}
                  />
                  <Text
                    style={{
                      textShadowRadius: 1,
                      fontSize: 28,
                      fontWeight: 'bold',
                      color:
                        this.state.status === 'Confirmed'
                          ? mainColor
                          : secondaryColor,
                    }}>
                    {this.state.status}
                  </Text>
                  <View
                    style={[
                      GlobalStyles.networkShow,
                      {
                        width: Dimensions.get('screen').width * 0.9,
                      },
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
                          Card Payment
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
                        {this.state.transactionDisplay.icon}
                      </View>
                      <Text style={{color: 'white'}}>
                        {`${this.state.transactionDisplay.amount}`}{' '}
                        {this.state.transactionDisplay.name}
                      </Text>
                    </View>
                  </View>
                  <View style={GlobalStyles.buttonContainer}>
                    <Pressable
                      disabled={this.state.explorerURL === ''}
                      style={[
                        GlobalStyles.buttonStyle,
                        this.state.explorerURL === ''
                          ? {opacity: 0.5, borderColor: 'black'}
                          : {},
                      ]}
                      onPress={() => Linking.openURL(this.state.explorerURL)}>
                      <Text style={GlobalStyles.buttonText}>
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
                        this.state.explorerURL === ''
                          ? {opacity: 0.5, borderColor: 'black'}
                          : {},
                      ]}
                      onPress={async () => {
                        this.print();
                      }}
                      disabled={this.state.explorerURL === ''}>
                      <Text style={GlobalStyles.buttonText}>Show Receipt</Text>
                    </Pressable>
                    <Pressable
                      style={[
                        GlobalStyles.buttonStyle,
                        {
                          backgroundColor: tertiaryColor,
                          borderColor: tertiaryColor,
                        },
                        this.state.explorerURL === ''
                          ? {opacity: 0.5, borderColor: 'black'}
                          : {},
                      ]}
                      onPress={async () => {
                        this.setState({
                          stage: 0,
                          explorerURL: '',
                          check: 'Check',
                          status: 'Processing...',
                          errorText: '',
                          amount: '0.00', // "0.00"
                        });
                      }}
                      disabled={this.state.explorerURL === ''}>
                      <Text style={GlobalStyles.buttonText}>Done</Text>
                    </Pressable>
                  </View>
                </View>
              )
            }
          </View>
        </SafeAreaView>
        <View
          style={{
            position: 'absolute',
            bottom: -(Dimensions.get('screen').height * 1.1),
          }}>
          <QRCode
            value={
              this.state.explorerURL === ''
                ? 'placeholder'
                : this.state.explorerURL
            }
            size={Dimensions.get('window').width * 0.6}
            ecl="L"
            getRef={c => (this.svg = c)}
          />
        </View>
      </Fragment>
    );
  }
}

export default PaymentWallet;
