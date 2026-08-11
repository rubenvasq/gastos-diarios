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

const impl = typeof window !== 'undefined' ? localStorageAdapter() : memoryAdapter();

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
