export function callOnStore(_func: (store: IDBObjectStore) => void) {
  // This works on all devices/browsers, and uses IndexedDBShim as a final fallback
  const indexedDB = window.indexedDB;

  // Open (or create) the database
  const open = indexedDB.open('LoKeyDB', 1);

  // Create the schema
  open.onupgradeneeded = function () {
    const db = open.result;
    db.createObjectStore('LoKeyUser', { keyPath: 'id' });
  };

  open.onsuccess = function () {
    // Start a new transaction
    const db = open.result;
    const tx = db.transaction('LoKeyUser', 'readwrite');
    const store = tx.objectStore('LoKeyUser');

    _func(store);

    // Close the db when the transaction is done
    tx.oncomplete = function () {
      db.close();
    };
  };
}
