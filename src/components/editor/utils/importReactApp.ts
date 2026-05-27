import {
  buildSharedBundle,
  extractUiDependencies,
  UI_BUILTIN_DEPENDENCIES,
  UI_INTERNAL_IMPORT_PREFIX,
} from '@/components/editor/utils/shared';
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
  files: Array<{
    path: string;
    fileExtension: string;
    content: string;
  }>;
};

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
const NON_RUNTIME_BASENAMES = new Set([
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb',
]);
const NON_RUNTIME_PATH_PATTERNS = [
  /(^|\/)(tsconfig|jsconfig)\.json$/i,
  /(^|\/)(vite|vitest|webpack|rollup|esbuild|babel|postcss|tailwind|eslint|prettier|jest|tsup|swc)\.config\.[^/]+$/i,
];

const normalizePath = (value: string) =>
  value.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/{2,}/g, '/').trim();
const baseName = (value: string) => {
  const normalized = normalizePath(value);
  const parts = normalized.split('/').filter(Boolean);
  return (parts[parts.length - 1] || '').toLowerCase();
};
const isPackageJsonPath = (value: string) => baseName(value) === 'package.json';
const isRuntimeFilePath = (value: string) => {
  const normalized = normalizePath(value);
  const name = baseName(normalized);
  if (!normalized) return false;
  if (NON_RUNTIME_BASENAMES.has(name)) return false;
  return !NON_RUNTIME_PATH_PATTERNS.some((pattern) => pattern.test(normalized));
};

export const normalizeImportedDraftPath = (value: string) => normalizePath(value);

export const buildImportedDraftFileId = (draftId: string, path: string) =>
  `ui-import-${String(draftId || '').trim()}:${normalizeImportedDraftPath(path)}`;

const resolveRelativePath = (fromFilePath: string, requestPath: string) => {
  const fromParts = normalizePath(fromFilePath).split('/').slice(0, -1);
  const reqParts = String(requestPath || '')
    .split('/')
    .filter((part) => part.length > 0);
  const stack = [...fromParts];
  reqParts.forEach((part) => {
    if (part === '.') return;
    if (part === '..') {
      stack.pop();
      return;
    }
    stack.push(part);
  });
  return normalizePath(stack.join('/'));
};

const rewriteModuleSpecifier = (specifier: string, fromFilePath: string) => {
  const trimmed = String(specifier || '').trim();
  if (!trimmed) return specifier;
  if (!(trimmed.startsWith('./') || trimmed.startsWith('../'))) return specifier;
  const absolutePath = resolveRelativePath(fromFilePath, trimmed);
  const normalized = absolutePath.replace(/\.(css|js|jsx|ts|tsx|json)$/i, '');
  return `${UI_INTERNAL_IMPORT_PREFIX}${normalized}`;
};

const rewriteSourceImports = (source: string, fromFilePath: string) => {
  if (!source) return source;
  const replace = (regex: RegExp) =>
    source.replace(regex, (full, prefix, specifier, suffix) => {
      const nextSpecifier = rewriteModuleSpecifier(String(specifier || ''), fromFilePath);
      if (nextSpecifier === specifier) return full;
      return `${prefix}${nextSpecifier}${suffix}`;
    });
  source = replace(/(^\s*import(?:\s+type)?[\s\S]*?\s+from\s*['"])([^'"]+)(['"]\s*;?)/gm);
  source = replace(/(^\s*import\s*['"])([^'"]+)(['"]\s*;?)/gm);
  source = replace(/(^\s*export(?:\s+type)?[\s\S]*?\s+from\s*['"])([^'"]+)(['"]\s*;?)/gm);
  source = replace(/(require\(\s*['"])([^'"]+)(['"]\s*\))/gm);
  source = replace(/(import\(\s*['"])([^'"]+)(['"]\s*\))/gm);
  return source;
};

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
      if (!dep || UI_BUILTIN_DEPENDENCIES.has(dep)) continue;
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
  let packageJson: Record<string, unknown> | null = null;
  for (const file of rawFiles) {
    const rel = normalizePath(String((file as any).webkitRelativePath || file.name || ''));
    if (!rel) continue;
    const stripped = rootPrefix && rel.startsWith(`${rootPrefix}/`) ? rel.slice(rootPrefix.length + 1) : rel;
    if (!stripped) continue;
    if (PATH_IGNORES.some((pattern) => pattern.test(stripped))) continue;
    if (isPackageJsonPath(stripped)) {
      try {
        packageJson = JSON.parse(await file.text());
      } catch {
        packageJson = null;
      }
      continue;
    }
    const ext = (stripped.split('.').pop() || '').toLowerCase();
    if (!SOURCE_EXTS.has(ext)) continue;
    if (!isRuntimeFilePath(stripped)) continue;
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
  const rewrittenFiles = importedFiles.map((file) => ({
    ...file,
    content: rewriteSourceImports(file.content, file.path),
  }));

  const entryPath = resolveEntryPath(rewrittenFiles, packageJson);
  if (!entryPath) {
    throw new Error('Failed to detect app entry file.');
  }
  const entryFile = rewrittenFiles.find((file) => file.path === entryPath);
  if (!entryFile) {
    throw new Error('Detected entry file is missing from selected files.');
  }

  const packageDeps = collectPackageDeps(packageJson);
  const sourceConcat = rewrittenFiles
    .filter((file) => ['js', 'jsx', 'ts', 'tsx'].includes(file.fileExtension))
    .map((file) => file.content)
    .join('\n\n');
  for (const dep of extractUiDependencies(sourceConcat)) {
    if (!UI_BUILTIN_DEPENDENCIES.has(dep)) packageDeps.add(dep);
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
  const files = rewrittenFiles.map((file) => ({
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
    fileCount: rewrittenFiles.length,
    files: rewrittenFiles.map((file) => ({
      path: file.path,
      fileExtension: file.fileExtension,
      content: file.content,
    })),
  };
};
