import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { serialize } from "borsh";
import bs58 from 'bs58';
import { Buffer } from "buffer";
import { programId as program } from "./constants.js";
import { feepayerPrivateKey, ownerPrivateKey } from "./secrets.js";

const ProgramInstruction = {
  CreateCard: 0,
  ChangeInfo: 1,
  Purchase: 2,
  PurchaseToken: 3,
};

const payloadSchema = {
  struct: {
    instruction: "u8",
    bump: "u8",
    owner: { array: { type: "u8", len: 32 } },
    amount: "u64",
    concept: "string",
  },
};

// program id
const programId = new PublicKey(program);

// connection
const connection = new Connection(clusterApiUrl("devnet"));

// setup fee payer
const feePayer = Keypair.fromSecretKey(
  bs58.decode(feepayerPrivateKey)
);

const owner = Keypair.fromSecretKey(
  bs58.decode(ownerPrivateKey)
);

const to = new PublicKey("8MwdDuw66kKisAVmh6RjiP8QDMckUkM71fSGCC6c8vCH");

// setup pda
let [pda, bump] = await PublicKey.findProgramAddressSync(
  [Buffer.from("card"), owner.publicKey.toBuffer()],
  programId
);

const kind = ProgramInstruction.Purchase;

const payload = {
  instruction: kind,
  bump,
  owner: owner.publicKey.toBuffer(),
  amount: 1_000,
  concept: "Testing transaction",
};

const data = Buffer.from(serialize(payloadSchema, payload));

let tx = new Transaction().add(
  new TransactionInstruction({
    keys: [
      {
        pubkey: feePayer.publicKey,
        isSigner: true,
        isWritable: true,
      },
      {
        pubkey: pda,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: to,
        isSigner: false,
        isWritable: true,
      },
    ],
    data,
    programId,
  })
);

// Send Solana Transaction
const transactionSignature = await sendAndConfirmTransaction(
  connection,
  tx,
  [feePayer]
);

console.log(
  "Explorer = ",
  `https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
);

const accounts = await connection.getProgramAccounts(programId);

console.log(`Accounts for program ${programId.toBase58()}: `);
console.log(accounts.map((item) => item.pubkey.toBase58()));
