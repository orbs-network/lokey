# LoKey

![LoKey](https://github.com/orbs-network/lokey/blob/main/images/lokey-banner.png?raw=true)

**LoKey** is a lightweight library that leverages ethers.js to securely delegate a signer and sign messages without prompting the user for each siging operation.

## Installation

To install LoKey, use npm:

```bash
npm install @orbs-network/lokey
```

## Usage

### Constructor: `LoKey(signTypedDataCallback: (payload) => Promise<string>)`

Initialise a new instance of LoKey.

Example:

```javascript
const lokey = new LoKey(async (payload) => {
  // Implement a function to sign the payload with your integrated EOA (e.g. MetaMask)
  return await signTypedDataAsync(payload);
});
```

**Inputs**:

- `signTypedDataCallback` (`(payload) => Promise<string>`, required): The callback to sign typed data.

**Outputs**:

- `lokey`: A new instance of the LoKey SDK.

---

### `createSigner(name: string, sessionExpiry?: number)`

Create a new signer.

Example:

```javascript
const { address, signature } = await lokey.createSigner();
```

**Outputs**:

- `address` (string): The hex string signer address.
- `signature` (string): The hex encoded signature of the delegated signer payload that needs to be sent to your backend to verify signatures.

---

### `sign(payload: any)`

Sign a message using the LoKey signer.

Example:

```javascript
const signature = await lokey.sign(payload);
```

**Inputs**:

- `payload` (any, required): Typed data according to EIP-712 standards.

**Outputs**:

- `signature` (string): The hex encoded signature.

---

## Example

To run the included example, follow these steps:

```bash
cd example
npm install
npm run dev
```

This demonstrates how to integrate LoKey into a React application.

## Notes

- LoKey leverages secure browser features like **Web Workers** for key management.

## License

LoKey is licensed under the MIT License.
