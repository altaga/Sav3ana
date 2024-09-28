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
    const query = await Accounts.where("cardHash", "==", decrypted.toString()).get();
    if (query.empty) {
      res.send(`Bad Request`);
    } else {
      const cardPublicKey = query.docs[0].data().cardPublicKey;
      res.send(cardPublicKey);
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