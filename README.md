# LoKey

![LoKey](https://github.com/orbs-network/lokey/blob/main/src/images/lokey-banner.png?raw=true)

**LoKey** is a lightweight library that leverages web-native APIs, including **WebAuthn** and **Subtle Crypto**, to securely authenticate users and sign transactions. Private keys are stored within a secure enclave on the user’s device, ensuring robust protection.

Additionally, LoKey uses the browser’s local storage to manage non-sensitive data, such as the signer’s public key.

## Usage

### Constructor: `LoKey(appName: string)`

Initialise a new instance of LoKey.

Example:

```javascript
const lokey = new LoKey('LoKey Example App');
```

**Inputs**:

- `appName` (string, required): The name of your application.

**Outputs**:

- `lokey`: A new instance of the LoKey SDK.

---

### `createSigner(name: string, sessionExpiry?: number)`

Create a new signer and retrieve its public key.

Example:

```javascript
const publicKey = await lokey.createSigner(
  'LoKey Signer', // Name for the signer
  Date.now() + 60 * 60 * 1000 // Optional: Session expiry set to 1 hour
);
```

**Inputs**:

- `name` (string, required): A name for the signer. Displayed to the user.
- `sessionExpiry` (number, optional): A Unix timestamp when the signer expires.

**Outputs**:

- `publicKey` (string): The base64-encoded public key.

---

### `deleteSigner(publicKey: string)`

Delete a signer using its public key.

Example:

```javascript
lokey.deleteSigner(publicKey);
```

**Inputs**:

- `publicKey` (string, required): The base64-encoded public key of the signer to delete.

---

### `getSigner(publicKey: string)`

Retrieve details of a specific signer.

Example:

```javascript
const { name, credentialId, publicKey } = await lokey.getSigner(publicKey);
```

**Inputs**:

- `publicKey` (string, required): The base64-encoded public key of the signer.

**Outputs**:

- signer (object): Contains the following:
  - `name` (string): The name of the signer.
  - `credentialId` (string): The unique credential ID.
  - `publicKey` (string): The base64-encoded public key.

---

### `getSigners()`

Retrieve a list of all signers.

Example:

```javascript
const signers = await lokey.getSigners();
```

**Outputs**:

- `signers` (array): A list of all signers in the current session.

---

### `sign(publicKey: string, message: string)`

Sign a message using a signer’s private key.

Example:

```javascript
const { signature, data } = await lokey.sign(publicKey, message);
```

**Inputs**:

- `publicKey` (string, required): The base64-encoded public key.
- `message` (string, required): The message to sign.

**Outputs**:

- `signature` (string): The base64-encoded signature.
- `data` (string): The base64-encoded signed data, including the original message.

---

### `verify(publicKey: string, signature: string, data: string)`

Verify a signed message using the public key.

Example:

```javascript
const isVerified = await lokey.verify(publicKey, signature, data);
```

**Inputs**:

- `publicKey` (string, required): The base64-encoded public key.
- `signature` (string, required): The signature from signing the message.
- `data` (string, required): The signed data string.

**Outputs**:

- `isVerified` (boolean): true if the signature is valid, otherwise false.

## Example

To run the included example, follow these steps:

```bash
npm install
npm run build
cd example
npm install
npm run dev
```

This demonstrates how to integrate LoKey into a React application.

## Notes

- LoKey leverages secure browser features like **WebAuthn** and **Subtle Crypto** for key management.
- Non-sensitive data (e.g., public keys) is stored in local storage.
- Session expiry can be used to enforce key expiration.

## License

LoKey is licensed under the MIT License.
