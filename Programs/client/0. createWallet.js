import {
  Keypair
} from "@solana/web3.js";
import bs58 from 'bs58';

const wallet = new Keypair();
const walletPublicKey = wallet.publicKey.toBase58();
const walletPrivateKey = wallet.secretKey;
const privateKeyString = bs58.encode(walletPrivateKey);

console.log({
  walletPublicKey,
  walletPrivateKey,
  privateKeyString
})