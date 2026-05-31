import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import vm from 'vm';

const TAILWIND_INPUT = '@tailwind base;\n@tailwind components;\n@tailwind utilities;';
const TAILWIND_SUFFIX = '__tw';
const TAILWIND_CONFIG_NAMES = [
  'tailwind.config',
  'tailwind.config.js',
  'tailwind.config.cjs',
  'tailwind.config.mjs',
  'tailwind.config.json',
];
const TAILWIND_CONFIG_TIMEOUT_MS = 250;

const normalizeConfigName = (value: string) =>
  value.replace(/\\/g, '/').split('/').filter(Boolean).pop()?.toLowerCase() ?? '';

export const getTailwindPackageName = (name: string) => `${name}${TAILWIND_SUFFIX}`;

export const isTailwindPackageName = (name: string) => name.endsWith(TAILWIND_SUFFIX);

export const isTailwindConfigName = (name: string) =>
  TAILWIND_CONFIG_NAMES.includes(normalizeConfigName(name));

export const isTailwindConfigPath = (path: string) =>
  TAILWIND_CONFIG_NAMES.includes(normalizeConfigName(path));

export const shouldBuildTailwind = (fileExtension?: string) =>
  (fileExtension ?? 'jsx').toLowerCase() !== 'css';

export const ensureTailwindDependency = (deps: string[], tailwindName: string) => {
  const filtered = deps.filter((dep) => dep !== tailwindName);
  return [...filtered, tailwindName];
};

export const stripTailwindDependency = (deps: string[], tailwindName: string) =>
  deps.filter((dep) => dep !== tailwindName);

export type TailwindSource = { raw: string; extension: string };

const cloneTailwindConfigValue = (value: unknown, seen = new WeakSet<object>()): unknown => {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (value instanceof RegExp) {
    return new RegExp(value.source, value.flags);
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => cloneTailwindConfigValue(item, seen))
      .filter((item) => item !== undefined);
  }
  if (typeof value !== 'object') {
    return undefined;
  }
  if (seen.has(value as object)) {
    throw new Error('Tailwind config cannot contain circular references');
  }
  seen.add(value as object);
  const tag = Object.prototype.toString.call(value);
  if (tag !== '[object Object]') {
    return undefined;
  }
  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const cloned = cloneTailwindConfigValue(nested, seen);
    if (cloned !== undefined) {
      output[key] = cloned;
    }
  }
  seen.delete(value as object);
  return output;
};

export const parseTailwindConfig = (source: string) => {
  const trimmed = (source ?? '').trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  try {
    const module = { exports: {} as Record<string, unknown> | unknown };
    const exportReady = trimmed.replace(/export default\s+/g, 'module.exports = ');
    const context = vm.createContext(
      {
        module,
        exports: module.exports,
      },
      {
        name: 'tailwind-config-sandbox',
        codeGeneration: {
          strings: false,
          wasm: false,
        },
      },
    );
    const script = new vm.Script(`"use strict";\n${exportReady}`, {
      filename: 'tailwind.config.js',
    });
    script.runInContext(context, { timeout: TAILWIND_CONFIG_TIMEOUT_MS });
    const resolved = (module.exports as any)?.default ?? module.exports;
    if (!resolved || typeof resolved !== 'object') return null;
    const cloned = cloneTailwindConfigValue(resolved);
    if (!cloned || typeof cloned !== 'object' || Array.isArray(cloned)) return null;
    return cloned as Record<string, any>;
  } catch {
    return null;
  }
};

export const buildTailwindCss = async (
  source: string | TailwindSource[],
  extension?: string,
  config?: Record<string, any> | null
): Promise<string> => {
  const envPreflight = process.env.TAILWIND_PREFLIGHT;
  const sources = Array.isArray(source)
    ? source
        .filter((item) => item && typeof item.raw === 'string')
        .map((item) => ({
          raw: item.raw,
          extension: (item.extension || 'jsx').replace(/^\./, '').toLowerCase(),
        }))
    : [
        {
          raw: source,
          extension: (extension || 'jsx').replace(/^\./, '').toLowerCase(),
        },
      ];

  const corePlugins = {
    ...(config?.corePlugins ?? {}),
  } as Record<string, any>;
  if (envPreflight === 'true') corePlugins.preflight = true;
  if (envPreflight === 'false') corePlugins.preflight = false;

  const resolvedConfig = {
    ...(config ?? {}),
    content: sources.map((item) => ({
      raw: item.raw,
      extension: item.extension,
    })),
    corePlugins,
  };
  const { default: cssnano } = await import('cssnano');
  const result = await postcss([
    tailwindcss(resolvedConfig),
    autoprefixer(),
    cssnano({ preset: 'default' }),
  ]).process(TAILWIND_INPUT, { from: undefined });
  return result.css;
};
