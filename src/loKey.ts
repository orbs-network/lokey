import { LoKeySignature, LoKeySigner, LoKeyState } from './types';
import {
  convertEcdsaAsn1Signature,
  convertFromBase64,
  convertToBase64,
  mergeBuffer,
} from './utils';

export class LoKey {
  private _signers: LoKeySigner[] = [];

  constructor(private appName: string) {
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

  private get signers() {
    return this._signers;
  }

  private set signers(signers: LoKeySigner[]) {
    this._signers = signers;
    window.sessionStorage.setItem('loKeyState', JSON.stringify({ signers: this._signers }));
  }

  private addSigner(signer: LoKeySigner) {
    this.signers = [...this.signers, signer];
  }

  getSigner(publicKey: string) {
    return this.signers.find((s) => s.publicKey === publicKey);
  }

  getSigners() {
    return this.signers;
  }

  async createSigner(name: string) {
    const challenge = window.crypto.getRandomValues(new Uint8Array(32));

    const randomUserId = window.crypto.getRandomValues(new Uint8Array(16));

    const credential = await window.navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: this.appName,
          id: window.location.hostname,
        },
        user: {
          id: randomUserId,
          name,
          displayName: name,
        },
        pubKeyCredParams: [
          {
            type: 'public-key',
            alg: -7, // ECDSA w/ SHA-256
          },
        ],
        authenticatorSelection: {
          userVerification: 'preferred',
        },
        timeout: 60000,
      },
    });

    if (!credential) {
      throw new Error('Credential is null');
    }

    const publicKey = (
      (credential as PublicKeyCredential).response as AuthenticatorAttestationResponse
    ).getPublicKey();

    if (!publicKey) {
      throw new Error('Public key is null');
    }

    const publicKeyBase64 = convertToBase64(publicKey);

    this.addSigner({
      name,
      credentialId: credential.id,
      publicKey: publicKeyBase64,
    });

    return publicKeyBase64;
  }

  async sign(publicKey: string, message: string): Promise<LoKeySignature> {
    const signer = this.getSigner(publicKey);

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
    const signer = this.getSigner(publicKeyBase64);

    if (!signer) {
      throw new Error('Signer not found');
    }

    const publicKeyBuffer = convertFromBase64(signer.publicKey);
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
