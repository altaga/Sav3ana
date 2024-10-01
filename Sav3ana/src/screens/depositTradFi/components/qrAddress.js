import {Dimensions, Text, View} from 'react-native';
import React, {Component} from 'react';
import QRCodeStyled from 'react-native-qrcode-styled';
import ContextModule from '../../../utils/contextModule';
import {ratio} from '../../../styles/styles';
import {STRIPE_CLIENT}  from '@env';

export default class QrAddress extends Component {
  constructor(props) {
    super(props);
  }

  static contextType = ContextModule;
  render() {
    return (
      <QRCodeStyled
        maxSize={Dimensions.get('screen').width * (ratio > 1.7 ? 0.8 : 0.5)}
        data={STRIPE_CLIENT}
        style={[
          {
            backgroundColor: 'white',
            borderRadius: 10,
          },
        ]}
        errorCorrectionLevel="H"
        padding={16}
        //pieceSize={10}
        pieceBorderRadius={4}
        isPiecesGlued
        color={'black'}
      />
    );
  }
}
