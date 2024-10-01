const functions = require('@google-cloud/functions-framework');
const {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} = require('@solana/spl-token');
const {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
  Keypair
} = require('@solana/web3.js')

const connection = new Connection(clusterApiUrl("devnet"));
const feePayer = Keypair.fromSecretKey(
  Uint8Array.from([ YOUR_PRIV_KEY ])
);

functions.http('helloHttp', async (req, res) => {
  const amount = req.body.amount;
  const customer = req.body.customer;
  if(!req.body.crypto){ // From Crypto To TradFi
      const myHeaders = new Headers();
      myHeaders.append("Content-Type", "application/x-www-form-urlencoded");
      myHeaders.append("Authorization", "Basic YOUR_API_KEY");

      const urlencoded = new URLSearchParams();
      urlencoded.append("amount", (amount*100).toString());
      urlencoded.append("currency", "usd");

      const requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: urlencoded,
      redirect: "follow"
      };

      fetch(`https://api.stripe.com/v1/test_helpers/customers/${customer}/fund_cash_balance`, requestOptions)
      .then((response) => response.json())
      .then((result) => {
        if(result.type = "funded")
          {
            res.send(`ok`)
          }
        else
          {
            res.send(`BAD PAYMENT!`)
          }
        }
      )
      .catch(() => res.send(`BAD REQUEST!`))
  }else{ // From TradFi to Crypto
    const myHeaderss = new Headers();
    myHeaderss.append('accept', 'application/json');
    let requestOptionss = {
        method: 'GET',
        headers: myHeaderss,
        redirect: 'follow',
    };
    const publicKey = req.body.publicKey;
    const tokenAddress = req.body.tokenAddress;
    const tokenGekko = req.body.tokenGekko;
    const decimals = req.body.tokenDecimals;
    const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${tokenGekko}&vs_currencies=usd`,
        requestOptionss,
    );
    const result = await response.json();
    const usdConversion = result[tokenGekko].usd;
    let tokenAmount =  amount/usdConversion;
    let tx = new Transaction()  
    if(tokenAddress ==='So11111111111111111111111111111111111111112'){
        tx.add(
        SystemProgram.transfer({
            fromPubkey: new PublicKey(feePayer.publicKey),
            toPubkey: new PublicKey(publicKey),
            lamports: Math.round(tokenAmount*Math.pow(10,decimals)),
        })
        )
    }
    else{
        const tokenAccountFrom = getAssociatedTokenAddressSync(
        new PublicKey(tokenAddress),
        new PublicKey(feePayer.publicKey),
        );
        const tokenAccountTo = getAssociatedTokenAddressSync(
        new PublicKey(tokenAddress),
        new PublicKey(publicKey),
        true,
        );
        const exist = await checkExist(tokenAccountTo);
        if (!exist) {
        tx.add(
            createAssociatedTokenAccountInstruction(
            new PublicKey(feePayer.publicKey),
            tokenAccountTo,
            new PublicKey(publicKey),
            new PublicKey(tokenAddress),
            TOKEN_PROGRAM_ID,
            ),
        );
        }
        tx.add(
        createTransferInstruction(
            tokenAccountFrom,
            tokenAccountTo,
            new PublicKey(feePayer.publicKey),
            Math.round(tokenAmount*Math.pow(10,decimals)),
        ),
        )
    }
    const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.recentBlockhash = recentBlockhash;
    tx.feePayer = feePayer.publicKey;
    tx.sign(feePayer)
    await connection.sendRawTransaction(
        tx.serialize(),
        {
        maxRetries: 5,
        },
    );
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/x-www-form-urlencoded");
    myHeaders.append("Authorization", "Bearer YOUR_API_KEY");

    const urlencoded = new URLSearchParams();
    urlencoded.append("payment_method_types[]", "customer_balance");
    urlencoded.append("payment_method_options[customer_balance][funding_type]", "bank_transfer");
    urlencoded.append("payment_method_options[customer_balance][bank_transfer][type]", "us_bank_transfer");
    urlencoded.append("amount", Math.round(amount*100).toString());
    urlencoded.append("capture_method", "automatic");
    urlencoded.append("confirm", "true");
    urlencoded.append("currency", "usd");
    urlencoded.append("payment_method_data[type]", "customer_balance");
    urlencoded.append("customer", customer);
    urlencoded.append("description", `Transfer USD to ${tokenGekko}`);

    const requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: urlencoded,
    redirect: "follow"
    };

    fetch("https://api.stripe.com/v1/payment_intents", requestOptions)
    .then((response) => response.json())
    .then((result) => {
        if(result.status = "succeeded")
        {
            res.send(`ok`)
        }
        else
        {
            res.send(`BAD PAYMENT!`)
        }
        }
    )
    .catch(() => res.send(`BAD REQUEST!`))
  }  
});

  async function checkExist(account) {
    try {
      await getAccount(connection, account, 'confirmed', TOKEN_PROGRAM_ID);
      return true;
    } catch (error) {
      return false;
    }
  }