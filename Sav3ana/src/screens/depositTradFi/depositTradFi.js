import Clipboard from '@react-native-clipboard/clipboard';
import React, {Component} from 'react';
import {
  Dimensions,
  Pressable,
  SafeAreaView,
  Text,
  ToastAndroid,
  View,
} from 'react-native';
import IconIonicons from 'react-native-vector-icons/Ionicons';
import Header from '../../components/header';
import GlobalStyles, {mainColor, ratio} from '../../styles/styles';
import {blockchain} from '../../utils/constants';
import ContextModule from '../../utils/contextModule';
import * as Progress from 'react-native-progress';

class DepositTradFi extends Component {
  constructor(props) {
    super(props);
    this.state = {
      progress: 0,
      component: null,
    };
  }

  static contextType = ContextModule;

  componentDidMount() {
    setInterval(() => {
      if (this.state.progress < 1) {
        this.setState({
          progress: this.state.progress + 0.05,
        });
      }
    }, 1);
    setTimeout(() => {
      const QrAddress = require('./components/qrAddress').default;
      this.setState({
        component: <QrAddress />,
      });
    }, 1000);
  }

  render() {
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
          <Text style={GlobalStyles.exoTitle}>
            Receive USD
          </Text>
          {this.state.component === null ? (
            <View
              style={{
                aspectRatio: 1,
                width:
                  Dimensions.get('screen').width * (ratio > 1.7 ? 0.9 : 0.9),
                justifyContent: 'center',
                alignItems: 'center',
              }}>
              <Progress.Pie progress={this.state.progress} size={180} color={mainColor}/>
              <Text style={{color: 'white', fontSize: 16}}>Loading {Math.floor(this.state.progress * 100)}%</Text>
            </View>
          ) : (
            this.state.component
          )}
          <Text style={GlobalStyles.exoTitle}>
            TradFi eWallet
          </Text>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              width: '100%',
            }}>
            <Pressable
              style={[GlobalStyles.buttonStyle]}
              onPress={() => this.props.navigation.goBack()}>
              <Text style={[GlobalStyles.buttonText]}>Return</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }
}

export default DepositTradFi;
