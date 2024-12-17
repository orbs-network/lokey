import { useState } from 'react';
import { LoKeySignature } from '@orbs-network/lokey';
import { useLoKey } from './useLoKey';

function App() {
  const loKey = useLoKey();
  const [signature, setSignature] = useState<LoKeySignature | null>(null);
  const [message, setMessage] = useState('');
  const [isVerified, setVerified] = useState(false);
  const [currentSigner, setCurrentSigner] = useState<string | null>(
    loKey.getSigners().length > 0 ? loKey.getSigners()[0].publicKey : null
  );
  const [signerName, setSignerName] = useState('');
  const [signerExpiryMs, setSignerExpiryMs] = useState('');
  const [error, setError] = useState<Error | null>(null);

  return (
    <main>
      <div className="row" style={{ alignItems: 'center' }}>
        <img src="/lokey_stamp_logo.png" alt="LoKey" style={{ height: '50px', width: 'auto' }} />
        <h1 style={{ fontWeight: 'normal' }}>LoKey</h1>
      </div>
      <div className="column">
        <div className="column" style={{ gap: 2 }}>
          <label>
            <small>
              <strong>Create a signer</strong>
            </small>
          </label>
          <div className="row">
            <input
              type="text"
              placeholder="Enter a name"
              value={signerName}
              onChange={(e) => {
                setSignerName(e.target.value);
              }}
            />
            <select
              value={signerExpiryMs}
              onChange={(e) => {
                setSignerExpiryMs(e.target.value);
              }}
              style={{ width: '150px', minWidth: '150px' }}
            >
              <option value="">No expiry</option>
              <option value={60 * 1000}>1 min</option>
              <option value={60 * 60 * 1000}>1 hour</option>
              <option value={24 * 60 * 60 * 1000}>1 day</option>
              <option value={7 * 24 * 60 * 60 * 1000}>1 week</option>
            </select>
            <button
              onClick={async () => {
                try {
                  const publicKey = await loKey.createSigner(
                    signerName,
                    signerExpiryMs ? Date.now() + Number(signerExpiryMs) : undefined
                  );
                  setCurrentSigner(publicKey);
                  setSignerName('');
                  setMessage('');
                  setSignature(null);
                  setVerified(false);
                  setError(null);
                  setSignerExpiryMs('');
                } catch (err) {
                  setError(err as Error);
                }
              }}
              disabled={!signerName}
            >
              Create
            </button>
          </div>
        </div>
        <div className="column" style={{ gap: 2 }}>
          <label>
            <small>
              <strong>Signer</strong>
            </small>
          </label>

          <div className="row">
            <select
              value={currentSigner || ''}
              onChange={(e) => {
                setCurrentSigner(e.target.value);

                setMessage('');
                setSignature(null);
                setVerified(false);
                setError(null);
              }}
            >
              <option value="">Select a signer</option>
              {loKey.getSigners().map((signer) => (
                <option key={signer.publicKey} value={signer.publicKey}>
                  {signer.name} (
                  {signer.sessionExpiry
                    ? new Date(signer.sessionExpiry).toLocaleString()
                    : 'No expiry'}
                  )
                </option>
              ))}
            </select>
            <button
              onClick={async () => {
                if (!currentSigner) {
                  return;
                }

                loKey.deleteSigner(currentSigner);
                setCurrentSigner('');
                setSignerName('');
                setMessage('');
                setSignature(null);
                setVerified(false);
                setError(null);
              }}
              disabled={!currentSigner}
            >
              Delete
            </button>
          </div>
        </div>
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
            <button
              onClick={async () => {
                setVerified(false);
                setSignature(null);
                if (!message || !currentSigner) {
                  return;
                }

                try {
                  const sig = await loKey.sign(currentSigner, message);
                  setSignature(sig);
                  console.log(sig);
                } catch (err) {
                  setError(err as Error);
                }
              }}
              disabled={!message || !currentSigner}
            >
              Sign
            </button>
            <button
              onClick={async () => {
                setVerified(false);
                if (!signature || !currentSigner) {
                  return;
                }
                try {
                  const verified = await loKey.verify(
                    currentSigner,
                    signature.signature,
                    signature.data
                  );
                  setVerified(verified);
                } catch (err) {
                  setError(err as Error);
                }
              }}
              disabled={!signature || !currentSigner}
            >
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
          <div className="row" style={{ fontWeight: 'bold', color: '#aa0022', width: '100%' }}>
            Error: {error.message}
          </div>
        )}
      </div>
      <small style={{ paddingTop: '40px', color: '#888' }}>
        Powered by <img src="/orbslogo.svg" alt="Orbs" style={{ height: '12px' }} /> Orbs
      </small>
    </main>
  );
}

export default App;
