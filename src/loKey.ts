// 24 hours in milliseconds
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000;

export class LoKey {
  constructor() {
    console.log('LoKey constructor');
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

  async initializeSigner() {
    const credentialId = window.sessionStorage.getItem('credentialId');

    if (credentialId) {
      return;
    }
    await this.generateWebAuthnKey();
  }

  private async generateWebAuthnKey() {
    console.log('LoKey.generateWebAuthnKey');
    const challenge = window.crypto.getRandomValues(new Uint8Array(32));

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'LoKey',
        },
        user: {
          id: new Uint8Array(16),
          name: 'user',
          displayName: 'User Example',
        },
        pubKeyCredParams: [
          {
            type: 'public-key',
            alg: -7,
          },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        timeout: 60000,
      },
    });

    if (!credential) {
      throw new Error('LoKey.generateWebAuthnKey: credential is null');
    }

    console.log('LoKey.generateWebAuthnKey: credential', credential);

    window.sessionStorage.setItem('credentialId', credential.id);
    window.sessionStorage.setItem('sessionExpiry', String(Date.now() + SESSION_TIMEOUT));

    // Extract the attestation object
    const publicKeyBuffer = (
      (credential as PublicKeyCredential).response as AuthenticatorAttestationResponse
    ).getPublicKey();

    if (!publicKeyBuffer) {
      throw new Error('LoKey.generateWebAuthnKey: publicKeyBuffer is null');
    }

    const binStr = String.fromCodePoint(...new Uint8Array(publicKeyBuffer));
    const publicKeyBase64 = btoa(binStr);
    window.sessionStorage.setItem('publicKey', publicKeyBase64);

    return credential.id;
  }

  // async sign(message: string) {}

  // async verify(message: string, signatureBase64: string) {}

  async getPublicKey() {
    return window.sessionStorage.getItem('publicKey');
  }
}
