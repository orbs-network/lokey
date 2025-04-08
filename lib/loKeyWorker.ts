import { ethers, HDNodeWallet, Wallet } from 'ethers';
import { TypedData } from './types';
import { arrayBufferToBase64, base64ToUint8Array } from './utils';

declare const self: Worker;

// Debug flag - can be toggled via a message to the worker
let DEBUG_ENABLED = false;

// Logger utility that preserves logs even in production builds
const loKeyLogger = {
  log: function (...args: any[]) {
    if (DEBUG_ENABLED) {
      // Using Function constructor to prevent build tools from removing logs
      new Function('console', `console.log('[LoKeyWorker]', ...arguments)`)(console, ...args);
    }
  },
  error: function (...args: any[]) {
    if (DEBUG_ENABLED) {
      // Using Function constructor to prevent build tools from removing logs
      new Function('console', `console.error('[LoKeyWorker]', ...arguments)`)(console, ...args);
    }
  },
};

// Use these instead of the previous log/logError functions
loKeyLogger.log('LoKey worker started');

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
    loKeyLogger.log('Opening IndexedDB database:', DB_NAME);
    const openRequest = indexedDB.open(DB_NAME, 1);

    openRequest.onupgradeneeded = (event) => {
      loKeyLogger.log('Database upgrade needed, creating object stores');
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(AES_STORE)) {
        loKeyLogger.log('Creating AES_STORE object store');
        db.createObjectStore(AES_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(ETHERS_STORE)) {
        loKeyLogger.log('Creating ETHERS_STORE object store');
        db.createObjectStore(ETHERS_STORE, { keyPath: 'id' });
      }
    };

    openRequest.onsuccess = () => {
      loKeyLogger.log('IndexedDB opened successfully');
      resolve(openRequest.result);
    };

    openRequest.onerror = (event) => {
      const error = openRequest.error;
      loKeyLogger.error('Error opening IndexedDB:', error);
      loKeyLogger.error('Error event:', event);
      reject(error || new Error('Unknown error opening IndexedDB'));
    };

    openRequest.onblocked = (event) => {
      loKeyLogger.error('IndexedDB open request blocked:', event);
      reject(new Error('IndexedDB open request blocked'));
    };
  });
}

async function storeAesKeyInIDB(id: string, aesKey: CryptoKey): Promise<void> {
  try {
    loKeyLogger.log('Opening IndexedDB for AES key storage');
    const db = await openDB();
    loKeyLogger.log('IndexedDB opened successfully');
    return new Promise((resolve, reject) => {
      const tx = db.transaction(AES_STORE, 'readwrite');
      const store = tx.objectStore(AES_STORE);

      loKeyLogger.log('Putting AES key in object store');
      const request = store.put({ id, key: aesKey });

      request.onsuccess = () => {
        loKeyLogger.log('AES key stored successfully');
      };

      request.onerror = (e) => {
        loKeyLogger.error('Error storing AES key:', e);
        reject(new Error(`Failed to store AES key: ${e}`));
      };

      tx.oncomplete = () => {
        loKeyLogger.log('AES key transaction complete');
        resolve();
      };
      tx.onerror = (e) => {
        loKeyLogger.error('Transaction error storing AES key:', e);
        reject(new Error(`Transaction failed: ${e}`));
      };
    });
  } catch (error) {
    loKeyLogger.error('Error in storeAesKeyInIDB:', error);
    throw error;
  }
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
  try {
    loKeyLogger.log('Opening IndexedDB for encrypted Ethers key storage');
    const db = await openDB();
    loKeyLogger.log('IndexedDB opened successfully');
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ETHERS_STORE, 'readwrite');
      const store = tx.objectStore(ETHERS_STORE);

      const record: EncryptedEthersKey = {
        id,
        address,
        iv: encryptedData.iv,
        ciphertext: encryptedData.ciphertext,
      };

      loKeyLogger.log('Putting encrypted Ethers key in object store');
      const request = store.put(record);

      request.onsuccess = () => {
        loKeyLogger.log('Encrypted Ethers key stored successfully');
      };

      request.onerror = (e) => {
        loKeyLogger.error('Error storing encrypted Ethers key:', e);
        reject(new Error(`Failed to store encrypted key: ${e}`));
      };

      tx.oncomplete = () => {
        loKeyLogger.log('Encrypted Ethers key transaction complete');
        resolve();
      };
      tx.onerror = (e) => {
        loKeyLogger.error('Transaction error storing encrypted Ethers key:', e);
        reject(new Error(`Transaction failed: ${e}`));
      };
    });
  } catch (error) {
    loKeyLogger.error('Error in storeEncryptedEthersKey:', error);
    throw error;
  }
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
    loKeyLogger.log(`Received command: ${command}`, payload);

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

        try {
          loKeyLogger.log('About to generate encryption key');
          // Check if crypto.subtle is available
          if (!crypto || !crypto.subtle) {
            throw new Error('Web Crypto API not available in this context');
          }

          // Try with a wrapped try/catch specifically for the key generation
          const encryptionKey = await (async () => {
            try {
              return await crypto.subtle.generateKey(
                { name: 'AES-GCM', length: 256 },
                false, // non-extractable
                ['encrypt', 'decrypt']
              );
            } catch (keyGenError: unknown) {
              loKeyLogger.error('Error generating key:', keyGenError);
              const errorMessage =
                keyGenError instanceof Error ? keyGenError.message : 'Unknown error';
              throw new Error(`Failed to generate encryption key: ${errorMessage}`);
            }
          })();

          loKeyLogger.log('Key generated successfully, proceeding to encrypt');

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
        } catch (persistError) {
          loKeyLogger.error('Error in persistKey:', persistError);
          throw persistError;
        }
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
      case 'setDebug': {
        DEBUG_ENABLED = payload.enabled;
        self.postMessage({
          id: eventId,
          command: 'setDebugComplete',
        });
        break;
      }
      default:
        throw new Error('Unknown command: ' + command);
    }
  } catch (err: any) {
    loKeyLogger.error('LoKey worker error:', err);
    self.postMessage({
      id: eventId,
      command: 'error',
      message: err?.message || String(err),
      stack: err?.stack,
    });
  }
};

// Usage:
// To enable/disable debugging, send a message to the worker:
// worker.postMessage({ id: 'some-id', command: 'setDebug', payload: { enabled: true } });
