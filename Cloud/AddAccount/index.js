const functions = require('@google-cloud/functions-framework');
const crypto = require("crypto");
const Firestore = require("@google-cloud/firestore");

const privateKey = ``

const db = new Firestore({
  projectId: "YOUR_PROJECT",
  keyFilename: "credential.json",
});

const Accounts = db.collection("YOUR_DB");

functions.http('helloHttp', async (req, res) => {
   try {
    const decrypted = decryptText(req.body.data);
    const pubKey = req.body.pubKey;
    const pda = req.body.pda;
    const query = await Accounts.where("pubKey", "==", pubKey).get();
    if (query.empty) {
      await Accounts.doc(pubKey).set({
        cardHash: decrypted.toString(),
        pubKey: pubKey,
        cardPublicKey:pda
      });
      res.send(cardPublicKey);
    } else {
      throw "Bad Request";
    }
  } catch (e) {
    res.send(`Bad Request`);
  }
});

// utils

function decryptText(encryptedText) {
  return crypto.privateDecrypt(
    {
      key: privateKey,
    },
    Buffer.from(encryptedText, "base64")
  );
}