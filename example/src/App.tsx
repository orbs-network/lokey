import { useCallback, useEffect, useState } from 'react';
import { useLoKey } from './useLoKey';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ethers } from 'ethers';
import { useSignTypedData } from 'wagmi';

function App() {
  const loKey = useLoKey();
  const [signature, setSignature] = useState<string | null>(null);
  const [loKeyAddress, setLoKeyAddress] = useState('');

  const [message, setMessage] = useState('');
  const [isVerified, setVerified] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const [persistKey, setPersistKey] = useState(false);

  const { signTypedDataAsync } = useSignTypedData();

  const handleGenerate = useCallback(async () => {
    if (!loKey) return;
    const { address, signature } = await loKey.createSigner(async (payload) => {
      console.log('Signing typed data:', payload);

      const typedData = {
        ...payload,
        domain: {
          ...payload.domain,
          name: payload.domain.name ?? undefined,
          salt: (payload.domain.salt as `0x${string}`) ?? undefined,
          verifyingContract: (payload.domain.verifyingContract as `0x${string}`) ?? undefined,
          version: payload.domain.version ?? undefined,
        },
      };

      return await signTypedDataAsync(typedData);
    }, persistKey);
    // TODO: send signature to server
    console.log(address, signature);
    setLoKeyAddress(address);
  }, [loKey, persistKey, signTypedDataAsync]);

  const handleSign = useCallback(async () => {
    if (!loKey) return;
    const sig = await loKey.sign({
      domain: {},
      primaryType: 'Message',
      types: {
        Message: [{ name: 'message', type: 'string' }],
      },
      message: { message },
    });
    setSignature(sig);
    console.log('Signature', sig);
  }, [loKey, message]);

  const handleVerify = useCallback(async () => {
    if (!loKey || !signature || !loKeyAddress) return;
    setVerified(false);

    const typedData = {
      domain: {},
      primaryType: 'Message',
      types: {
        Message: [{ name: 'message', type: 'string' }],
      },
      message: { message },
    };

    try {
      const res = ethers.verifyTypedData(
        typedData.domain,
        typedData.types,
        typedData.message,
        signature
      );
      console.log(res);
      if (res !== loKeyAddress) {
        throw new Error('Signature verification failed');
      }
      setVerified(res === loKeyAddress);
    } catch (err) {
      console.error(err);
      setError(err as Error);
    }
  }, [loKey, loKeyAddress, message, signature]);

  const init = useCallback(async () => {
    if (!loKey) return;
    try {
      const { address } = await loKey.getAddress();
      setLoKeyAddress(address || '');
    } catch (e) {
      console.log(e);
    }
  }, [loKey]);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <main>
      <div className="row" style={{ alignItems: 'center' }}>
        <img src="/lokey_stamp_logo.png" alt="LoKey" style={{ height: '50px', width: 'auto' }} />
        <h1 style={{ fontWeight: 'normal' }}>LoKey</h1>
      </div>
      <div className="column" style={{ gap: 18 }}>
        <div className="row" style={{ justifyContent: 'end' }}>
          <ConnectButton />
        </div>
        <div className="row" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div>
            <label>
              <input
                type="checkbox"
                checked={persistKey}
                onChange={(e) => setPersistKey(e.target.checked)}
                style={{ marginRight: 8 }}
              />
              Persist key
            </label>
          </div>
          <button onClick={handleGenerate} disabled={Boolean(loKeyAddress)}>
            Delegate
          </button>
        </div>

        <div className="row" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <label style={{ fontSize: '14px' }}>LoKey address:</label>
          <input style={{ fontSize: '12px' }} type="text" value={loKeyAddress} readOnly disabled />
          <button
            style={{ fontSize: '12px' }}
            onClick={async () => {
              const success = await loKey.deleteKey();
              if (success) {
                await init();
              }
            }}
            disabled={!loKeyAddress}
          >
            Delete key
          </button>
        </div>

        <div className="column">
          <div className="column" style={{ gap: 2 }}>
            <label>
              <small>
                <strong>Enter message</strong>
              </small>
            </label>

            <div className="row">
              <input
                type="text"
                placeholder="Message"
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);

                  setSignature(null);
                  setVerified(false);
                  setError(null);
                }}
              />
              <button onClick={handleSign} disabled={!message || !loKeyAddress}>
                Sign
              </button>
              <button onClick={handleVerify} disabled={!signature || !loKeyAddress}>
                Verify
              </button>
              <button
                onClick={() => {
                  setMessage('');
                  setSignature(null);
                  setVerified(false);
                  setError(null);
                }}
              >
                Reset
              </button>
            </div>
            {isVerified ? (
              <div className="row success">Signature verified!</div>
            ) : signature ? (
              <div className="row">Message signed.</div>
            ) : null}
          </div>
          {error && (
            <div className="row error" style={{ fontWeight: 'bold', width: '100%' }}>
              Error: {error.message}
            </div>
          )}
        </div>
      </div>
      <small style={{ paddingTop: '40px', color: '#888' }}>
        Powered by <img src="/orbslogo.svg" alt="Orbs" style={{ height: '12px' }} /> Orbs
      </small>
    </main>
  );
}

export default App;
