export type LoKeySigner = {
  publicKey: string;
  name: string;
  privateKey: CryptoKey;
  sessionExpiry: number;
};

export type LoKeySignerDbItem = {
  publicKey: string; // Used as id
  name: string;
  encryptedKey: Uint8Array;
  salt: Uint8Array;
  iv: Uint8Array;
  sessionExpiry: number;
};

export type LoKeySignature = {
  signature: string;
  data: string;
};
