export type TenantPwaConfig = {
  enabled: boolean;
  name?: string;
  shortName?: string;
  description?: string;
  themeColor?: string;
  backgroundColor?: string;
  display?: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  startUrl?: string;
  scope?: string;
  icons?: Array<{ src: string; sizes: string; type?: string; purpose?: string }>;
};

export const DEFAULT_PWA_CONFIG: TenantPwaConfig = {
  enabled: false,
  display: 'standalone',
  startUrl: '/',
  scope: '/',
  themeColor: '#121212',
  backgroundColor: '#121212',
  icons: [],
};

const asObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const stringOrUndefined = (value: unknown) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const normalizeDisplay = (value: unknown): TenantPwaConfig['display'] => {
  if (value === 'fullscreen' || value === 'minimal-ui' || value === 'browser') return value;
  return 'standalone';
};

const normalizeIcons = (value: unknown): TenantPwaConfig['icons'] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const icon = asObject(item);
      const src = stringOrUndefined(icon.src);
      const sizes = stringOrUndefined(icon.sizes);
      if (!src || !sizes) return null;
      return {
        src,
        sizes,
        type: stringOrUndefined(icon.type),
        purpose: stringOrUndefined(icon.purpose),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
};

const fail = (message: string) => {
  const error = new Error(message);
  (error as any).statusCode = 400;
  throw error;
};

const requireHexColor = (value: string | undefined, label: string) => {
  const next = value || '#121212';
  if (!/^#[0-9a-f]{3}(?:[0-9a-f]{3})?(?:[0-9a-f]{2})?$/i.test(next)) {
    fail(`${label} must be a hex color like #121212`);
  }
  return next;
};

const requireAppPath = (value: string | undefined, label: string) => {
  const next = value || '/';
  if (!next.startsWith('/') || next.startsWith('//') || /\s/.test(next)) {
    fail(`${label} must be a local path starting with /`);
  }
  return next;
};

export const normalizePwaConfig = (
  raw: unknown,
  fallback = DEFAULT_PWA_CONFIG,
  options: { strict?: boolean } = {}
): TenantPwaConfig => {
  if (raw === undefined || raw === null) return fallback;
  const source = asObject(raw);
  const enabled = source.enabled === true;
  const name = stringOrUndefined(source.name);
  const shortName = stringOrUndefined(source.shortName ?? source.short_name);
  const themeColor = stringOrUndefined(source.themeColor ?? source.theme_color) || DEFAULT_PWA_CONFIG.themeColor;
  const backgroundColor =
    stringOrUndefined(source.backgroundColor ?? source.background_color) ||
    DEFAULT_PWA_CONFIG.backgroundColor;
  const startUrl = stringOrUndefined(source.startUrl ?? source.start_url) || DEFAULT_PWA_CONFIG.startUrl;
  const scope = stringOrUndefined(source.scope) || DEFAULT_PWA_CONFIG.scope;

  if (options.strict && enabled) {
    if (name && name.length > 120) fail('PWA app name must be 120 characters or less');
    if (shortName && shortName.length > 32) fail('PWA short name must be 32 characters or less');
    requireHexColor(themeColor, 'PWA theme color');
    requireHexColor(backgroundColor, 'PWA background color');
    requireAppPath(startUrl, 'PWA start URL');
    requireAppPath(scope, 'PWA scope');
  }

  return {
    enabled,
    name,
    shortName,
    description: stringOrUndefined(source.description),
    themeColor,
    backgroundColor,
    display: normalizeDisplay(source.display),
    startUrl,
    scope,
    icons: normalizeIcons(source.icons),
  };
};
