import { TypedData } from './types';

interface WorkerCallbacks {
  [requestId: string]: (result: any) => void;
}

export class LoKey {
  private worker: Worker;
  private callbacks: WorkerCallbacks = {};

  constructor(private signTypedData: (payload: TypedData) => Promise<string>) {
    this.worker = new Worker(new URL('./loKeyWorker.ts', import.meta.url), {
      type: 'module',
    });
    // Listen for responses from the worker
    this.worker.onmessage = (event) => {
      const { id, command, address, signature, message } = event.data;
      if (!id) {
        // Worker might send some initialization message without an id
        console.warn('Received worker message without "id"', event.data);
        return;
      }
      const callback = this.callbacks[id];
      if (!callback) return;

      if (command === 'generateKeyComplete') {
        callback({ address });
      } else if (command === 'signComplete') {
        callback({ signature });
      } else if (command === 'error') {
        callback({ error: new Error(message) });
      }

      // Once we've called the callback, remove it
      delete this.callbacks[id];
    };
  }

  private postCommand<T>(command: string, payload?: any): Promise<T> {
    return new Promise((resolve, reject) => {
      const requestId = Math.random().toString(36).substring(7); // naive unique ID
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

  async createSigner(): Promise<{ address: string; signature: string }> {
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

    const signature = await this.signTypedData(payload);

    return {
      address: result.address,
      signature,
    };
  }

  /** Signs a message with the ephemeral private key. Returns a 0x signature string. */
  async sign(payload: TypedData): Promise<string> {
    const result = await this.postCommand<{ signature: string }>('sign', payload);
    return result.signature;
  }
}
