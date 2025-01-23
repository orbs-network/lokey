import { Wallet, HDNodeWallet } from 'ethers';
import { TypedData } from './types';

declare const self: Worker;

let ephemeralWallet: HDNodeWallet | null = null;

console.log('LoKey worker started');

self.onmessage = async (event) => {
  const { id, command, payload } = event.data;

  try {
    switch (command) {
      case 'generateKey':
        ephemeralWallet = Wallet.createRandom();
        self.postMessage({
          id,
          command: 'generateKeyComplete',
          address: ephemeralWallet.address,
        });
        break;

      case 'sign':
        if (!ephemeralWallet) {
          throw new Error('No ephemeral wallet generated yet');
        }

        const typedData = payload as TypedData;

        const signature = await ephemeralWallet.signTypedData(
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
