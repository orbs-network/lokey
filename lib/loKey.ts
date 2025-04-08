import LoKeyWorker from './loKeyWorker?worker&inline';
import { TypedData } from './types';

interface WorkerCallbacks {
  [requestId: string]: (result: any) => void;
}

export class LoKey {
  private worker: Worker;
  private callbacks: WorkerCallbacks = {};

  constructor(opts: { debug?: boolean } = {}) {
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
      } else if (command === 'getAddressComplete') {
        callback({ address });
      } else if (command === 'deleteKeyComplete') {
        callback(true);
      } else if (command === 'persistKeyComplete') {
        callback(true);
      } else if (command === 'signComplete') {
        callback({ signature });
      } else if (command === 'error') {
        callback({ error: new Error(message) });
      }

      delete this.callbacks[id];
    };

    this.worker.postMessage({ command: 'setDebug', payload: { enabled: opts.debug } });
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

  async getAddress(id: string): Promise<string | undefined> {
    const result = await this.postCommand<{ address: string | undefined }>('getAddress', { id });
    return result.address;
  }

  async createSigner(id: string): Promise<string> {
    const { address } = await this.postCommand<{ address: string }>('generateKey', { id });
    return address;
  }

  async persistKey(id: string): Promise<boolean> {
    return this.postCommand('persistKey', { id });
  }

  async sign(id: string, payload: TypedData): Promise<string> {
    const result = await this.postCommand<{ signature: string }>('sign', { id, ...payload });
    return result.signature;
  }

  async deleteKey(id: string): Promise<boolean> {
    return this.postCommand('deleteKey', { id });
  }
}
