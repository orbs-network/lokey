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

    const loKeyState = window.localStorage.getItem('loKeyState');

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
    window.localStorage.setItem('loKeyState', JSON.stringify({ signers: this._signers }));
  }

  private addSigner(signer: LoKeySigner) {
    this.signers = [...this.signers, signer];
  }

  private pruneExpiredSigners() {
    this.signers = this.signers.filter((s) => !s.sessionExpiry || s.sessionExpiry > Date.now());
  }

  getSigner(publicKey: string) {
    this.pruneExpiredSigners();
    return this.signers.find((s) => s.publicKey === publicKey);
  }

  getSigners() {
    this.pruneExpiredSigners();
    return this.signers;
  }

  async createSigner(name: string, sessionExpiry?: number) {
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
          userVerification: 'required', // user verification required when creating a signer
        },
        timeout: 60000,
      },
    });

    if (!credential) {
      throw new Error('Credential not created.');
    }

    const publicKey = (
      (credential as PublicKeyCredential).response as AuthenticatorAttestationResponse
    ).getPublicKey();

    if (!publicKey) {
      throw new Error('Credential has no public key.');
    }

    const publicKeyBase64 = convertToBase64(publicKey);

    this.addSigner({
      name,
      credentialId: credential.id,
      publicKey: publicKeyBase64,
      sessionExpiry,
    });

    return publicKeyBase64;
  }

  deleteSigner(publicKey: string) {
    this.signers = this.signers.filter((s) => s.publicKey !== publicKey);
  }

  async sign(publicKey: string, message: string): Promise<LoKeySignature> {
    const signer = this.getSigner(publicKey);

    if (!signer) {
      throw new Error('Signer not found. Incorrect public key or signer has expired.');
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
        userVerification: 'preferred', // user verification preferred when signing but not required.
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

  async verify(publicKey: string, signature: string, data: string): Promise<boolean> {
    const signer = this.getSigner(publicKey);

    if (!signer) {
      throw new Error('Signer not found. Incorrect public key or signer has expired.');
    }

    const publicKeyBuffer = convertFromBase64(signer.publicKey);
    const importedPublicKey = await window.crypto.subtle.importKey(
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
      importedPublicKey,
      signatureBuffer,
      dataBuffer
    );

    return isValid;
  }
}
