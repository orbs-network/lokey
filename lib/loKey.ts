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
      const { id, command, address, signature, message } = event.data;
      if (!id) {
        console.warn('Received worker message without "id"', event.data);
        return;
      }
      const callback = this.callbacks[id];
      if (!callback) return;

      if (command === 'generateKeyComplete') {
        callback({ address });
      } else if (command === 'signComplete') {
        callback({ signature });
      } else if (command === 'getAddressComplete') {
        callback({ address });
      } else if (command === 'deleteKeyComplete') {
        callback(true);
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

  async getAddress(): Promise<string | undefined> {
    const result = await this.postCommand<{ address: string | undefined }>('getAddress');
    return result.address;
  }

  async createSigner(
    signTypedData: (payload: TypedData) => Promise<string>
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

    return {
      address: result.address,
      signature,
    };
  }

  async sign(payload: TypedData): Promise<string> {
    const result = await this.postCommand<{ signature: string }>('sign', payload);
    return result.signature;
  }

  async deleteKey(): Promise<void> {
    await this.postCommand('deleteKey');
  }
}
