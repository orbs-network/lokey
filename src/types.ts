export type LoKeySigner = {
  name: string;
  credentialId: string;
  // base64 encoded publicKey
  publicKey: string;
  sessionExpiry?: number;
};

export type LoKeyState = {
  signers: LoKeySigner[];
};

export type LoKeySignature = {
  // base64 encoded signature
  signature: string;
  // base64 encoded data
  data: string;
};
