export const STAGES = ['dev', 'test', 'prerelease', 'publish'] as const;
export const SQL_ADAPTERS = new Set(['postgres', 'mysql', 'mssql']);
export const COMMON_ADAPTERS = [
  {
    key: 'postgres',
    label: 'Postgres',
    description: 'Primary relational database',
    defaultOption: 'primary',
    mode: 'readWrite',
  },
  {
    key: 'mysql',
    label: 'MySQL',
    description: 'Alternative relational database',
    defaultOption: 'primary',
    mode: 'readWrite',
  },
  {
    key: 'mssql',
    label: 'MSSQL',
    description: 'Microsoft SQL database',
    defaultOption: 'primary',
    mode: 'readWrite',
  },
  {
    key: 'redis',
    label: 'Redis',
    description: 'Cache and low-latency state',
    defaultOption: 'cache',
    mode: 'single',
  },
  {
    key: 'kafka',
    label: 'Kafka',
    description: 'Event streaming and messaging',
    defaultOption: 'events',
    mode: 'single',
  },
  {
    key: 's3',
    label: 'S3',
    description: 'Object storage for assets',
    defaultOption: 'assets',
    mode: 'single',
  },
] as const;

export type AdapterEntryMode = 'single' | 'readWrite';

export const parseAdapterConfig = (value: string): Record<string, any> => {
  try {
    const parsed = value.trim() ? JSON.parse(value) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

export const stringifyAdapterConfig = (config: Record<string, any>) => JSON.stringify(config, null, 2);

export const asObject = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};

export const asText = (value: unknown) => (typeof value === 'string' ? value : '');

export const asReadText = (value: unknown) => (Array.isArray(value) ? value.join('\n') : asText(value));

export const toReadArray = (value: string) => value.split(/[\n,]+/g).map((item) => item.trim()).filter(Boolean);

export const normalizeConfigKey = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '-');

const titleCase = (value: string) =>
  value
    .split(/[-_.]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const getAdapterMeta = (adapter: string) =>
  COMMON_ADAPTERS.find((entry) => entry.key === normalizeConfigKey(adapter));

export const getAdapterLabel = (adapter: string) =>
  getAdapterMeta(adapter)?.label || titleCase(normalizeConfigKey(adapter)) || 'Custom adapter';

export const getAdapterDescription = (adapter: string) =>
  getAdapterMeta(adapter)?.description || 'Custom integration adapter';

export const getDefaultOptionKey = (adapter: string) =>
  getAdapterMeta(adapter)?.defaultOption || 'primary';

export const getDefaultEntryMode = (adapter: string): AdapterEntryMode =>
  getAdapterMeta(adapter)?.mode || 'single';

const defaultSingleRef = (adapter: string, key: string) => `adapter:${adapter}:${key}:default`;
const stageSingleRef = (adapter: string, key: string, stage: string) => `adapter:${adapter}:${key}:${stage}`;
const defaultReadRef = (adapter: string, key: string) => `adapter:${adapter}:${key}:default:read:1`;
const defaultWriteRef = (adapter: string, key: string) => `adapter:${adapter}:${key}:default:write`;
const stageReadRef = (adapter: string, key: string, stage: string) => `adapter:${adapter}:${key}:${stage}:read:1`;
const stageWriteRef = (adapter: string, key: string, stage: string) => `adapter:${adapter}:${key}:${stage}:write`;

export const buildReadWriteEntry = (adapter: string, key: string) => ({
  default: { read: [defaultReadRef(adapter, key)], write: defaultWriteRef(adapter, key) },
  stages: Object.fromEntries(
    STAGES.map((stage) => [
      stage,
      { read: [stageReadRef(adapter, key, stage)], write: stageWriteRef(adapter, key, stage) },
    ])
  ),
});

export const buildSingleEntry = (adapter: string, key: string) => ({
  default: defaultSingleRef(adapter, key),
  stages: Object.fromEntries(STAGES.map((stage) => [stage, stageSingleRef(adapter, key, stage)])),
});

export const inferEntryMode = (adapter: string, entry?: unknown): AdapterEntryMode => {
  const entryObject = asObject(entry);
  const defaultObject = asObject(entryObject.default);
  if (SQL_ADAPTERS.has(adapter) || 'read' in defaultObject || 'write' in defaultObject) return 'readWrite';
  return 'single';
};

export const nextAvailableKey = (block: Record<string, any>, suggestedKey: string) => {
  let key = normalizeConfigKey(suggestedKey) || 'option';
  let index = 2;
  while (block[key]) key = `${normalizeConfigKey(suggestedKey) || 'option'}${index++}`;
  return key;
};
