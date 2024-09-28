import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  TransactionInstruction
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
const to = new PublicKey("2eQRXRxDZBQjvhHsr1CfTLi7YxmL54y61aZsGpiEzp9t");
const mint = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

let [pda, bump] = await PublicKey.findProgramAddressSync(
  [Buffer.from("card"), owner.publicKey.toBuffer()],
  programId
);

const token_source = getAssociatedTokenAddressSync(
  mint,
  pda,
  true,
)

const token_destination = getAssociatedTokenAddressSync(
  mint,
  to,
  true,
)

console.log(pda.toBase58());
console.log(token_source.toBase58());
console.log(token_destination.toBase58());

// setup pda

const payload = {
  instruction: ProgramInstruction.PurchaseToken,
  bump,
  owner: owner.publicKey.toBuffer(),
  amount: 100,
  concept: "Testing transaction",
};

const data = Buffer.from(serialize(payloadSchema, payload));

let tx = new Transaction().add(
  new TransactionInstruction({
    keys: [
      {
        pubkey: feePayer.publicKey,
        isSigner: true,
        isWritable: false,
      },
      {
        pubkey: pda,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: token_source,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: token_destination,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false,  
      },
      {
        pubkey: programId,
        isSigner: false,
        isWritable: false,
      }
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
