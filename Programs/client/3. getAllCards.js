import { clusterApiUrl, Connection, PublicKey } from "@solana/web3.js";
import { programId as program } from "./constants.js";

// program id
const programId = new PublicKey(program);

// connection
const connection = new Connection(clusterApiUrl("devnet"));

let filter = [
  {
    dataSize: 36, // number of bytes
  }
];

const accounts = await connection.getProgramAccounts(programId, {
  filters: filter,
});

console.log(accounts.map(account => account.pubkey.toString()));