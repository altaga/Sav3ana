import { clusterApiUrl, Connection, Keypair, PublicKey } from "@solana/web3.js";
import { deserialize } from "borsh";
import { programId as program } from "./constants.js";
import { feepayerPrivateKey, ownerPrivateKey } from "./secrets.js";

// program id
const programId = new PublicKey(program);

// connection
const connection = new Connection(clusterApiUrl("devnet"));

const feePayer = Keypair.fromSecretKey(
  bs58.decode(feepayerPrivateKey)
);

const owner = Keypair.fromSecretKey(
  bs58.decode(ownerPrivateKey)
);

let filter = [
  {
    dataSize: 36, // number of bytes
  },
  {
    memcmp: {
      offset: 0,
      bytes: owner.publicKey.toString(),
    },
  },
];

const memorySchema = {
  struct: {
    owner: { array: { type: "u8", len: 32 } },
    nfc: "bool", // Activate or Deactivate
    types: "bool", // Physical or Virtual 
    kind: "u8", // Debit, Credit, etc
    brand : "u8", // VISA, MASTERCARD, etc
  },
};

const accounts = await connection.getProgramAccounts(programId, {
  filters: filter,
});

if (accounts.length === 0) {
  console.log("No accounts found");
} else {
  const account = deserialize(memorySchema, accounts[0].account.data);
  const cardAccount = {
    ...account,
    publicKey : accounts[0].pubkey.toString(),
    owner: new PublicKey(account.owner).toBase58(),
  }
  console.log(cardAccount);
}
