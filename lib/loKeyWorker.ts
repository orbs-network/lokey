import { ethers, HDNodeWallet, Wallet } from 'ethers';
import { TypedData } from './types';
import { arrayBufferToBase64, base64ToUint8Array } from './utils';

declare const self: Worker;

console.log('LoKey worker started');

const ephemeralWallets: Record<string, HDNodeWallet> = {};

async function encryptWithAesKey(aesKey: CryptoKey, privateKeyHex: string) {
  // Convert hex string to bytes
  const pkBytes = ethers.getBytes(privateKeyHex);

  // Create random IV for AES-GCM
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt
  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    aesKey,
    pkBytes
  );

  return {
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
  };
}

async function decryptWithAesKey(aesKey: CryptoKey, ivBase64: string, ciphertextBase64: string) {
  const iv = base64ToUint8Array(ivBase64);
  const ciphertext = base64ToUint8Array(ciphertextBase64);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    aesKey,
    ciphertext
  );

  // Convert bytes back to hex string
  return ethers.hexlify(new Uint8Array(decryptedBuffer));
}

const DB_NAME = 'LoKeyDB';
const AES_STORE = 'aesKeyStore';
const ETHERS_STORE = 'ethersKeyStore';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const openRequest = indexedDB.open(DB_NAME, 1);

    openRequest.onupgradeneeded = (event) => {
      console.log('Creating object stores');
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(AES_STORE)) {
        db.createObjectStore(AES_STORE, { keyPath: 'id' });
      }
      // If you also have an ETHERS_STORE or others, create them here too:
      if (!db.objectStoreNames.contains(ETHERS_STORE)) {
        db.createObjectStore(ETHERS_STORE, { keyPath: 'id' });
      }
    };

    openRequest.onsuccess = () => {
      resolve(openRequest.result);
    };
    openRequest.onerror = () => {
      reject(openRequest.error);
    };
  });
}

async function storeAesKeyInIDB(id: string, aesKey: CryptoKey): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AES_STORE, 'readwrite');
    const store = tx.objectStore(AES_STORE);

    store.put({ id, key: aesKey });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAesKeyFromIDB(id: string): Promise<CryptoKey | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AES_STORE, 'readonly');
    const store = tx.objectStore(AES_STORE);

    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      if (!getRequest.result) {
        return resolve(null);
      }
      // `getRequest.result` is expected to have { id: string, key: CryptoKey }
      resolve(getRequest.result.key as CryptoKey);
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

async function deleteAesKeyInIDB(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AES_STORE, 'readwrite');
    const store = tx.objectStore(AES_STORE);

    store.delete(id);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

interface EncryptedEthersKey {
  id: string;
  iv: string;
  ciphertext: string;
  address: string;
}

async function storeEncryptedEthersKey(
  id: string,
  address: string,
  encryptedData: {
    iv: string;
    ciphertext: string;
  }
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ETHERS_STORE, 'readwrite');
    const store = tx.objectStore(ETHERS_STORE);

    const record: EncryptedEthersKey = {
      id,
      address,
      iv: encryptedData.iv,
      ciphertext: encryptedData.ciphertext,
    };
    store.put(record);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getEncryptedEthersKey(id: string): Promise<{
  iv: string;
  ciphertext: string;
  address: string;
} | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ETHERS_STORE, 'readonly');
    const store = tx.objectStore(ETHERS_STORE);

    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      if (!getRequest.result) {
        return resolve(null);
      }
      const { iv, ciphertext, address } = getRequest.result as EncryptedEthersKey;
      resolve({ iv, ciphertext, address });
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

async function deleteEncryptedEthersKey(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ETHERS_STORE, 'readwrite');
    const store = tx.objectStore(ETHERS_STORE);

    store.delete(id);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getPersistedWallet(id: string): Promise<Wallet> {
  const encryptionKey = await getAesKeyFromIDB(id);
  if (!encryptionKey) {
    throw new Error('No encryption key found');
  }

  const encryptedEthersKey = await getEncryptedEthersKey(id);
  if (!encryptedEthersKey) {
    throw new Error('No encrypted signing key found in IndexedDB!');
  }

  const privateKeyHex = await decryptWithAesKey(
    encryptionKey,
    encryptedEthersKey.iv,
    encryptedEthersKey.ciphertext
  );

  return new ethers.Wallet(privateKeyHex);
}

async function sign(wallet: HDNodeWallet | Wallet, typedData: TypedData) {
  return await wallet.signTypedData(typedData.domain, typedData.types, typedData.message);
}

self.onmessage = async (event) => {
  const { id: eventId, command, payload } = event.data;

  try {
    switch (command) {
      case 'getAddress': {
        const ephemeralWallet = ephemeralWallets[payload.id];
        if (ephemeralWallet) {
          self.postMessage({
            id: eventId,
            command: 'getAddressComplete',
            address: ephemeralWallet.address,
          });

          return;
        }

        const encryptedEthersKey = await getEncryptedEthersKey(payload.id);
        self.postMessage({
          id: eventId,
          command: 'getAddressComplete',
          address: encryptedEthersKey?.address,
        });

        break;
      }
      case 'deleteKey': {
        delete ephemeralWallets[payload.id];
        await deleteAesKeyInIDB(payload.id);
        await deleteEncryptedEthersKey(payload.id);

        self.postMessage({
          id: eventId,
          command: 'deleteKeyComplete',
        });
        break;
      }
      case 'generateKey': {
        if (ephemeralWallets[payload.id]) {
          throw new Error('Ephemeral wallet already exists');
        }

        ephemeralWallets[payload.id] = ethers.Wallet.createRandom();

        self.postMessage({
          id: eventId,
          command: 'generateKeyComplete',
          address: ephemeralWallets[payload.id].address,
        });

        break;
      }
      case 'persistKey': {
        if (!ephemeralWallets[payload.id]) {
          throw new Error('No ephemeral wallet generated');
        }

        const encryptionKey = await crypto.subtle.generateKey(
          { name: 'AES-GCM', length: 256 },
          false, // non-extractable
          ['encrypt', 'decrypt']
        );

        const encryptedEthersKey = await encryptWithAesKey(
          encryptionKey,
          ephemeralWallets[payload.id].privateKey
        );

        await storeEncryptedEthersKey(
          payload.id,
          ephemeralWallets[payload.id].address,
          encryptedEthersKey
        );
        await storeAesKeyInIDB(payload.id, encryptionKey);

        self.postMessage({
          id: eventId,
          command: 'persistKeyComplete',
        });

        break;
      }
      case 'sign': {
        let wallet: HDNodeWallet | Wallet | undefined = ephemeralWallets[payload.id];

        const { id, ...typedData } = payload;

        if (!wallet) {
          wallet = await getPersistedWallet(id);
        }

        const signature = await sign(wallet, typedData as TypedData);

        self.postMessage({
          id: eventId,
          command: 'signComplete',
          signature,
        });
        break;
      }
      default:
        throw new Error('Unknown command: ' + command);
    }
  } catch (err: any) {
    console.error('LoKey worker error:', err);
    self.postMessage({
      id: eventId,
      command: 'error',
      message: err?.message || String(err),
      stack: err?.stack,
    });
  }
};
