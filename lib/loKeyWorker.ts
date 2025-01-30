import { ethers, Wallet } from 'ethers';
import { TypedData } from './types';
import { arrayBufferToBase64, base64ToUint8Array } from './utils';

declare const self: Worker;

console.log('LoKey worker started');

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

const AES_KEY_ID = 'aes-gcm-key'; // For storing the non-extractable AES key
const ETHERS_KEY_ID = 'encrypted-ethers'; // For storing the encrypted Ethers key

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

async function storeAesKeyInIDB(aesKey: CryptoKey): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AES_STORE, 'readwrite');
    const store = tx.objectStore(AES_STORE);

    store.put({ id: AES_KEY_ID, key: aesKey });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAesKeyFromIDB(): Promise<CryptoKey | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AES_STORE, 'readonly');
    const store = tx.objectStore(AES_STORE);

    const getRequest = store.get(AES_KEY_ID);
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

async function deleteAesKeyInIDB(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AES_STORE, 'readwrite');
    const store = tx.objectStore(AES_STORE);

    store.delete(AES_KEY_ID);

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
      id: ETHERS_KEY_ID,
      address,
      iv: encryptedData.iv,
      ciphertext: encryptedData.ciphertext,
    };
    store.put(record);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getEncryptedEthersKey(): Promise<{
  iv: string;
  ciphertext: string;
  address: string;
} | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ETHERS_STORE, 'readonly');
    const store = tx.objectStore(ETHERS_STORE);

    const getRequest = store.get(ETHERS_KEY_ID);
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

async function deleteEncryptedEthersKey(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ETHERS_STORE, 'readwrite');
    const store = tx.objectStore(ETHERS_STORE);

    store.delete(ETHERS_KEY_ID);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

self.onmessage = async (event) => {
  const { id, command, payload } = event.data;

  try {
    switch (command) {
      case 'getAddress': {
        const encryptedEthersKey = await getEncryptedEthersKey();
        self.postMessage({
          id,
          command: 'getAddressComplete',
          address: encryptedEthersKey?.address,
        });
        break;
      }
      case 'deleteKey': {
        await deleteAesKeyInIDB();
        await deleteEncryptedEthersKey();
        self.postMessage({
          id,
          command: 'deleteKeyComplete',
        });
        break;
      }
      case 'generateKey': {
        const ephemeralWallet = Wallet.createRandom();

        const encryptionKey = await crypto.subtle.generateKey(
          { name: 'AES-GCM', length: 256 },
          false, // non-extractable
          ['encrypt', 'decrypt']
        );

        const encryptedEthersKey = await encryptWithAesKey(
          encryptionKey,
          ephemeralWallet.privateKey
        );

        await storeEncryptedEthersKey(ephemeralWallet.address, encryptedEthersKey);
        await storeAesKeyInIDB(encryptionKey);

        self.postMessage({
          id,
          command: 'generateKeyComplete',
          address: ephemeralWallet.address,
        });

        break;
      }
      case 'sign': {
        const encryptionKey = await getAesKeyFromIDB();
        if (!encryptionKey) {
          throw new Error('No encryption key found');
        }

        const encryptedEthersKey = await getEncryptedEthersKey();
        if (!encryptedEthersKey) {
          throw new Error('No encrypted Ethers key found in IndexedDB!');
        }

        const privateKeyHex = await decryptWithAesKey(
          encryptionKey,
          encryptedEthersKey.iv,
          encryptedEthersKey.ciphertext
        );

        // 4) Reconstruct Ethers wallet
        const wallet = new ethers.Wallet(privateKeyHex);

        const typedData = payload as TypedData;

        const signature = await wallet.signTypedData(
          typedData.domain,
          typedData.types,
          typedData.message
        );
        self.postMessage({
          id,
          command: 'signComplete',
          signature,
        });
        break;
      }
      default:
        throw new Error('Unknown command: ' + command);
    }
  } catch (err: any) {
    self.postMessage({
      id,
      command: 'error',
      message: err?.message || String(err),
    });
  }
};
