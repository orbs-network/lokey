import { useState } from 'react';
import { LoKey } from '../../dist/loKey.js';

const loKey = new LoKey();

function App() {
  const [signature, setSignature] = useState('');
  const [message, setMessage] = useState('');
  const [isVerified, setVerified] = useState(false);

  return (
    <main>
      <h1>LoKey</h1>
      <div className="column">
        <div className="row">
          <button
            onClick={async () => {
              await loKey.initializeSigner();
            }}
          >
            Initialize
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
              // const sig = await loKey.sign(message);
              setSignature('');
            }}
          >
            Sign
          </button>
        </div>
        <div className="row">
          <input type="text" placeholder="Signature" value={signature} readOnly />
          <button
            onClick={async () => {
              // const verified = await loKey.verify(message, signature);
              setVerified(false);
              // setTimeout(() => {
              //   setVerified(false);
              // }, 5000);
            }}
          >
            Verify
          </button>
        </div>
        {isVerified && <div className="row success">Signature verified!</div>}
      </div>
    </main>
  );
}

export default App;
