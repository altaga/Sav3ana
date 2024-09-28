const functions = require("@google-cloud/functions-framework");
const crypto = require("crypto");
const Firestore = require("@google-cloud/firestore");
const {serialize} = require('borsh');
const { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction, clusterApiUrl } = require("@solana/web3.js");
const {
  createAssociatedTokenAccountInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} = require('@solana/spl-token');

const privateKey = ``

const connection = new Connection(clusterApiUrl("devnet"));
const feePayer = Keypair.fromSecretKey(
  Uint8Array.from([ YOUR_PRIV_KEY ])
);

const programId = new PublicKey('FPc4TkPFx8hjYpnFGg4hTRVJf2CNkKNf8R2aYehybNvX');

const ProgramInstruction = {
  CreateCard: 0,
  ChangeInfo: 1,
  Purchase: 2,
  PurchaseToken: 3,
};

const paymentPayloadSchema = {
  struct: {
    instruction: "u8",
    bump: "u8",
    owner: { array: { type: "u8", len: 32 } },
    amount: "u64",
    concept: "string",
  },
};

const db = new Firestore({
  projectId: "YOUR_PROJECT",
  keyFilename: "credential.json",
});

const Accounts = db.collection("YOUR_DB");

functions.http("helloHttp", async (req, res) => {
  try {
    const decrypted = decryptText(req.body.data);
    const toAddress = req.body.toAddress;
    const amount = req.body.amount;
    const tokenAddress = req.body.tokenAddress;
    const decimals = req.body.decimals;
    const concept =  req.body.concept;
    const query = await Accounts.where(
      "cardHash",
      "==",
      decrypted.toString()
    ).get();
    if (query.empty) {
      throw "Query Empty";
    } else {
        let transactionSignature;
        const owner = new PublicKey(query.docs[0].data().pubKey);
        const to = new PublicKey(toAddress);
        let [pda,bump] = await PublicKey.findProgramAddressSync(
            [Buffer.from("card"), owner.toBuffer()],
            programId
        );
        let tx = new Transaction()
        if(tokenAddress ==='So11111111111111111111111111111111111111112'){
            const payload = {
                instruction: ProgramInstruction.Purchase,
                bump,
                owner: owner.toBuffer(),
                amount: Math.round(amount*Math.pow(10,decimals)),
                concept
            };
            const data = Buffer.from(serialize(paymentPayloadSchema, payload));
            tx.add(
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
            transactionSignature = await sendAndConfirmTransaction(
                connection,
                tx,
                [feePayer]
            );
        }
        else{
            const payload = {
                instruction: ProgramInstruction.PurchaseToken,
                bump,
                owner: owner.toBuffer(),
                amount: Math.round(amount*Math.pow(10,decimals)),
                concept
            };
            const mint = new PublicKey(tokenAddress);
            const data = Buffer.from(serialize(paymentPayloadSchema, payload));
            const token_source = getAssociatedTokenAddressSync(
                mint,
                pda,
                true,
            )
            const token_destination = getAssociatedTokenAddressSync(
                mint,
                owner,
                true,
            )
            const exist = await checkExist(token_destination);
            if (!exist) {
                tx.add(
                        createAssociatedTokenAccountInstruction(
                        feePayer,
                        token_destination,
                        pda,
                        mint,
                        TOKEN_PROGRAM_ID,
                    ),
                );
            }
            tx.add(
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
            )
            transactionSignature = await sendAndConfirmTransaction(
                connection,
                tx,
                [feePayer]
            );
            
        }    
        res.send(transactionSignature);
    }
  } catch (e) {
    console.log(e)
    res.send(`Bad Request`);
  }
});

function decryptText(encryptedText) {
  return crypto.privateDecrypt(
    {
      key: privateKey,
    },
    Buffer.from(encryptedText, "base64")
  );
}

async function checkExist(account) {
    try {
        await getAccount(connection, account, 'confirmed', TOKEN_PROGRAM_ID);
        return true;
    } catch (error) {
        return false;
    }
}