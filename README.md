# LoKey

![LoKey](https://github.com/orbs-network/lokey/blob/main/images/lokey-banner.png?raw=true)

**LoKey** is a lightweight library that leverages ethers.js to securely delegate a signer and sign messages without prompting the user for each siging operation.

## Installation

To install LoKey, use npm:

```bash
npm install @orbs-network/lokey
```

## Usage

### Constructor: `LoKey(opts?: { debug?: boolean })`

Initialise a new instance of LoKey.

Example:

```javascript
// Without debugging
const lokey = new LoKey();

// With debugging enabled
const lokey = new LoKey({ debug: true });
```

**Inputs**:

- `opts.debug` (boolean, optional): Enable debug logging. Default: `false`

**Outputs**:

- `lokey`: A new instance of the LoKey SDK.

---

### `setDebug(enabled: boolean)`

Enable or disable debug logging at runtime.

Example:

```javascript
// Enable debugging
await lokey.setDebug(true);

// Disable debugging
await lokey.setDebug(false);
```

**Inputs**:

- `enabled` (boolean, required): Whether to enable debug logging

**Outputs**:

- `success` (boolean): Whether the debug mode was set successfully.

---

### `getAddress(id: string)`

Get the address of the signer.

Example:

```javascript
const address = await lokey.getAddress('my-signer');
```

**Inputs**:

- `id` (string, required): The id of the signer to get the address of.

**Outputs**:

- `address` (string): The address of the signer.

---

### `createSigner(id: string)`

Create a new signer.

Example:

```javascript
const { address } = await lokey.createSigner('my-signer');
```

**Inputs**:

- `id` (string, required): The id of the signer to create.

**Outputs**:

- `address` (string): The hex string signer address.

---

### `sign(id: string, payload: TypedData)`

Sign a message using the LoKey signer.

Example:

```javascript
const signature = await lokey.sign('my-signer', payload);
```

**Inputs**:

- `id` (string, required): The id of the signer to use.
- `payload` (TypedData, required): Typed data according to EIP-712 standards.

**Outputs**:

- `signature` (string): The hex encoded signature.

---

### `persistKey(id: string)`

Persist the signer.

Example:

```javascript
await lokey.persistKey('my-signer');
```

**Inputs**:

- `id` (string, required): The id of the signer to persist.

**Outputs**:

- `success` (boolean): Whether the key was persisted successfully.

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
