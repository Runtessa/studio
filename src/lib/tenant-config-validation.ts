export type TenantPwaFormState = {
  enabled: boolean;
  name: string;
  shortName: string;
  description: string;
  themeColor: string;
  backgroundColor: string;
  display: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  startUrl: string;
  scope: string;
  icons: Array<{ src: string; sizes: string; type?: string; purpose?: string }>;
};

export type TenantPwaFieldErrors = Partial<Record<keyof TenantPwaFormState, string>>;

export type TenantConfigFormInput = {
  hostname: string;
  memory: string;
  timeout: string;
  authDbMode: 'shared' | 'dedicated';
  authDbSecretKey: string;
  pwa: TenantPwaFormState;
};

export type TenantConfigFormErrors = {
  hostname: string;
  memory: string;
  timeout: string;
  authDbSecretKey: string;
  adapterConfig: string;
  pwa: TenantPwaFieldErrors;
};

export const emptyTenantConfigErrors = (): TenantConfigFormErrors => ({
  hostname: '',
  memory: '',
  timeout: '',
  authDbSecretKey: '',
  adapterConfig: '',
  pwa: {},
});

const fail = (message: string): never => {
  const error = new Error(message);
  (error as any).statusCode = 400;
  throw error;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const normalizeTenantHostname = (raw: unknown) => {
  const rawHostname = typeof raw === 'string' ? raw.trim() : '';
  if (!rawHostname) fail('Hostname is required');
  const hostname = rawHostname.toLowerCase();
  if (hostname.length > 253) fail('Hostname must be 253 characters or less');
  if (/^https?:\/\//i.test(hostname) || /[\s/:?#]/.test(hostname)) {
    fail('Hostname must not include protocol, port, path, or spaces');
  }
  if (hostname === 'localhost') return hostname;
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
    const validIp = hostname.split('.').every((part: string) => Number(part) >= 0 && Number(part) <= 255);
    if (validIp) return hostname;
    fail('Hostname IPv4 address is invalid');
  }
  const labels = hostname.split('.');
  if (labels.length < 2) fail('Hostname must be a domain such as tenant.example.com');
  for (const label of labels) {
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) {
      fail('Hostname labels may contain only letters, numbers, and inner hyphens');
    }
  }
  return hostname;
};

export const normalizeBoundedInteger = (
  raw: unknown,
  label: string,
  fallback: number,
  min: number,
  max: number
) => {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const value = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(value)) fail(`${label} must be an integer`);
  if (value < min || value > max) fail(`${label} must be between ${min} and ${max}`);
  return value;
};

export const parseAdapterConfigText = (value: string) => {
  if (!value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    if (!isPlainObject(parsed)) fail('Adapter config must be a JSON object');
    return parsed;
  } catch (error) {
    if ((error as any).statusCode) throw error;
    fail('Adapter config must be valid JSON');
  }
};

const validateHexColor = (value: string, label: string) => {
  if (!/^#[0-9a-f]{3}(?:[0-9a-f]{3})?(?:[0-9a-f]{2})?$/i.test(value.trim())) {
    return `${label} must be a hex color like #121212`;
  }
  return '';
};

const validateAppPath = (value: string, label: string) => {
  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) return `${label} must start with /`;
  if (trimmed.startsWith('//') || /\s/.test(trimmed)) return `${label} must be a local app path`;
  return '';
};

export const validatePwaFields = (pwa: TenantPwaFormState): TenantPwaFieldErrors => {
  const errors: TenantPwaFieldErrors = {};
  if (!pwa.enabled) return errors;
  if (pwa.name.trim().length > 120) errors.name = 'App name must be 120 characters or less';
  if (pwa.shortName.trim().length > 32) errors.shortName = 'Short name must be 32 characters or less';
  if (pwa.description.trim().length > 240) errors.description = 'Description must be 240 characters or less';
  const themeError = validateHexColor(pwa.themeColor || '#121212', 'Theme color');
  if (themeError) errors.themeColor = themeError;
  const backgroundError = validateHexColor(pwa.backgroundColor || '#121212', 'Background color');
  if (backgroundError) errors.backgroundColor = backgroundError;
  const startUrlError = validateAppPath(pwa.startUrl || '/', 'Start URL');
  if (startUrlError) errors.startUrl = startUrlError;
  const scopeError = validateAppPath(pwa.scope || '/', 'Scope');
  if (scopeError) errors.scope = scopeError;
  if (!['standalone', 'fullscreen', 'minimal-ui', 'browser'].includes(pwa.display)) {
    errors.display = 'Display mode is invalid';
  }
  if (
    !Array.isArray(pwa.icons) ||
    pwa.icons.some(
      (icon) =>
        !icon ||
        typeof icon.src !== 'string' ||
        !icon.src.trim() ||
        typeof icon.sizes !== 'string' ||
        !icon.sizes.trim()
    )
  ) {
    errors.icons = 'Each icon must include src and sizes';
  }
  return errors;
};

export const hasTenantConfigErrors = (errors: TenantConfigFormErrors) =>
  Boolean(
    errors.hostname ||
      errors.memory ||
      errors.timeout ||
      errors.authDbSecretKey ||
      errors.adapterConfig ||
      Object.values(errors.pwa).some(Boolean)
  );

export const hasTenantCoreConfigErrors = (errors: TenantConfigFormErrors) =>
  Boolean(
    errors.hostname ||
      errors.memory ||
      errors.timeout ||
      errors.authDbSecretKey ||
      Object.values(errors.pwa).some(Boolean)
  );

export const validateTenantCoreConfigForm = (
  values: TenantConfigFormInput
): TenantConfigFormErrors => {
  const errors = emptyTenantConfigErrors();
  try {
    normalizeTenantHostname(values.hostname);
  } catch (error: any) {
    errors.hostname = error.message || 'Hostname is invalid';
  }
  try {
    normalizeBoundedInteger(values.memory, 'Memory', 512, 64, 262144);
  } catch (error: any) {
    errors.memory = error.message || 'Memory is invalid';
  }
  try {
    normalizeBoundedInteger(values.timeout, 'Timeout', 5000, 100, 300000);
  } catch (error: any) {
    errors.timeout = error.message || 'Timeout is invalid';
  }
  if (values.authDbMode === 'dedicated' && !values.authDbSecretKey.trim()) {
    errors.authDbSecretKey = 'Secret key is required for dedicated auth DB';
  } else if (values.authDbSecretKey && !/^[a-zA-Z0-9:_./-]{1,128}$/.test(values.authDbSecretKey)) {
    errors.authDbSecretKey = 'Secret key contains unsupported characters';
  }
  errors.pwa = validatePwaFields(values.pwa);
  return errors;
};

export const validateAdapterConfigForm = (adapterConfigText: string) => {
  const errors = emptyTenantConfigErrors();
  try {
    parseAdapterConfigText(adapterConfigText);
  } catch (error: any) {
    errors.adapterConfig = error.message || 'Adapter config is invalid';
  }
  return errors;
};

export const validateTenantConfigForm = (
  values: TenantConfigFormInput,
  adapterConfigText: string
): TenantConfigFormErrors => {
  const errors = validateTenantCoreConfigForm(values);
  const adapterErrors = validateAdapterConfigForm(adapterConfigText);
  errors.adapterConfig = adapterErrors.adapterConfig;
  return errors;
};
