import { useState } from 'react';
import { LoKeySignature } from '../../dist/';
import { useLoKey } from './useLoKey';

function App() {
  const loKey = useLoKey();
  const [signature, setSignature] = useState<LoKeySignature | null>(null);
  const [message, setMessage] = useState('');
  const [isVerified, setVerified] = useState(false);
  const [initialised, setInitialised] = useState(loKey.getSigners().length > 0);
  const [currentSigner, setCurrentSigner] = useState<string | null>(
    loKey.getSigners().length > 0 ? loKey.getSigners()[0].publicKey : null
  );
  const [signerName, setSignerName] = useState('');
  const [signerExpiryMins, setSignerExpiryMins] = useState('1');
  const [error, setError] = useState<Error | null>(null);

  return (
    <main>
      <h1>LoKey</h1>
      <div className="column">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button
            onClick={async () => {
              try {
                const publicKey = await loKey.createSigner('LoKey Example App Signer');

                if (!publicKey) {
                  return;
                }

                setInitialised(loKey.getSigners().length > 0);
                setCurrentSigner(publicKey);
              } catch (err) {
                setError(err as Error);
              }
            }}
            disabled={initialised}
          >
            Initialise
          </button>
        </div>
        <div className="column" style={{ gap: 2 }}>
          <label>
            <small>Create signer:</small>
          </label>
          <div className="row">
            <input
              type="text"
              placeholder="Enter Signer Name"
              value={signerName}
              onChange={(e) => {
                setSignerName(e.target.value);
              }}
            />
            <select
              value={signerExpiryMins || ''}
              onChange={(e) => {
                setSignerExpiryMins(e.target.value);
              }}
              style={{ width: '150px', minWidth: '150px' }}
            >
              <option value="1">1 min</option>
              <option value="10">10 mins</option>
              <option value="30">30 mins</option>
              <option value="60">60 mins</option>
            </select>
            <button
              onClick={async () => {
                try {
                  const publicKey = await loKey.createSigner(
                    signerName,
                    Date.now() + Number(signerExpiryMins) * 60 * 1000
                  );
                  setCurrentSigner(publicKey);
                  setSignerName('');
                  setMessage('');
                  setSignature(null);
                  setVerified(false);
                  setError(null);
                } catch (err) {
                  setError(err as Error);
                }
              }}
              disabled={!signerName || !signerExpiryMins}
            >
              Create
            </button>
          </div>
        </div>
        <div className="column" style={{ gap: 2 }}>
          <label>
            <small>Select signer:</small>
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
              <option value="">Select Signer</option>
              {loKey.getSigners().map((signer) => (
                <option key={signer.publicKey} value={signer.publicKey}>
                  {signer.name}
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
                setInitialised(loKey.getSigners().length > 0);
              }}
              disabled={!currentSigner}
            >
              Delete
            </button>
          </div>
        </div>
        <div className="column" style={{ gap: 2 }}>
          <label>
            <small>Enter message:</small>
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
          <div className="row" style={{ fontWeight: 'bold', color: '#aa0022' }}>
            Error: {error.message}
          </div>
        )}
      </div>
    </main>
  );
}

export default App;
