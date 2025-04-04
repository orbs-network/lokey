import { useCallback, useEffect, useState } from 'react';
import { useLoKey } from './useLoKey';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useSignTypedData } from 'wagmi';
import { verifyTypedData } from 'viem';

function App() {
  const loKey = useLoKey();
  const [signature, setSignature] = useState<string | null>(null);
  const [id, setId] = useState('');
  const [loKeyAddress, setLoKeyAddress] = useState('');

  const [message, setMessage] = useState('');
  const [isVerified, setVerified] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { signTypedDataAsync } = useSignTypedData();

  const handleGenerate = useCallback(async () => {
    if (!loKey || !id) return;

    try {
      const address = await loKey.createSigner(id);

      const typedData = {
        domain: {
          name: 'LoKey Example',
          verifyingContract: '0x0000000000000000000000000000000000000000' as `0x${string}`,
          version: '1',
          chainId: 1,
        },
        types: {
          Message: [{ name: 'message', type: 'string' }],
        },
        primaryType: 'Message' as const,
        message: { message: 'Delegate a signer' },
      };

      const signature = await signTypedDataAsync(typedData);

      console.log(address, signature);
      setLoKeyAddress(address);
    } catch (err) {
      console.error(err);
      setError(err as Error);
    }
  }, [id, loKey, signTypedDataAsync]);

  const handleSign = useCallback(async () => {
    if (!loKey) return;
    const sig = await loKey.sign(id, {
      domain: {},
      primaryType: 'Message',
      types: {
        Message: [{ name: 'message', type: 'string' }],
      },
      message: { message },
    });
    setSignature(sig);
    console.log('Signature', sig);
  }, [id, loKey, message]);

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
      const res = await verifyTypedData({
        domain: typedData.domain,
        primaryType: typedData.primaryType as 'Message',
        types: typedData.types,
        message: typedData.message,
        signature: signature as `0x${string}`,
        address: loKeyAddress as `0x${string}`,
      });

      console.log(res);
      if (!res) {
        throw new Error('Signature verification failed');
      }
      setVerified(res);
    } catch (err) {
      console.error(err);
      setError(err as Error);
    }
  }, [loKey, loKeyAddress, message, signature]);

  const init = useCallback(async () => {
    if (!loKey) return;
    try {
      const address = await loKey.getAddress(id);
      setLoKeyAddress(address || '');
    } catch (e) {
      console.log(e);
    }
  }, [id, loKey]);

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
        <div className="row" style={{ alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Delegate ID"
            style={{ fontSize: '12px' }}
            value={id}
            onChange={(e) => {
              setId(e.target.value);
            }}
          />

          <button onClick={handleGenerate} disabled={Boolean(loKeyAddress)}>
            Delegate
          </button>
        </div>

        <div className="row" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <input style={{ fontSize: '12px' }} type="text" value={loKeyAddress} readOnly disabled />
          <button
            style={{ fontSize: '12px' }}
            onClick={async () => {
              const success = await loKey.persistKey(id);
              if (!success) {
                setError(new Error('Failed to persist key'));
              }
            }}
            disabled={!loKeyAddress}
          >
            Persist key
          </button>
          <button
            style={{ fontSize: '12px' }}
            onClick={async () => {
              const success = await loKey.deleteKey(id);
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
            <label style={{ fontSize: '12px' }}>
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
