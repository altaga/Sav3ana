import { Image } from 'react-native';
import EURC from '../assets/logos/eurc.png';
import SOL from '../assets/logos/sol.png';
import USDC from '../assets/logos/usdc.png';
import USDT from '../assets/logos/usdt.png';
import WETH from '../assets/logos/weth.png';

const w = 50;
const h = 50;

export const refreshTime = 1000 * 60 * 1;

export const basePublicKey = '11111111111111111111111111111111';

export const iconsBlockchain = {
  sol: <Image source={SOL} style={{width: w, height: h, borderRadius: 10}} />,
  usdc: <Image source={USDC} style={{width: w, height: h, borderRadius: 10}} />,
  eurc: <Image source={EURC} style={{width: w, height: h, borderRadius: 10}} />,
  usdt: <Image source={USDT} style={{width: w, height: h, borderRadius: 10}} />,
  weth: <Image source={WETH} style={{width: w, height: h, borderRadius: 10}} />,
};

// Devnet
export const blockchain = {
  network: 'Solana',
  token: 'SOL',
  blockExplorer: 'https://solscan.io/',
  cluster: 'devnet', //mainnet
  iconSymbol: 'sol',
  decimals: 9,
  tokens: [
    // Updated 05/MAY/2024
    {
      name: 'Solana',
      symbol: 'SOL',
      address: 'So11111111111111111111111111111111111111112',
      decimals: 9,
      icon: iconsBlockchain.sol,
      coingecko: 'solana',
    },
    {
      name: 'USD Coin',
      symbol: 'USDC',
      address: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
      decimals: 6,
      icon: iconsBlockchain.usdc,
      coingecko: 'usd-coin',
    },
    {
      name: 'Euro Coin',
      symbol: 'EURC',
      address: 'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr',
      decimals: 6,
      icon: iconsBlockchain.eurc,
      coingecko: 'euro-coin',
    },
  ],
};

export const blockchainMain = {
  network: 'Solana',
  token: 'SOL',
  blockExplorer: 'https://solscan.io/',
  cluster: 'mainnet', //mainnet
  iconSymbol: 'sol',
  decimals: 9,
  tokens: [
    // Updated 05/MAY/2024
    {
      name: 'Solana',
      symbol: 'SOL',
      address: 'So11111111111111111111111111111111111111112',
      decimals: 9,
      icon: iconsBlockchain.sol,
      coingecko: 'solana',
    },
    {
      name: 'USD Coin',
      symbol: 'USDC',
      address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      decimals: 6,
      icon: iconsBlockchain.usdc,
      coingecko: 'usd-coin',
    },
    {
      name: 'Euro Coin',
      symbol: 'EURC',
      address: 'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr',
      decimals: 6,
      icon: iconsBlockchain.eurc,
      coingecko: 'euro-coin',
    },
    {
      name: 'Tether',
      symbol: 'USDT',
      address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      decimals: 6,
      icon: iconsBlockchain.usdt,
      coingecko: 'tether',
    },
  ],
};

export const CloudAccountController =
  '8MwdDuw66kKisAVmh6RjiP8QDMckUkM71fSGCC6c8vCH';

export const SolanaCardProgramID = 'FPc4TkPFx8hjYpnFGg4hTRVJf2CNkKNf8R2aYehybNvX';

export const CloudPublicKeyEncryption = `
-----BEGIN RSA PUBLIC KEY-----
MIIBCgKCAQEAtflt9yF4G1bPqTHtOch47UW9hkSi4u2EZDHYLLSKhGMwvHjajTM+
wcgxV8dlaTh1av/2dWb1EE3UMK0KF3CB3TZ4t/p+aQGhyfsGtBbXZuwZAd8CotTn
BLRckt6s3jPqDNR3XR9KbfXzFObNafXYzP9vCGQPdJQzuTSdx5mWcPpK147QfQbR
K0gmiDABYJMMUos8qaiKVQmSAwyg6Lce8x+mWvFAZD0PvaTNwYqcY6maIztT6h/W
mfQHzt9Z0nwQ7gv31KCw0Tlh7n7rMnDbr70+QVd8e3qMEgDYnx7Jm4BzHjr56IvC
g5atj1oLBlgH6N/9aUIlP5gkw89O3hYJ0QIDAQAB
-----END RSA PUBLIC KEY-----
`;

/*
  Debit = 0
  Credit = 1
*/

/*
  VISA = 0
  MASTERCARD = 1
  AMERICAN_EXPRESS = 2
*/

export const cardMemorySchema = {
  struct: {
    owner: { array: { type: "u8", len: 32 } },
    nfc: "bool", // Activate or Deactivate
    types: "bool", // Physical or Virtual 
    kind: "u8", // Debit, Credit, etc
    brand : "u8", // VISA, MASTERCARD, etc
  },
};

export const transactionPayloadSchema = {
  struct: {
    instruction: "u8",
    bump: "u8",
    space: "u8",
    ...cardMemorySchema.struct,
  },
};

export const paymentPayloadSchema = {
  struct: {
    instruction: "u8",
    bump: "u8",
    owner: { array: { type: "u8", len: 32 } },
    amount: "u64",
    concept: "string",
  },
};

export const ProgramInstruction = {
  CreateCard: 0,
  ChangeInfo: 1,
  Purchase: 2,
  PurchaseToken: 3,
};

