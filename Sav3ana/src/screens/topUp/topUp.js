import {GOOGLE_URL_API, SOLANA_RPC, STRIPE_CLIENT} from '@env';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import React, {Component} from 'react';
import {
  Alert,
  Dimensions,
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  View,
} from 'react-native';
import RNPickerSelect from 'react-native-picker-select';
import IconIonicons from 'react-native-vector-icons/Ionicons';
import Header from '../../components/header';
import GlobalStyles from '../../styles/styles';
import ContextModule from '../../utils/contextModule';
import {blockchain, CloudAccountController} from '../../utils/constants';
import {createTransferInstruction, getAssociatedTokenAddressSync} from '@solana/spl-token';
import { getEncryptedStorageValue } from '../../utils/utils';

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

class TopUp extends Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: false,
      crypto: this.props.route.params?.crypto ?? false,
      amount: '', //
      tokenSelected: setTokens(blockchain.tokens)[0], // ""
      currencySelected: setTokens(blockchain.currencies)[0], // ""
    };
    this.provider = new Connection(SOLANA_RPC, 'confirmed');
    this.currencies = [setTokens(blockchain.currencies)[0]];
    this.tokens = setTokens(blockchain.tokens);
  }

  static contextType = ContextModule;

  componentDidMount() {
    console.log(this.props.route.params?.crypto ?? false);
  }

  async bulkTransfer() {
    return new Promise(async (resolve, reject) => {
      if (!this.state.crypto) {
        const tx = new Transaction();
        const tokenAmount = Math.floor(
          (this.state.amount / this.context.value.usdConversion[this.state.tokenSelected.index]) *
            10 ** this.state.tokenSelected.decimals,
        )
        if (this.state.tokenSelected.key === 'SOL') {
          tx.add(
            SystemProgram.transfer({
              fromPubkey: new PublicKey(this.context.value.publicKey),
              toPubkey: new PublicKey(CloudAccountController),
              lamports: tokenAmount,
            }),
          );
        } else {
          const tokenAccountFrom = getAssociatedTokenAddressSync(
            new PublicKey(this.state.tokenSelected.address),
            new PublicKey(this.context.value.publicKey),
          );
          const tokenAccountTo = getAssociatedTokenAddressSync(
            new PublicKey(this.state.tokenSelected.address),
            new PublicKey(CloudAccountController),
            true,
          );
          tx.add(
            createTransferInstruction(
              tokenAccountFrom,
              tokenAccountTo,
              new PublicKey(this.context.value.publicKey),
              tokenAmount,
            ),
          );
        }
        const privateKey = await getEncryptedStorageValue('privateKey');
        const wallet = Keypair.fromSecretKey(
          Uint8Array.from(privateKey.split(',')),
        );
        const recentBlockhash = (await this.provider.getLatestBlockhash())
          .blockhash;
        tx.recentBlockhash = recentBlockhash;
        tx.feePayer = wallet.publicKey;
        tx.sign(wallet);
        await this.provider.sendRawTransaction(tx.serialize(), {
          maxRetries: 5,
        });
        const myHeaders = new Headers();
        myHeaders.append('Content-Type', 'application/json');
        const raw = JSON.stringify({
          amount: this.state.amount,
          customer: STRIPE_CLIENT,
          publicKey: this.context.value.publicKey,
          tokenAddress: this.state.tokenSelected.address,
          tokenGekko: this.state.tokenSelected.coingecko,
          tokenDecimals: this.state.tokenSelected.decimals,
          crypto: this.state.crypto,
        });
        console.log(raw);
        const requestOptions = {
          method: 'POST',
          headers: myHeaders,
          body: raw,
          redirect: 'follow',
        };
        fetch(`${GOOGLE_URL_API}/TopUp`, requestOptions)
          .then(response => response.text())
          .then(result => {
            if (result === 'ok') {
              Alert.alert('Success');
            } else {
              Alert.alert('Error');
            }
            resolve();
          })
          .catch(error => reject(error));
      } else {
        const myHeaders = new Headers();
        myHeaders.append('Content-Type', 'application/json');
        const raw = JSON.stringify({
          amount: this.state.amount,
          customer: STRIPE_CLIENT,
          publicKey: this.context.value.publicKey,
          tokenAddress: this.state.tokenSelected.address,
          tokenGekko: this.state.tokenSelected.coingecko,
          tokenDecimals: this.state.tokenSelected.decimals,
          crypto: this.state.crypto,
        });
        console.log(raw);
        const requestOptions = {
          method: 'POST',
          headers: myHeaders,
          body: raw,
          redirect: 'follow',
        };
        fetch(`${GOOGLE_URL_API}/TopUp`, requestOptions)
          .then(response => response.text())
          .then(result => {
            if (result === 'ok') {
              Alert.alert('Success');
            } else {
              Alert.alert('Error');
            }
            resolve();
          })
          .catch(error => reject(error));
      }
    });
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

  render() {
    const iconSize = 24;
    return (
      <SafeAreaView style={[GlobalStyles.container]}>
        <Header />
        <View
          style={[
            GlobalStyles.mainFull,
            {
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingVertical: 20,
            },
          ]}>
          <View
            style={{
              alignItems: 'center',
            }}>
            <Text style={GlobalStyles.formTitleCard}>
              {!this.state.crypto ? 'From Crypto' : 'From TradFi'}
            </Text>
            {!this.state.crypto ? (
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
                value={this.state.tokenSelected.value}
                items={this.tokens}
                onValueChange={token => {
                  this.setState({
                    tokenSelected: this.tokens[token],
                  });
                }}
              />
            ) : (
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
                value={this.state.currencySelected.value}
                items={this.currencies}
                onValueChange={currency => {
                  this.setState({
                    currencySelected: this.currencies[currency],
                  });
                }}
              />
            )}
            <Pressable
              disabled={this.state.loading}
              style={[
                GlobalStyles.buttonStyleDot,
                {
                  width: 40,
                  height: 40,
                },
              ]}
              onPress={() => {
                this.setState({crypto: !this.state.crypto});
              }}>
              <IconIonicons
                name="swap-vertical"
                size={iconSize}
                color={'white'}
              />
            </Pressable>
            <Text style={GlobalStyles.formTitleCard}>
              {this.state.crypto ? 'To Crypto' : 'To TradFi'}
            </Text>
            {this.state.crypto ? (
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
                value={this.state.tokenSelected.value}
                items={this.tokens}
                onValueChange={token => {
                  this.setState({
                    tokenSelected: this.tokens[token],
                  });
                }}
              />
            ) : (
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
                value={this.state.currencySelected.value}
                items={this.currencies}
                onValueChange={currency => {
                  this.setState({
                    currencySelected: this.currencies[currency],
                  });
                }}
              />
            )}
            <Text style={GlobalStyles.formTitleCard}>Amount (USD)</Text>
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
                  value={this.state.amount}
                  onChangeText={amount => {
                    this.setState({amount});
                  }}
                />
              </View>
            </View>
          </View>
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
              {this.state.loading ? 'Loading...' : 'Top Up'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }
}

export default TopUp;
