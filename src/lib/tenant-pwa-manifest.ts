import type { TenantPwaFormState } from './tenant-config-validation';

const asObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const stringValue = (value: unknown, fallback = '') => {
  if (typeof value !== 'string') return fallback;
  return value;
};

const normalizeDisplay = (
  value: unknown
): TenantPwaFormState['display'] =>
  value === 'fullscreen' || value === 'minimal-ui' || value === 'browser'
    ? value
    : 'standalone';

const normalizeIcons = (value: unknown): TenantPwaFormState['icons'] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const icon = asObject(item);
      const src = stringValue(icon.src).trim();
      const sizes = stringValue(icon.sizes).trim();
      if (!src || !sizes) return null;
      return {
        src,
        sizes,
        type: stringValue(icon.type).trim() || undefined,
        purpose: stringValue(icon.purpose).trim() || undefined,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
};

export const serializeTenantPwaManifest = (value: TenantPwaFormState) =>
  JSON.stringify(
    {
      name: value.name.trim() || undefined,
      short_name: value.shortName.trim() || undefined,
      description: value.description.trim() || undefined,
      theme_color: value.themeColor.trim() || '#121212',
      background_color: value.backgroundColor.trim() || '#121212',
      display: value.display,
      start_url: value.startUrl.trim() || '/',
      scope: value.scope.trim() || '/',
      icons: value.icons,
    },
    null,
    2
  );

export const parseTenantPwaManifest = (
  text: string,
  current: TenantPwaFormState
): TenantPwaFormState => {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      ...current,
      description: '',
      icons: [],
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error('Manifest JSON must be valid JSON');
  }

  const manifest = asObject(parsed);
  return {
    ...current,
    name: stringValue(manifest.name, current.name),
    shortName: stringValue(manifest.short_name ?? manifest.shortName, current.shortName),
    description: stringValue(manifest.description, current.description),
    themeColor: stringValue(manifest.theme_color ?? manifest.themeColor, current.themeColor) || '#121212',
    backgroundColor:
      stringValue(manifest.background_color ?? manifest.backgroundColor, current.backgroundColor) ||
      '#121212',
    display: normalizeDisplay(manifest.display),
    startUrl: stringValue(manifest.start_url ?? manifest.startUrl, current.startUrl) || '/',
    scope: stringValue(manifest.scope, current.scope) || '/',
    icons: normalizeIcons(manifest.icons),
  };
};
