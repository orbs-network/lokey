import { LoKeySignature, LoKeySigner, LoKeyState } from './types';
import {
  convertEcdsaAsn1Signature,
  convertFromBase64,
  convertToBase64,
  mergeBuffer,
} from './utils';

// 24 hours in milliseconds
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000;

export class LoKey {
  private signers: LoKeySigner[] = [];

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

    const loKeyState = window.sessionStorage.getItem('loKeyState');

    if (!loKeyState) {
      return;
    }

    const { signers } = JSON.parse(loKeyState) as LoKeyState;
    this.signers = signers;
  }

  private addSigner(signer: LoKeySigner) {
    this.signers.push(signer);
    window.sessionStorage.setItem('loKeyState', JSON.stringify({ signers: this.signers }));
  }

  getSigners() {
    return this.signers;
  }

  async initializeSigner() {
    if (this.signers.length > 0) {
      return;
    }

    return await this.createSigner();
  }

  async createSigner(name = 'LoKey Delegated Signer') {
    const challenge = window.crypto.getRandomValues(new Uint8Array(32));

    const randomUserId = window.crypto.getRandomValues(new Uint8Array(16));

    const credential = await window.navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'LoKey',
        },
        user: {
          id: randomUserId,
          name,
          displayName: name,
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

    const publicKey = (
      (credential as PublicKeyCredential).response as AuthenticatorAttestationResponse
    ).getPublicKey();

    if (!publicKey) {
      throw new Error('LoKey.generateWebAuthnKey: public key is null');
    }

    const publicKeyBase64 = convertToBase64(publicKey);

    this.addSigner({
      name,
      credentialId: credential.id,
      publicKey: publicKeyBase64,
      sessionExpiry: Date.now() + SESSION_TIMEOUT,
    });

    return publicKeyBase64;
  }

  async sign(publicKey: string, message: string): Promise<LoKeySignature> {
    const signer = this.signers.find((s) => s.publicKey === publicKey);

    if (!signer) {
      throw new Error('Signer not found');
    }

    const challenge = new TextEncoder().encode(message);

    const assertion = await window.navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [
          {
            id: Uint8Array.from(
              atob(signer.credentialId.replace(/_/g, '/').replace(/-/g, '+')),
              (c) => c.charCodeAt(0)
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

  async verify(publicKeyBase64: string, signature: string, data: string): Promise<boolean> {
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
