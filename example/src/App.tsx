import { useMemo, useState } from 'react';
import { LoKeySignature } from '@orbs-network/lokey';
import { useLoKey } from './useLoKey';

function App() {
  const loKey = useLoKey();
  const [signature, setSignature] = useState<LoKeySignature | null>(null);
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(!!loKey.activeSigner);
  const [message, setMessage] = useState('');
  const [isVerified, setVerified] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const activeSigner = useMemo(() => {
    setIsLoggedIn(!!loKey.activeSigner);
    return loKey.activeSigner;
  }, [loKey.activeSigner]);

  return (
    <main>
      <div className="row" style={{ alignItems: 'center' }}>
        <img src="/lokey_stamp_logo.png" alt="LoKey" style={{ height: '50px', width: 'auto' }} />
        <h1 style={{ fontWeight: 'normal' }}>LoKey</h1>
      </div>
      <div className="column" style={{ gap: 18 }}>
        <div className="column">
          {!isLoggedIn && (
            <div className="column" style={{ gap: 2 }}>
              <label>
                <small>
                  <strong>Login</strong>
                </small>
              </label>

              <div className="row">
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                />
                <button
                  onClick={async () => {
                    if (!password) {
                      return;
                    }

                    try {
                      await loKey.login(password, Date.now() + 60_000);
                      setPassword('');
                    } catch (err) {
                      console.error(err);
                      setError(err as Error);
                      setPassword('');
                    }
                  }}
                  disabled={!!activeSigner}
                >
                  Login
                </button>
              </div>
            </div>
          )}
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
              <button
                onClick={async () => {
                  setVerified(false);
                  setSignature(null);
                  if (!message || !activeSigner) {
                    return;
                  }

                  try {
                    const sig = await loKey.sign(message);
                    setSignature(sig);
                    console.log(sig);
                  } catch (err) {
                    setError(err as Error);
                  }
                }}
                disabled={!message || !activeSigner}
              >
                Sign
              </button>
              <button
                onClick={async () => {
                  setVerified(false);
                  if (!signature || !activeSigner) {
                    return;
                  }
                  try {
                    const verified = await loKey.verify(signature.signature, signature.data);
                    setVerified(verified);
                  } catch (err) {
                    setError(err as Error);
                  }
                }}
                disabled={!signature || !activeSigner}
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
