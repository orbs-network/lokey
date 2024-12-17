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
  const [signerExpiryMins, setSignerExpiryMins] = useState('');

  return (
    <main>
      <h1>LoKey</h1>
      <div className="column">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button
            onClick={async () => {
              const publicKey = await loKey.createSigner('LoKey Example App Signer');

              if (!publicKey) {
                return;
              }

              setInitialised(loKey.getSigners().length > 0);
              setCurrentSigner(publicKey);
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
                const publicKey = await loKey.createSigner(
                  signerName,
                  Date.now() + Number(signerExpiryMins) * 60 * 1000
                );
                setCurrentSigner(publicKey);
                setSignerName('');
                setMessage('');
                setSignature(null);
                setVerified(false);
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
              }}
            />
            <button
              onClick={async () => {
                if (!message || !currentSigner) {
                  return;
                }

                const sig = await loKey.sign(currentSigner, message);
                setSignature(sig);
                console.log(sig);
              }}
              disabled={!message || !currentSigner}
            >
              Sign
            </button>
            <button
              onClick={async () => {
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
                } catch (error) {
                  console.error(error);
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
      </div>
    </main>
  );
}

export default App;
