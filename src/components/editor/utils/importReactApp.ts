import { buildSharedBundle, extractUiDependencies } from '@/components/editor/utils/shared';
import type { SharedFileDto, SharedProjectDto } from '@/components/editor/types';

type ImportedFile = {
  path: string;
  content: string;
  fileExtension: string;
};

export type ImportedReactAppPayload = {
  suggestedName: string;
  suggestedVersion: string;
  entryPath: string;
  entrySource: string;
  fileExtension: 'js' | 'jsx' | 'json' | 'css';
  dependencies: string[];
  codeBlob: string;
  fileCount: number;
};

const BUILTIN_DEPS = new Set([
  'react',
  'react-dom',
  'react-dom/client',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
]);

const PATH_IGNORES = [
  /^node_modules\//i,
  /^dist\//i,
  /^build\//i,
  /^coverage\//i,
  /^\.next\//i,
  /^\.git\//i,
];

const SOURCE_EXTS = new Set([
  'js',
  'jsx',
  'ts',
  'tsx',
  'css',
  'json',
]);

const normalizePath = (value: string) =>
  value.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/{2,}/g, '/').trim();

const sanitizeNameSegment = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

const normalizeUiEntityName = (rawName: string) => {
  const trimmed = String(rawName || '').trim();
  const fallback = '@app/imported-app';
  if (!trimmed) return fallback;
  if (trimmed.startsWith('@app/')) return trimmed;
  const withoutScope = trimmed.startsWith('@')
    ? trimmed.split('/').slice(1).join('/')
    : trimmed;
  const parts = withoutScope
    .split(/[\\/]+/g)
    .map((item) => sanitizeNameSegment(item))
    .filter(Boolean);
  if (!parts.length) return fallback;
  return `@app/${parts.join('/')}`;
};

const toUiFileExtension = (entryPath: string): 'js' | 'jsx' | 'json' | 'css' => {
  const ext = (entryPath.split('.').pop() || '').toLowerCase();
  if (ext === 'css') return 'css';
  if (ext === 'json') return 'json';
  if (ext === 'js') return 'js';
  return 'jsx';
};

const pickRootPrefix = (paths: string[]) => {
  if (!paths.length) return '';
  const firstParts = normalizePath(paths[0]).split('/').filter(Boolean);
  if (firstParts.length <= 1) return '';
  const root = firstParts[0];
  const allShareRoot = paths.every((value) => {
    const normalized = normalizePath(value);
    return normalized === root || normalized.startsWith(`${root}/`);
  });
  return allShareRoot ? root : '';
};

const resolveEntryPath = (
  files: ImportedFile[],
  packageJson: Record<string, unknown> | null
) => {
  const filePathSet = new Set(files.map((file) => file.path));
  const exists = (value: string) => filePathSet.has(normalizePath(value));
  const withKnownExt = (value: string) => {
    const normalized = normalizePath(value);
    if (exists(normalized)) return normalized;
    const candidates = ['.tsx', '.ts', '.jsx', '.js', '.json', '.css'];
    for (const ext of candidates) {
      if (exists(`${normalized}${ext}`)) return `${normalized}${ext}`;
    }
    return '';
  };

  const preferred: string[] = [];
  const pushIfString = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) preferred.push(value.trim());
  };
  if (packageJson) {
    pushIfString(packageJson.source);
    pushIfString(packageJson.module);
    pushIfString(packageJson.main);
    const browser = packageJson.browser;
    if (typeof browser === 'string') pushIfString(browser);
  }

  preferred.push(
    'src/main.tsx',
    'src/main.ts',
    'src/main.jsx',
    'src/main.js',
    'src/index.tsx',
    'src/index.ts',
    'src/index.jsx',
    'src/index.js',
    'index.tsx',
    'index.ts',
    'index.jsx',
    'index.js'
  );

  for (const candidate of preferred) {
    const matched = withKnownExt(candidate);
    if (matched) return matched;
  }
  const fallback = files.find((item) => item.path.startsWith('src/')) || files[0];
  return fallback?.path || '';
};

const collectPackageDeps = (packageJson: Record<string, unknown> | null) => {
  const out = new Set<string>();
  if (!packageJson) return out;
  const sections = [
    packageJson.dependencies,
    packageJson.peerDependencies,
    packageJson.optionalDependencies,
  ];
  for (const section of sections) {
    if (!section || typeof section !== 'object') continue;
    for (const key of Object.keys(section as Record<string, unknown>)) {
      const dep = key.trim();
      if (!dep || BUILTIN_DEPS.has(dep)) continue;
      if (dep.startsWith('.') || dep.startsWith('/')) continue;
      out.add(dep);
    }
  }
  return out;
};

export const importReactAppFromDirectory = async (
  fileList: FileList
): Promise<ImportedReactAppPayload> => {
  const rawFiles = Array.from(fileList || []);
  if (!rawFiles.length) {
    throw new Error('No files selected.');
  }

  const rootPrefix = pickRootPrefix(
    rawFiles.map((file) => String((file as any).webkitRelativePath || file.name || ''))
  );

  const importedFiles: ImportedFile[] = [];
  for (const file of rawFiles) {
    const rel = normalizePath(String((file as any).webkitRelativePath || file.name || ''));
    if (!rel) continue;
    const stripped = rootPrefix && rel.startsWith(`${rootPrefix}/`) ? rel.slice(rootPrefix.length + 1) : rel;
    if (!stripped) continue;
    if (PATH_IGNORES.some((pattern) => pattern.test(stripped))) continue;
    const ext = (stripped.split('.').pop() || '').toLowerCase();
    if (!SOURCE_EXTS.has(ext)) continue;
    const content = await file.text();
    importedFiles.push({
      path: stripped,
      content,
      fileExtension: ext,
    });
  }

  if (!importedFiles.length) {
    throw new Error('No supported source files found in selected directory.');
  }

  const packageFile =
    importedFiles.find((file) => file.path === 'package.json') ||
    importedFiles.find((file) => file.path.endsWith('/package.json')) ||
    null;
  let packageJson: Record<string, unknown> | null = null;
  if (packageFile) {
    try {
      packageJson = JSON.parse(packageFile.content);
    } catch {
      packageJson = null;
    }
  }

  const entryPath = resolveEntryPath(importedFiles, packageJson);
  if (!entryPath) {
    throw new Error('Failed to detect app entry file.');
  }
  const entryFile = importedFiles.find((file) => file.path === entryPath);
  if (!entryFile) {
    throw new Error('Detected entry file is missing from selected files.');
  }

  const packageDeps = collectPackageDeps(packageJson);
  const sourceConcat = importedFiles
    .filter((file) => ['js', 'jsx', 'ts', 'tsx'].includes(file.fileExtension))
    .map((file) => file.content)
    .join('\n\n');
  for (const dep of extractUiDependencies(sourceConcat)) {
    if (!BUILTIN_DEPS.has(dep)) packageDeps.add(dep);
  }

  const suggestedName = normalizeUiEntityName(
    typeof packageJson?.name === 'string' ? packageJson.name : rootPrefix || 'imported-app'
  );
  const suggestedVersion =
    typeof packageJson?.version === 'string' && packageJson.version.trim()
      ? packageJson.version.trim()
      : '1.0.0';
  const dependencies = Array.from(packageDeps).sort((a, b) => a.localeCompare(b));
  const fileExtension = toUiFileExtension(entryPath);

  const project = {
    id: '__import__',
    name: suggestedName,
    version: suggestedVersion,
    entryPath,
    dependencies,
    fileExtension,
  } as SharedProjectDto;
  const files = importedFiles.map((file) => ({
    id: file.path,
    path: file.path,
    fileExtension: file.fileExtension,
    content: file.content,
  })) as SharedFileDto[];
  const codeBlob = buildSharedBundle(project, files);

  return {
    suggestedName,
    suggestedVersion,
    entryPath,
    entrySource: entryFile.content,
    fileExtension,
    dependencies,
    codeBlob,
    fileCount: importedFiles.length,
  };
};
