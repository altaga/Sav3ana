import {SOLANA_RPC, STRIPE_APIKEY, STRIPE_CLIENT} from '@env';
import {Connection} from '@solana/web3.js';
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

class Tab4 extends Component {
  constructor(props) {
    super(props);
    this.state = baseTab1State;
    this.provider = new Connection(SOLANA_RPC, 'confirmed');
    this.controller = new AbortController();
  }
  static contextType = ContextModule;

  async componentDidMount() {
    const lastRefresh = await this.getLastRefresh();
    if (Date.now() - lastRefresh >= refreshTime) {
      await setAsyncStorageValue({lastRefreshTrad: Date.now().toString()});
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
    await Promise.all([this.getBalances(), this.getUSD()]);
    await this.setStateAsync({refreshing: false});
  }

  // Get Balances

  async getBalances() {
    const myHeaders = new Headers();
    myHeaders.append('Authorization', `Bearer ${STRIPE_APIKEY}`);
    const requestOptions = {
      method: 'GET',
      headers: myHeaders,
      redirect: 'follow',
    };

    fetch(
      `https://api.stripe.com/v1/customers/${STRIPE_CLIENT}/cash_balance`,
      requestOptions,
    )
      .then(response => response.json())
      .then(async result => {
        if (result.error) {
          this.context.setValue({balancesTrad: [0.0, 0.0, 0.0]});
          await setAsyncStorageValue({balancesTrad: [0.0, 0.0, 0.0]});
        } else {
          let balancesTrad = [
            ethers.utils.formatUnits(
              result.available.usd ?? 0.0,
              blockchain.currencies[0].decimals,
            ),
            ethers.utils.formatUnits(
              result.available.eur ?? 0.0,
              blockchain.currencies[1].decimals,
            ),
            ethers.utils.formatUnits(
              result.available.mxn ?? 0.0,
              blockchain.currencies[2].decimals,
            ),
          ];
          console.log(balancesTrad);
          this.context.setValue({
            balancesTrad,
          });
          await setAsyncStorageValue({
            balancesTrad,
          });
        }
      })
      .catch(error => console.error(error));
  }

  async getUSD() {
    const array = blockchain.currencies.map(token => token.coingecko);
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
    const usdConversionTrad = array.map((x, index) =>
      index === 0 ? 1 : result[x].usd,
    );
    setAsyncStorageValue({usdConversionTrad});
    this.context.setValue({usdConversionTrad});
  }

  // USD Conversions

  async getLastRefresh() {
    try {
      const lastRefresh = await getAsyncStorageValue('lastRefreshTrad');
      if (lastRefresh === null) throw 'Set First Date';
      return lastRefresh;
    } catch (err) {
      await setAsyncStorageValue({lastRefreshTrad: '0'.toString()});
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
            <Text style={GlobalStyles.title}>TradFi Balance</Text>
            <Text style={[GlobalStyles.balance]}>
              {`$ ${epsilonRound(
                arraySum(this.context.value.balancesTrad),
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
                onPress={() => this.props.navigation.navigate('DepositTradFi')}
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
                    crypto: false,
                  })
                }
                style={GlobalStyles.singleButton}>
                <IconFA name="dollar" size={iconSize} color={'white'} />
              </Pressable>
              <Text style={GlobalStyles.singleButtonText}>Top Up</Text>
            </View>
          </View>
        </View>
        <ScrollView
          refreshControl={
            <RefreshControl
              progressBackgroundColor={mainColor}
              refreshing={this.state.refreshing}
              onRefresh={async () => {
                await setAsyncStorageValue({
                  lastRefreshTrad: Date.now().toString(),
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
          {blockchain.currencies.map((token, index) => (
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
                      {this.context.value.balancesTrad[index] === 0
                        ? '0'
                        : this.context.value.balancesTrad[index] < 0.01
                        ? '<0.01'
                        : epsilonRound(
                            this.context.value.balancesTrad[index],
                            2,
                          )}{' '}
                      {token.symbol}
                    </Text>
                    <Text style={{fontSize: 12, color: 'white'}}>
                      {`  -  ($${epsilonRound(
                        this.context.value.usdConversionTrad[index],
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
                    this.context.value.balancesTrad[index] *
                      this.context.value.usdConversionTrad[index],
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

export default Tab4;
