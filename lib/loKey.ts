import LoKeyWorker from './loKeyWorker?worker&inline';
import { TypedData } from './types';

interface WorkerCallbacks {
  [requestId: string]: (result: any) => void;
}

export class LoKey {
  private worker: Worker;
  private callbacks: WorkerCallbacks = {};

  constructor() {
    this.worker = new LoKeyWorker();
    this.worker.onmessage = (event) => {
      const { id, command, address, signature, message, isPersisted } = event.data;
      if (!id) {
        console.warn('Received worker message without "id"', event.data);
        return;
      }
      const callback = this.callbacks[id];
      if (!callback) return;

      if (command === 'generateKeyComplete') {
        callback({ address });
      } else if (command === 'getAddressComplete') {
        callback({ address, isPersisted });
      } else if (command === 'deleteKeyComplete') {
        callback(true);
      } else if (command === 'persistKeyComplete') {
        callback(true);
      } else if (command === 'signWithPersistedKeyComplete') {
        callback({ signature });
      } else if (command === 'signWithEphemeralKeyComplete') {
        callback({ signature });
      } else if (command === 'error') {
        callback({ error: new Error(message) });
      }

      delete this.callbacks[id];
    };
  }

  private postCommand<T>(command: string, payload?: any): Promise<T> {
    return new Promise((resolve, reject) => {
      const requestId = Math.random().toString(36).substring(7);
      this.callbacks[requestId] = (result) => {
        if (result.error) {
          reject(result.error);
        } else {
          resolve(result);
        }
      };

      this.worker.postMessage({ id: requestId, command, payload });
    });
  }

  async getAddress(): Promise<{ address: string | undefined; isPersisted: boolean }> {
    return await this.postCommand<{ address: string | undefined; isPersisted: boolean }>(
      'getAddress'
    );
  }

  async createSigner(
    signTypedData: (payload: TypedData) => Promise<string>,
    persistKey = false
  ): Promise<{ address: string; signature: string }> {
    const result = await this.postCommand<{ address: string }>('generateKey');

    const payload = {
      primaryType: 'Verification',
      domain: {},
      types: {
        Verification: [
          { name: 'address', type: 'address' },
          { name: 'message', type: 'string' },
          { name: 'nonce', type: 'uint256' },
        ],
      },
      message: {
        address: result.address,
        message: 'Sign this message to prove you own the private key.',
        nonce: Date.now(),
      },
    };

    const signature = await signTypedData(payload);

    if (!signature) {
      throw new Error('Failed to sign message');
    }

    if (persistKey) {
      await this.postCommand('persistKey');
    }

    return {
      address: result.address,
      signature,
    };
  }

  async sign(payload: TypedData): Promise<string> {
    const { isPersisted } = await this.getAddress();

    const result = await this.postCommand<{ signature: string }>(
      isPersisted ? 'signWithPersistedKey' : 'signWithEphemeralKey',
      payload
    );
    return result.signature;
  }

  async deleteKey(): Promise<boolean> {
    return this.postCommand('deleteKey');
  }
}
