// src/db.js — adaptador de almacenamiento.
// Toda persistencia pasa por aquí (nunca por localStorage directo), de modo
// que en el futuro se pueda cambiar el backend (IndexedDB, Supabase, API…)
// sin tocar la UI ni la lógica de la aplicación.

// Detecta si un error de escritura es por límite de cuota del navegador.
export function isQuotaError(error) {
  return (
    error &&
    (error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      (error.code === 22) || // QuotaExceededError (legacy)
      (error.code === 1014) || // Firefox
      (typeof error === 'string' && error.includes('Quota')))
  );
}

// Adapter de respaldo en memoria: solo se usa si localStorage no está
// disponible (p.ej. bloqueo de terceros); los datos se pierden al recargar.
function memoryAdapter() {
  const store = new Map();
  return {
    name: 'memory',
    supported: false,
    get(key) {
      const v = store.get(key);
      return v === undefined ? null : v;
    },
    set(key, value) {
      store.set(key, value);
      return true;
    },
    remove(key) {
      store.delete(key);
      return true;
    },
  };
}

function localStorageAdapter() {
  let ok = true;
  try {
    const probe = '__gd_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
  } catch {
    ok = false;
  }
  return {
    name: 'localStorage',
    supported: ok,
    get(key) {
      try {
        const v = window.localStorage.getItem(key);
        return v === null ? null : v;
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(key, value);
        return true;
      } catch (error) {
        console.warn('[db] No se pudo escribir', key, error);
        return false;
      }
    },
    remove(key) {
      try {
        window.localStorage.removeItem(key);
        return true;
      } catch {
        return false;
      }
    },
  };
}

// `impl` es mutable: arranca en localStorage/memoria (síncrono) y puede
// promoverse a IndexedDB cuando `initStorage()` termina (ver más abajo).
let impl = typeof window !== 'undefined' ? localStorageAdapter() : memoryAdapter();

export const db = {
  name: impl.name,
  supported: impl.supported,

  // Devuelve el string crudo almacenado (o null).
  get(key) {
    return impl.get(key);
  },

  // Guarda el string crudo. Devuelve true/false.
  set(key, value) {
    return impl.set(key, value);
  },

  // Elimina una clave. Devuelve true/false.
  remove(key) {
    return impl.remove(key);
  },
};

// ============================================================
// IndexedDB — almacén principal en móvil/APK (sin tope de ~5 MB).
// El reto: la app lee/escribe de forma SÍNCRONA, pero IndexedDB es
// asíncrono. Solución: una caché en memoria (Map) hidratada desde IDB
// ANTES de arrancar Alpine; las lecturas salen de la caché (síncronas) y
// las escrituras actualizan la caché y se vuelcan a IDB en segundo plano.
// ============================================================
const IDB_NAME = 'gastosdiarios';
const IDB_STORE = 'kv';
const IDB_VERSION = 1;

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const idb = req.result;
      if (!idb.objectStoreNames.contains(IDB_STORE)) idb.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbAdapter(idb, cache) {
  // Las escrituras a IDB se encadenan para no solaparse; si una falla, se
  // registra pero no se interrumpe la app (la caché ya tiene el dato).
  let writeChain = Promise.resolve();
  const flush = (op) => {
    writeChain = writeChain.then(
      () =>
        new Promise((res) => {
          try {
            const tx = idb.transaction(IDB_STORE, 'readwrite');
            op(tx.objectStore(IDB_STORE));
            tx.oncomplete = () => res();
            tx.onerror = () => {
              console.warn('[db] Error escribiendo en IndexedDB', tx.error);
              res();
            };
          } catch (e) {
            console.warn('[db] Transacción IndexedDB fallida', e);
            res();
          }
        })
    );
    return writeChain;
  };
  return {
    name: 'indexeddb',
    supported: true,
    get(key) {
      const v = cache.get(key);
      return v === undefined ? null : v;
    },
    set(key, value) {
      cache.set(key, value);
      flush((store) => store.put(value, key));
      return true;
    },
    remove(key) {
      cache.delete(key);
      flush((store) => store.delete(key));
      return true;
    },
  };
}

// Lee todas las entradas de IDB a un Map (hidratación de la caché).
function readAllFromIDB(idb) {
  return new Promise((resolve, reject) => {
    const cache = new Map();
    const tx = idb.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).openCursor();
    req.onsuccess = () => {
      const cur = req.result;
      if (cur) {
        cache.set(cur.key, cur.value);
        cur.continue();
      } else {
        resolve(cache);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

// Debe llamarse (y esperarse) ANTES de arrancar Alpine. Promueve el almacén
// a IndexedDB; si IDB no está disponible, mantiene localStorage/memoria.
// Nunca rechaza: ante cualquier fallo conserva el impl actual.
export async function initStorage() {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return db;
  try {
    const idb = await openIDB();
    const cache = await readAllFromIDB(idb);

    // Migración única: si IDB está vacío pero hay datos en localStorage,
    // copiarlos (se COPIAN, no se mueven: localStorage queda intacto para
    // claves que se leen directo, como gd-mode / gd-last-activity).
    if (cache.size === 0 && typeof window.localStorage !== 'undefined') {
      const puts = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k == null) continue;
        const v = window.localStorage.getItem(k);
        if (v == null) continue;
        cache.set(k, v);
        puts.push([k, v]);
      }
      if (puts.length) {
        await new Promise((res) => {
          const tx = idb.transaction(IDB_STORE, 'readwrite');
          const store = tx.objectStore(IDB_STORE);
          for (const [k, v] of puts) store.put(v, k);
          tx.oncomplete = () => res();
          tx.onerror = () => res();
        });
        console.info(`[db] Migrados ${puts.length} registros de localStorage a IndexedDB`);
      }
    }

    impl = idbAdapter(idb, cache);
    db.name = impl.name;
    db.supported = impl.supported;
  } catch (e) {
    console.warn(`[db] IndexedDB no disponible, se usa ${impl.name}`, e);
  }
  return db;
}
