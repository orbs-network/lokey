import { useState } from 'react';
import { LoKeySignature } from '../../dist/';
import { useLoKey } from './useLoKey';

function App() {
  const loKey = useLoKey();
  const [signature, setSignature] = useState<LoKeySignature | null>(null);
  const [message, setMessage] = useState('');
  const [isVerified, setVerified] = useState(false);
  const [registered, setRegistered] = useState(loKey.signerExists());

  return (
    <main>
      <h1>LoKey</h1>
      <div className="column">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button
            onClick={async () => {
              await loKey.initializeSigner();
              setRegistered(loKey.signerExists());
            }}
            disabled={registered}
          >
            Register
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
        <div className="row">
          <input
            type="text"
            placeholder="Message"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
            }}
          />
          <button
            onClick={async () => {
              const sig = await loKey.sign(message);
              setSignature(sig);
              console.log(sig);
            }}
            disabled={!message}
          >
            Sign
          </button>
          <button
            onClick={async () => {
              if (!signature) {
                return;
              }
              try {
                const verified = await loKey.verify(signature.signature, signature.data);
                setVerified(verified);
              } catch (error) {
                console.error(error);
              }
            }}
            disabled={!signature}
          >
            Verify
          </button>
        </div>
        {isVerified ? (
          <div className="row success">Signature verified!</div>
        ) : signature ? (
          <div className="row">Message signed</div>
        ) : null}
      </div>
    </main>
  );
}

export default App;
