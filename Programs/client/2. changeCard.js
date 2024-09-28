import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
  sendAndConfirmTransaction
} from "@solana/web3.js";
import { serialize } from "borsh";
import bs58 from 'bs58';
import { Buffer } from "buffer";
import { programId as program } from "./constants.js";
import { ownerPrivateKey } from "./secrets.js";

const ProgramInstruction = {
  CreateCard: 0,
  ChangeInfo: 1,
  Purchase: 2,
  PurchaseToken: 3,
};

const memorySchema = {
  struct: {
    owner: { array: { type: "u8", len: 32 } },
    nfc: "bool", // Activate or Deactivate
    types: "bool", // Physical or Virtual
    kind: "u8", // Debit, Credit, etc
    brand: "u8", // VISA, MASTERCARD, etc
  },
};

const payloadSchema = {
  struct: {
    instruction: "u8",
    bump: "u8",
    space: "u8",
    ...memorySchema.struct,
  },
};

// program id
const programId = new PublicKey(program);

// connection
const connection = new Connection(clusterApiUrl("devnet"));

const owner = Keypair.fromSecretKey(
  bs58.decode(ownerPrivateKey)
);

// setup pda
let [pda, bump] = await PublicKey.findProgramAddressSync(
  [Buffer.from("card"), owner.publicKey.toBuffer()],
  programId
);

const kind = ProgramInstruction.ChangeInfo;
const seedMemory = {
  owner: owner.publicKey.toBytes(),
  nfc: true,  
  types: false,
  kind: 0,
  brand : 0,
};
const space = serialize(memorySchema, seedMemory).length;
const instruction = {
  instruction: kind,
  bump,
  space,
  ...seedMemory,
};
const data = Buffer.from(serialize(payloadSchema, instruction));

console.log({
  bump,
  public_key: pda.toBase58(),
  size: space ?? 0,
});

let tx = new Transaction().add(
  new TransactionInstruction({
    keys: [
      {
        pubkey: owner.publicKey,
        isSigner: true,
        isWritable: true,
      },
      {
        pubkey: pda,
        isSigner: false,
        isWritable: true,
      }
    ],
    data,
    programId,
  })
);

// Send Solana Transaction
const transactionSignature = await sendAndConfirmTransaction(
  connection,
  new Transaction().add(tx),
  [owner]
);

console.log(
  "Explorer = ",
  `https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
);

const accounts = await connection.getProgramAccounts(programId);

console.log(`Accounts for program ${programId.toBase58()}: `);
console.log(accounts.map((item) => item.pubkey.toBase58()));
