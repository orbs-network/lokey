export class LoKey {
  key: CryptoKey | null = null;
  expiry: number | null = null;

  constructor() {
    console.log('LoKey constructor');

    if (typeof window === 'undefined') {
      throw new Error('LoKey can only be used in a browser environment.');
    }
  }

  async initializeSigner(expiry: number) {
    console.log('LoKey.create');
    // TODO: checks if there is already an existing signer created/stored
    // if not, create a new signer and store it

    // create a new signer
    if (this.expiry !== expiry) {
      this.expiry = expiry;
    }

    try {
      this.key = await window.crypto.subtle.generateKey(
        {
          name: 'HMAC',
          hash: { name: 'SHA-512' },
        },
        false,
        ['sign', 'verify']
      );
      console.log('LoKey.create: key created!', this.key);
    } catch (error) {
      console.error('LoKey.create: error', error);
    }
  }

  async sign(message: string) {
    console.log('LoKey.sign', message);

    if (!this.key) {
      throw new Error('LoKey.sign: key is not initialized');
    }

    const encoder = new TextEncoder();
    const payload = encoder.encode(message);

    const signature = await window.crypto.subtle.sign({ name: 'HMAC' }, this.key, payload);
    const binStr = String.fromCodePoint(...new Uint8Array(signature));
    const signatureBase64 = btoa(binStr);
    console.log('LoKey.sign: signature', signatureBase64);
    return signatureBase64;
  }
}
