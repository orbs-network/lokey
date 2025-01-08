import { LoKeySignature, LoKeySigner, LoKeySignerDbItem } from './types';
import { fromBase64, toBase64 } from './utils';

// TODO: Delete expired signers from IndexedDB

export class LoKey {
  private _activeSigner: LoKeySigner | null = null;

  constructor() {
    if (
      typeof globalThis.window === 'undefined' ||
      !(
        globalThis.PublicKeyCredential !== undefined &&
        typeof globalThis.PublicKeyCredential === 'function'
      )
    ) {
      throw new Error('LoKey can only be used in a browser environment.');
    }
  }

  get activeSigner() {
    return this._activeSigner;
  }

  async login(password: string, sessionExpiry = 0) {
    let mainKey: LoKeySigner;

    try {
      const publicKey = window.localStorage.getItem('loKeySigner');
      if (publicKey) {
        const { signer, signerDbItem } = await this.loadKey(password, publicKey);
        if (signer.sessionExpiry < Date.now()) {
          // update session
          await this.storeEncryptedKey({ ...signerDbItem, sessionExpiry });
        }
        mainKey = { ...signer, sessionExpiry };
      } else {
        throw new Error('No public key found, creating a new signer.');
      }
    } catch (error) {
      console.warn('Failed to load existing signer, creating a new one:', error);
      mainKey = await this.createSigner(password, 'main', sessionExpiry);
      window.localStorage.setItem('loKeySigner', mainKey.publicKey);
    }

    this._activeSigner = mainKey;
  }

  async sign(message: string): Promise<LoKeySignature> {
    if (!this._activeSigner) {
      throw new Error('Signer not found.');
    }

    if (this._activeSigner.sessionExpiry !== 0 && this._activeSigner.sessionExpiry < Date.now()) {
      this._activeSigner = null;
      throw new Error('Signer expired.');
    }

    const data = new TextEncoder().encode(message);

    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      this._activeSigner.privateKey,
      data
    );

    return {
      signature: toBase64(signature),
      data: toBase64(data),
    };
  }

  async verify(signature: string, data: string): Promise<boolean> {
    if (!this._activeSigner) {
      throw new Error('Signer not found.');
    }

    const publicKeyBuffer = fromBase64(this._activeSigner.publicKey);
    const importedPublicKey = await window.crypto.subtle.importKey(
      'spki',
      publicKeyBuffer,
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['verify']
    );

    const signatureBuffer = fromBase64(signature);
    const dataBuffer = fromBase64(data);

    // Verify the signature
    const isValid = await window.crypto.subtle.verify(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      importedPublicKey,
      signatureBuffer,
      dataBuffer
    );

    return isValid;
  }

  private async deriveEncryptionKey(password: string, salt: Uint8Array) {
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000, // Adjust iterations for security vs performance
        hash: 'SHA-256',
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  private async exportAndEncryptPrivateKey(privateKey: CryptoKey, password: string) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16)); // Random salt
    const encryptionKey = await this.deriveEncryptionKey(password, salt);

    const privateKeyBuffer = await window.crypto.subtle.exportKey('pkcs8', privateKey);

    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // Initialization Vector
    const encryptedPrivateKey = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      encryptionKey,
      privateKeyBuffer
    );

    return {
      encryptedPrivateKey: new Uint8Array(encryptedPrivateKey),
      salt,
      iv,
    };
  }

  private async storeEncryptedKey(signer: LoKeySignerDbItem) {
    const dbRequest = window.indexedDB.open('LoKeyDB', 1);

    dbRequest.onupgradeneeded = () => {
      const db = dbRequest.result;
      db.createObjectStore('signers', { keyPath: 'publicKey' });
    };

    dbRequest.onsuccess = () => {
      const db = dbRequest.result;
      const store = db.transaction('signers', 'readwrite').objectStore('signers');

      store.put(signer);
    };
  }

  private async loadKey(password: string, publicKey: string) {
    const dbRequest = window.indexedDB.open('LoKeyDB', 1);

    return new Promise<{ signer: LoKeySigner; signerDbItem: LoKeySignerDbItem }>(
      (resolve, reject) => {
        dbRequest.onsuccess = async () => {
          const db = dbRequest.result;
          const store = db.transaction('signers', 'readonly').objectStore('signers');

          const keyRequest = store.get(publicKey);

          keyRequest.onsuccess = async () => {
            if (!keyRequest.result) {
              reject(new Error('Signer not found.'));
              return;
            }

            const signerDbItem = keyRequest.result as LoKeySignerDbItem;

            const encryptionKey = await this.deriveEncryptionKey(password, signerDbItem.salt);

            try {
              const decryptedPrivateKeyBuffer = await window.crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: signerDbItem.iv },
                encryptionKey,
                signerDbItem.encryptedKey
              );

              const privateKey = await window.crypto.subtle.importKey(
                'pkcs8',
                decryptedPrivateKeyBuffer,
                { name: 'ECDSA', namedCurve: 'P-256' },
                true,
                ['sign']
              );

              resolve({
                signerDbItem,
                signer: {
                  name: signerDbItem.name,
                  privateKey,
                  publicKey: signerDbItem.publicKey,
                  sessionExpiry: signerDbItem.sessionExpiry,
                },
              });
            } catch (error) {
              reject(new Error('Decryption failed: Invalid password or corrupted data'));
            }
          };

          keyRequest.onerror = () => {
            reject('Failed to retrieve key from IndexedDB');
          };
        };

        dbRequest.onerror = () => {
          reject('Failed to open IndexedDB');
        };
      }
    );
  }

  private async createSigner(
    password: string,
    name: string,
    sessionExpiry: number
  ): Promise<LoKeySigner> {
    const signerKey = await window.crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign', 'verify']
    );

    const { encryptedPrivateKey, iv, salt } = await this.exportAndEncryptPrivateKey(
      signerKey.privateKey,
      password
    );

    const pubKey = await window.crypto.subtle.exportKey('spki', signerKey.publicKey);
    const publicKey = toBase64(pubKey);

    await this.storeEncryptedKey({
      publicKey,
      name,
      encryptedKey: encryptedPrivateKey,
      salt,
      iv,
      sessionExpiry,
    });

    return {
      name,
      privateKey: signerKey.privateKey,
      publicKey,
      sessionExpiry,
    };
  }
}
