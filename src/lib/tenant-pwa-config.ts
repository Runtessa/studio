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

export const normalizePwaConfig = (raw: unknown, fallback = DEFAULT_PWA_CONFIG): TenantPwaConfig => {
  if (raw === undefined || raw === null) return fallback;
  const source = asObject(raw);
  return {
    enabled: source.enabled === true,
    name: stringOrUndefined(source.name),
    shortName: stringOrUndefined(source.shortName ?? source.short_name),
    description: stringOrUndefined(source.description),
    themeColor: stringOrUndefined(source.themeColor ?? source.theme_color) || DEFAULT_PWA_CONFIG.themeColor,
    backgroundColor:
      stringOrUndefined(source.backgroundColor ?? source.background_color) ||
      DEFAULT_PWA_CONFIG.backgroundColor,
    display: normalizeDisplay(source.display),
    startUrl: stringOrUndefined(source.startUrl ?? source.start_url) || DEFAULT_PWA_CONFIG.startUrl,
    scope: stringOrUndefined(source.scope) || DEFAULT_PWA_CONFIG.scope,
    icons: normalizeIcons(source.icons),
  };
};
