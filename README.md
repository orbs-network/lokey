# LoKey

![LoKey](https://github.com/orbs-network/lokey/blob/main/src/images/lokey-logo2.png?raw=true)

LoKey is a lightweight library using web native WebAuthn and Crypto APIs to authenticate and sign transactions with a private key stored securely on the user's device.

LoKey also uses the browser's session storage to store insensitive data like the signer's public key.

## Usage

### constructor(appName: string)

```javascript
const lokey = new LoKey(
  'LoKey Signer' // The name of your app
);
```

### createSigner(name: string, sessionExpiry: number)

```javascript
const publicKey = await lokey.createSigner(
  'LoKey Signer', // name for signer
  Date.now() + 60 * 60 * 1000 // session expiry set to 1 hour
);
```

### getSigner(publicKey: string)

```javascript
const { name, credentialId, publicKey, sessionExpiry } = await lokey.getSigner(publicKey);
```

### getSigners()

```javascript
const signers = await lokey.getSigners();
```

### sign(publicKey: string, message: string)

```javascript
const { signature, data } = await lokey.sign(publicKey, message);
```

### verify(publicKeyBase64: string, signature: string, data: string)

```javascript
const isVerified = await lokey.verify(publicKey, signature, data);
```

## Example

To run the example, follow these steps:

```bash
npm install
npm run build
cd example
npm install
npm run dev
```

The example demonstrates how you can use this library in a React app.
