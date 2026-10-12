const { load } = require('./security-harness.cjs');
const normalization = load('src/lib/assistant/respond-runtime/codex-normalization.ts');
const directives = load('src/lib/assistant/respond-runtime/codex-directives.ts', {
  './codex-normalization': normalization,
});
const batch = load('src/lib/assistant/respond-runtime/workspace-file-batch.ts', {
  './codex-normalization': normalization,
  './codex-directives': directives,
});
const operationMocks = {
  './codex-normalization': normalization,
  './codex-directives': directives,
  './workspace-file-batch': batch,
  './codex-types': load('src/lib/assistant/respond-runtime/codex-types.ts'),
};
function memoryRedis() {
  const strings = new Map(),
    hashes = new Map(),
    indexes = new Map();
  return {
    strings,
    hashes,
    indexes,
    get: async (key) => strings.get(key) || null,
    set: async (key, value, ...options) => {
      if (options.includes('NX') && strings.has(key)) return null;
      strings.set(key, value);
      return 'OK';
    },
    hget: async (key, field) => hashes.get(key)?.[field] || null,
    hgetall: async (key) => hashes.get(key) || {},
    hset: async (key, values, value) => {
      hashes.set(key, { ...hashes.get(key), ...(typeof values === 'string' ? { [values]: value } : values) });
    },
    expire: async () => 1,
    del: async (key) => {
      strings.delete(key);
      hashes.delete(key);
      return 1;
    },
    zadd: async (key, score, value) => {
      const index = indexes.get(key) || [];
      if (!index.includes(value)) index.push(value);
      indexes.set(key, index);
    },
    zrem: async (key, value) => {
      indexes.set(
        key,
        (indexes.get(key) || []).filter((id) => id !== value),
      );
    },
    zrevrange: async (key, start, end) =>
      (indexes.get(key) || [])
        .slice()
        .reverse()
        .slice(start, end + 1),
    eval: async (script, count, key, expected) => {
      if (strings.get(key) !== expected) return 0;
      if (script.includes("'del'")) strings.delete(key);
      return 1;
    },
  };
}
module.exports = { operationMocks, memoryRedis, normalization, directives, batch };
