const memoryStore = new Map();

const mockAsyncStorage = {
  getItem: async (key) => memoryStore.get(key) ?? null,
  setItem: async (key, val) => {
    memoryStore.set(key, String(val));
  },
  removeItem: async (key) => {
    memoryStore.delete(key);
  },
  clear: async () => {
    memoryStore.clear();
  },
  getAllKeys: async () => Array.from(memoryStore.keys()),
  multiGet: async (keys) => keys.map((k) => [k, memoryStore.get(k) ?? null]),
  multiSet: async (keyValuePairs) => {
    for (const [k, v] of keyValuePairs) {
      memoryStore.set(k, String(v));
    }
  },
  multiRemove: async (keys) => {
    for (const k of keys) {
      memoryStore.delete(k);
    }
  },
  // Helper for tests to inspect/reset state
  __dump: () => Object.fromEntries(memoryStore),
  __clear: () => memoryStore.clear(),
};

export default mockAsyncStorage;
export const {
  getItem,
  setItem,
  removeItem,
  clear,
  getAllKeys,
  multiGet,
  multiSet,
  multiRemove,
} = mockAsyncStorage;
