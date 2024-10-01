// Basic Imports
import React from 'react';
import {blockchain} from './constants';
import {Transaction} from '@solana/web3.js';

const ContextModule = React.createContext();

// Context Provider Component

class ContextProvider extends React.Component {
  // define all the values you want to use in the context
  constructor(props) {
    super(props);
    this.state = {
      value: {
        // Base Wallet
        publicKey: '11111111111111111111111111111111',
        balances: blockchain.tokens.map(() => 0),
        // Savings Wallet
        publicKeySavings: '11111111111111111111111111111111',
        balancesSavings: blockchain.tokens.map(() => 0),
        savingsFlag: false,
        periodSelected: 1,
        protocolSelected: 1,
        percentage: 1,
        savingsDate: 0,
        // Card Wallet
        publicKeyCard: '11111111111111111111111111111111',
        balancesCard: blockchain.tokens.map(() => 0),
        // Stripe
        balancesTrad: [0.0, 0.0, 0.0],
        //// Shared
        usdConversion: blockchain.tokens.map(() => '0.0'),
        usdConversionTrad: blockchain.currencies.map(() => '0.0'),
        // Transaction Active
        isTransactionActive: false, // false
        transactionData: {
          // Wallet Selection
          walletSelector: 0,
          // Commands
          command: 'transfer',
          // Transaction
          transaction: new Transaction(),
          // Single Display
          label: '',
          to: '',
          amount: 0.0,
          tokenSymbol: blockchain.token,
          // Bulk Display
          labelBulk: [''],
          toBulk: [''],
          amountBulk: [0.0],
          tokenSymbolBulk: [blockchain.token],
        },
      },
    };
  }

  setValue = (value, then = () => {}) => {
    this.setState(
      {
        value: {
          ...this.state.value,
          ...value,
        },
      },
      () => then(),
    );
  };

  render() {
    const {children} = this.props;
    const {value} = this.state;
    // Fill this object with the methods you want to pass down to the context
    const {setValue} = this;

    return (
      <ContextModule.Provider
        // Provide all the methods and values defined above
        value={{
          value,
          setValue,
        }}>
        {children}
      </ContextModule.Provider>
    );
  }
}

// Dont Change anything below this line

export {ContextProvider};
export const ContextConsumer = ContextModule.Consumer;
export default ContextModule;
