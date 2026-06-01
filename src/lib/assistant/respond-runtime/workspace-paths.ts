export const splitRouteSegments = (routePath: string) => {
  const trimmed = String(routePath || '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
  if (!trimmed) return [] as string[];
  return trimmed.split('/').filter(Boolean);
};

export const splitUiSegments = (name: string) =>
  String(name || '')
    .split(/[\\/]+/g)
    .map((segment) => segment.trim())
    .filter(Boolean);

export const sanitizeForFilename = (value: string) =>
  String(value || '')
    .trim()
    .replace(/^\/+/, '')
    .replace(/[\/\\]+/g, '-')
    .replace(/[:*?<>|"]+/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();

export const toModuleVirtualPath = (mod: {
  routePath: string;
  method: string;
  fileExtension?: string | null;
}) => {
  const ext = (mod.fileExtension || 'js').replace(/^\./, '').toLowerCase() || 'js';
  const segments = splitRouteSegments(mod.routePath || '/');
  const routeDir = segments.length ? `${segments.join('/')}/` : '';
  return `modules/${routeDir}${String(mod.method || 'GET').toLowerCase()}.module.${ext}`;
};

export const toModelVirtualPath = (model: {
  id: string;
  path: string;
  fileExtension?: string | null;
}) => {
  const rawPath = String(model.path || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!rawPath) {
    const ext = (model.fileExtension || 'js').replace(/^\./, '').toLowerCase() || 'js';
    return `models/${model.id}.${ext}`;
  }
  return rawPath.toLowerCase().startsWith('models/') ? rawPath : `models/${rawPath}`;
};

export const toUiVirtualPath = (pkg: {
  name: string;
  fileExtension?: string | null;
}) => {
  const ext = (pkg.fileExtension || 'jsx').replace(/^\./, '').toLowerCase() || 'jsx';
  const nameSegments = splitUiSegments(pkg.name || 'ui');
  const folders = nameSegments.slice(0, -1);
  const base = nameSegments[nameSegments.length - 1] || 'ui';
  const fileName = `${sanitizeForFilename(base)}.ui.${ext}`;
  return folders.length ? `ui/${folders.join('/')}/${fileName}` : `ui/${fileName}`;
};

export const toSharedVirtualPath = (
  root: 'shared-ui' | 'shared-modules',
  projectName: string,
  filePath: string,
) => {
  const name = String(projectName || '').trim();
  const pathPart = String(filePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  return `${root}/${name}/${pathPart}`;
};
