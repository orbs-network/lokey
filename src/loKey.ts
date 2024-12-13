import { LoKeySignature } from './types';
import {
  convertEcdsaAsn1Signature,
  convertFromBase64,
  convertToBase64,
  mergeBuffer,
} from './utils';

// 24 hours in milliseconds
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000;

export class LoKey {
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

  signerExists() {
    const credentialId = window.sessionStorage.getItem('credentialId');
    const sessionExpiry = window.sessionStorage.getItem('sessionExpiry');

    if (!credentialId || !sessionExpiry) {
      return false;
    }

    const expiry = Number(sessionExpiry);
    if (Date.now() > expiry) {
      return false;
    }

    return true;
  }

  async initializeSigner() {
    if (this.signerExists()) {
      return;
    }

    await this.createSigner();
  }

  private async createSigner() {
    const challenge = window.crypto.getRandomValues(new Uint8Array(32));

    const randomUserId = window.crypto.getRandomValues(new Uint8Array(16));
    console.log('randomUserId', randomUserId);

    const credential = await window.navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'LoKey',
        },
        user: {
          id: randomUserId,
          name: 'Perps 2.0 Delegated Signer',
          displayName: 'Perps 2.0 Delegated Signer',
        },
        pubKeyCredParams: [
          {
            type: 'public-key',
            alg: -7,
          },
        ],
        authenticatorSelection: {
          userVerification: 'preferred',
        },
        timeout: 60000,
      },
    });

    if (!credential) {
      throw new Error('LoKey.generateWebAuthnKey: credential is null');
    }

    window.sessionStorage.setItem('credentialId', credential.id);
    window.sessionStorage.setItem('sessionExpiry', String(Date.now() + SESSION_TIMEOUT));

    const publicKey = (
      (credential as PublicKeyCredential).response as AuthenticatorAttestationResponse
    ).getPublicKey();

    if (!publicKey) {
      throw new Error('LoKey.generateWebAuthnKey: public key is null');
    }

    const publicKeyBase64 = convertToBase64(publicKey);
    window.sessionStorage.setItem('publicKey', publicKeyBase64);

    return credential.id;
  }

  async sign(message: string): Promise<LoKeySignature> {
    const credentialId = sessionStorage.getItem('credentialId');

    if (!credentialId) {
      throw new Error('Credential ID not found. Generate a key first.');
    }

    const challenge = new TextEncoder().encode(message);

    const assertion = await window.navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [
          {
            id: Uint8Array.from(atob(credentialId.replace(/_/g, '/').replace(/-/g, '+')), (c) =>
              c.charCodeAt(0)
            ),
            type: 'public-key',
          },
        ],
        timeout: 60000,
        userVerification: 'discouraged', // Skip user verification for this session
      },
    });

    const authAssertionResponse = (assertion as PublicKeyCredential)
      .response as AuthenticatorAssertionResponse;

    const signature = convertEcdsaAsn1Signature(new Uint8Array(authAssertionResponse.signature));

    const hashedClientDataJSON = await window.crypto.subtle.digest(
      'SHA-256',
      authAssertionResponse.clientDataJSON
    );
    const data = mergeBuffer(authAssertionResponse.authenticatorData, hashedClientDataJSON);

    return {
      signature: convertToBase64(signature),
      data: convertToBase64(data),
    };
  }

  async verify(signature: string, data: string): Promise<boolean> {
    const publicKeyBase64 = sessionStorage.getItem('publicKey');
    if (!publicKeyBase64) {
      throw new Error('Public key not found');
    }

    const publicKeyBuffer = convertFromBase64(publicKeyBase64);
    const publicKey = await window.crypto.subtle.importKey(
      'spki',
      publicKeyBuffer,
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['verify']
    );

    const signatureBuffer = convertFromBase64(signature);
    const dataBuffer = convertFromBase64(data);

    // Verify the signature
    const isValid = await window.crypto.subtle.verify(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      publicKey,
      signatureBuffer,
      dataBuffer
    );

    return isValid;
  }
}
