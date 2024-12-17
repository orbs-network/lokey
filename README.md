# LoKey

![LoKey](https://github.com/orbs-network/lokey/blob/main/src/images/lokey-logo2.png?raw=true)

LoKey is a lightweight library using web native WebAuthn and Crypto APIs to authenticate and sign transactions with a private key stored securely in an enclave on the user's device for a browser session.

LoKey also uses the browser's session storage to store insensitive data like the signer's public key.

## Usage

### constructor(appName: string)

```javascript
const lokey = new LoKey('LoKey Example App');
```

#### Inputs

- `appName`: The name of the application used when creating

#### Outputs

- `lokey`: An instance of LoKey SDK.

### createSigner(name: string, sessionExpiry?: number)

```javascript
const publicKey = await lokey.createSigner(
  'LoKey Signer' // name for signer
  Date.now() + 60 * 60 * 1000 // optional: session expiry set to 1 hour
);
```

#### Inputs

- `name`: The name yoy want to give the signer. This will displayed to the user when creating this credential.
- optional `sessionExpiry`: An optional timestamp for when you want the signer to expire.

#### Outputs

- `publicKey`: A base64 encoded public key.

### getSigner(publicKey: string)

```javascript
const { name, credentialId, publicKey } = await lokey.getSigner(publicKey);
```

#### Inputs

- `publicKey`: The base64 encoded public key of the signer you want to retrieve.

#### Outputs

- `signer`: An instance of the signer, which contains the `name`, `credentialId` and `publicKey` of the signer.

### getSigners()

```javascript
const signers = await lokey.getSigners();
```

#### Outputs

- `signers`: An array of all the signers in the current session.

### sign(publicKey: string, message: string)

```javascript
const { signature, data } = await lokey.sign(publicKey, message);
```

#### Inputs

- `publicKey`: The base64 encoded public key of the signer you want to use to sign the message.
- `message`: The string you want to sign.

#### Outputs

- `signature`: The base64 encoded signature.
- `data`: The base64 encoded data including the message that was signed.

### verify(publicKey: string, signature: string, data: string)

```javascript
const isVerified = await lokey.verify(publicKey, signature, data);
```

#### Inputs

- `publicKey`: The base64 encoded public key of the signer you want to use to verify the message.
- `signature`: The signatue string you received from signing a message.
- `data`: The data string you received from signing a message.

#### Outputs

- `isVerified`: A boolean indicating whether the signature was verified successfully.

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
