import { LoKey } from '../../dist/loKey.js';

const loKey = new LoKey();

function App() {
  return (
    <>
      <h1>LoKey</h1>
      <div>
        <button onClick={() => loKey.initializeSigner(Date.now() + 7 * 24 * 60 * 60 * 1000)}>
          Initialize
        </button>
        <button onClick={() => loKey.sign('Sign me!')}>Sign</button>
      </div>
    </>
  );
}

export default App;
