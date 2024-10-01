import {SOLANA_RPC} from '@env';
import {getAssociatedTokenAddressSync} from '@solana/spl-token';
import {Connection, PublicKey} from '@solana/web3.js';
import {ethers} from 'ethers';
import React, {Component} from 'react';
import {Pressable, RefreshControl, ScrollView, Text, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import IconFA from 'react-native-vector-icons/FontAwesome';
import IconIonicons from 'react-native-vector-icons/Ionicons';
import GlobalStyles, {mainColor} from '../../../styles/styles';
import {blockchain, refreshTime} from '../../../utils/constants';
import ContextModule from '../../../utils/contextModule';
import {
  arraySum,
  epsilonRound,
  getAsyncStorageValue,
  setAsyncStorageValue,
} from '../../../utils/utils';

const baseTab1State = {
  refreshing: false,
  nfcSupported: true,
};

class Tab1 extends Component {
  constructor(props) {
    super(props);
    this.state = baseTab1State;
    this.provider = new Connection(SOLANA_RPC, 'confirmed');
    this.controller = new AbortController();
  }
  static contextType = ContextModule;

  async componentDidMount() {
    console.log(this.context.value.publicKey);
    const lastRefresh = await this.getLastRefresh();
    if (Date.now() - lastRefresh >= refreshTime) {
      await setAsyncStorageValue({lastRefresh: Date.now().toString()});
      this.refresh();
    } else {
      console.log(
        `Next refresh Available: ${Math.round(
          (refreshTime - (Date.now() - lastRefresh)) / 1000,
        )} Seconds`,
      );
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

  async refresh() {
    await this.setStateAsync({refreshing: true});
    await Promise.all([this.getUSD(), this.getBalances()]);
    await this.setStateAsync({refreshing: false});
  }

  // Get Balances

  async getBalances() {
    const publicKey = new PublicKey(this.context.value.publicKeyCard);
    let tokens = [...blockchain.tokens];
    tokens.shift();
    const myHeaders = new Headers();
    myHeaders.append(
      'X-API-KEY',
      VYBE_APIKEY,
    );
    myHeaders.append('accept', 'application/json');
    const requestOptions = {
      method: 'GET',
      headers: myHeaders,
      redirect: 'follow',
    };

    fetch(
      `https://api.vybenetwork.xyz/account/token-balance/${publicKey}`,
      requestOptions,
    )
      .then(response => response.json())
      .then(async result => {
        const balancesTemp = [
          result.data.find(object => object["SOL"] === value).amount,
          result.data.find(object => object["USDC"] === value).amount,
          result.data.find(object => object["EUR"] === value).amount
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
      })
      .catch(error => console.error(error));
  }

  // USD Conversions

  async getUSD() {
    const array = blockchain.tokens.map(token => token.coingecko);
    var myHeaders = new Headers();
    myHeaders.append('accept', 'application/json');
    var requestOptions = {
      signal: this.controller.signal,
      method: 'GET',
      headers: myHeaders,
      redirect: 'follow',
    };
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${array.toString()}&vs_currencies=usd`,
      requestOptions,
    );
    const result = await response.json();
    const usdConversion = array.map(x => result[x].usd);
    setAsyncStorageValue({usdConversion});
    this.context.setValue({usdConversion});
  }

  async getLastRefresh() {
    try {
      const lastRefresh = await getAsyncStorageValue('lastRefresh');
      if (lastRefresh === null) throw 'Set First Date';
      return lastRefresh;
    } catch (err) {
      await setAsyncStorageValue({lastRefresh: '0'.toString()});
      return 0;
    }
  }

  render() {
    const iconSize = 38;
    return (
      <View
        style={{
          width: '100%',
          height: '100%',
        }}>
        <View style={GlobalStyles.balanceContainer}>
          <LinearGradient
            style={{
              justifyContent: 'center',
              alignItems: 'center',
              width: '100%',
              paddingVertical: 20,
            }}
            colors={['#000000', '#1a1a1a', '#000000']}>
            <Text style={GlobalStyles.title}>Account Balance</Text>
            <Text style={[GlobalStyles.balance]}>
              {`$ ${epsilonRound(
                arraySum(
                  this.context.value.balances.map(
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
              justifyContent: 'space-evenly',
              alignItems: 'center',
              width: '100%',
            }}>
            <View style={{justifyContent: 'center', alignItems: 'center'}}>
              <Pressable
                onPress={() => this.props.navigation.navigate('SendWallet')}
                style={GlobalStyles.singleButton}>
                <IconIonicons
                  name="arrow-up-outline"
                  size={iconSize}
                  color={'white'}
                />
              </Pressable>
              <Text style={GlobalStyles.singleButtonText}>Send</Text>
            </View>
            <View style={{justifyContent: 'center', alignItems: 'center'}}>
              <Pressable
                onPress={() => this.props.navigation.navigate('DepositWallet')}
                style={GlobalStyles.singleButton}>
                <IconIonicons
                  name="arrow-down-outline"
                  size={iconSize}
                  color={'white'}
                />
              </Pressable>
              <Text style={GlobalStyles.singleButtonText}>Receive</Text>
            </View>
            <View style={{justifyContent: 'center', alignItems: 'center'}}>
              <Pressable
                onPress={() =>
                  this.props.navigation.navigate('TopUp', {
                    crypto: true,
                  })
                }
                style={GlobalStyles.singleButton}>
                <IconFA name="dollar" size={iconSize} color={'white'} />
              </Pressable>
              <Text style={GlobalStyles.singleButtonText}>Top Up</Text>
            </View>
            {this.state.nfcSupported && (
              <View style={{justifyContent: 'center', alignItems: 'center'}}>
                <Pressable
                  onPress={() =>
                    this.props.navigation.navigate('PaymentWallet')
                  }
                  style={GlobalStyles.singleButton}>
                  <IconIonicons name="card" size={iconSize} color={'white'} />
                </Pressable>
                <Text style={GlobalStyles.singleButtonText}>{'Payment'}</Text>
              </View>
            )}
          </View>
        </View>
        <ScrollView
          refreshControl={
            <RefreshControl
              progressBackgroundColor={mainColor}
              refreshing={this.state.refreshing}
              onRefresh={async () => {
                await setAsyncStorageValue({
                  lastRefresh: Date.now().toString(),
                });
                await this.refresh();
              }}
            />
          }
          showsVerticalScrollIndicator={false}
          style={GlobalStyles.tokensContainer}
          contentContainerStyle={{
            justifyContent: 'flex-start',
            alignItems: 'center',
          }}>
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
                  <Text style={{fontSize: 18, color: 'white'}}>
                    {token.name}
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                    }}>
                    <Text style={{fontSize: 12, color: 'white'}}>
                      {this.context.value.balances[index] === 0
                        ? '0'
                        : this.context.value.balances[index] < 0.001
                        ? '<0.01'
                        : epsilonRound(
                            this.context.value.balances[index],
                            2,
                          )}{' '}
                      {token.symbol}
                    </Text>
                    <Text style={{fontSize: 12, color: 'white'}}>
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
                    this.context.value.balances[index] *
                      this.context.value.usdConversion[index],
                    2,
                  )}{' '}
                  USD
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }
}

export default Tab1;
