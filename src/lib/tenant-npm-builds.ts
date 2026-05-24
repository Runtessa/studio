import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { build } from 'esbuild';
import { CompiledCode, SourceCode, Tenant, TenantNpmPackageBuild } from '@idp/shared';
import { CoreDataSource } from './core-db';

const execFileAsync = promisify(execFile);
const EXTERNALS = ['react', 'react-dom', 'react-dom/client'];

type ParsedSpecifier = {
  installName: string;
  requestSpecifier: string;
  runtimeSpecifier: string;
};

type BuiltArtifact = {
  specifier: string;
  installName: string;
  requestedVersion: string;
  resolvedVersion: string;
  packageMetadata: Record<string, unknown>;
  bundledSource: string;
  dependencies: string[];
};

const isBlockedName = (name: string) =>
  name.startsWith('@app/') || name.startsWith('@idp/') || name.startsWith('idp/');

const parseRequestSpecifier = (request: string): ParsedSpecifier | null => {
  const normalized = String(request || '').trim();
  if (!normalized) return null;
  if (normalized.startsWith('.') || normalized.startsWith('/')) return null;
  if (
    normalized.includes('\0') ||
    normalized.includes('\\') ||
    normalized.includes('..') ||
    normalized.includes('?') ||
    normalized.includes('#')
  ) {
    return null;
  }

  if (normalized === 'react-router/dom') {
    return {
      installName: 'react-router-dom',
      requestSpecifier: normalized,
      runtimeSpecifier: 'react-router-dom',
    };
  }

  const parts = normalized.split('/').filter(Boolean);
  if (!parts.length) return null;
  if (normalized.startsWith('@')) {
    if (parts.length < 2) return null;
    const scope = parts[0];
    const pkg = parts[1];
    if (!/^@[a-z0-9][a-z0-9._-]*$/i.test(scope)) return null;
    if (!/^[a-z0-9][a-z0-9._-]*$/i.test(pkg)) return null;
    return {
      installName: `${scope}/${pkg}`,
      requestSpecifier: normalized,
      runtimeSpecifier: normalized,
    };
  }
  const pkg = parts[0];
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(pkg)) return null;
  return {
    installName: pkg,
    requestSpecifier: normalized,
    runtimeSpecifier: normalized,
  };
};

const resolvePackageJsonPath = (workDir: string, packageName: string) =>
  path.join(workDir, 'node_modules', ...packageName.split('/'), 'package.json');

const runNpmInstall = async (workDir: string, spec: string) => {
  await execFileAsync(
    'npm',
    ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--omit=dev', '--no-package-lock', spec],
    {
      cwd: workDir,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, NODE_ENV: 'production' },
    }
  );
};

const bundleSpecifier = async (workDir: string, requestSpecifier: string) => {
  const entryPath = path.join(workDir, '__idp_npm_entry__.js');
  await fs.writeFile(entryPath, `module.exports = require(${JSON.stringify(requestSpecifier)});\n`, 'utf8');
  const result = await build({
    absWorkingDir: workDir,
    entryPoints: [entryPath],
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'browser',
    target: ['es2019'],
    external: EXTERNALS,
    logLevel: 'silent',
    mainFields: ['browser', 'module', 'main'],
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
      global: 'globalThis',
    },
    loader: {
      '.css': 'text',
      '.svg': 'text',
      '.png': 'dataurl',
      '.jpg': 'dataurl',
      '.jpeg': 'dataurl',
      '.gif': 'dataurl',
    },
  });
  const bundled = result.outputFiles?.[0]?.text;
  if (!bundled) throw new Error(`Failed to bundle npm package ${requestSpecifier}`);
  return bundled;
};

const cleanupDir = async (dir: string) => {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // ignore temp cleanup errors
  }
};

const isDuplicateKeyError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;
  const message = String((error as { message?: unknown }).message || '');
  return message.includes('duplicate key value violates unique constraint');
};

const buildArtifact = async (request: string, requestedVersion: string): Promise<BuiltArtifact> => {
  const parsed = parseRequestSpecifier(request);
  if (!parsed) throw new Error(`Invalid npm package specifier: ${request}`);
  if (isBlockedName(parsed.requestSpecifier) || isBlockedName(parsed.installName)) {
    throw new Error(`Blocked npm package specifier: ${request}`);
  }

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'idp-tenant-npm-'));
  try {
    await fs.writeFile(
      path.join(tempRoot, 'package.json'),
      JSON.stringify({ name: 'idp-tenant-npm-build', private: true }),
      'utf8'
    );

    await runNpmInstall(tempRoot, `${parsed.installName}@${requestedVersion}`);
    const bundledSource = await bundleSpecifier(tempRoot, parsed.runtimeSpecifier);
    const packageJsonPath = resolvePackageJsonPath(tempRoot, parsed.installName);
    const packageJsonRaw = await fs.readFile(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonRaw) as Record<string, unknown>;
    const resolvedVersion = String(packageJson.version || requestedVersion).trim() || requestedVersion;

    return {
      specifier: parsed.requestSpecifier,
      installName: parsed.installName,
      requestedVersion,
      resolvedVersion,
      packageMetadata: packageJson,
      bundledSource,
      dependencies: [],
    };
  } finally {
    await cleanupDir(tempRoot);
  }
};

export const ensureTenantNpmBuilds = async (tenant: Tenant, dependencies: string[]) => {
  const requestedVersion = 'latest';
  const specifiers = Array.from(
    new Set(
      (dependencies || [])
        .map((dep) => String(dep || '').trim())
        .filter(Boolean)
    )
  )
    .map((dep) => parseRequestSpecifier(dep))
    .filter((parsed): parsed is ParsedSpecifier => Boolean(parsed))
    .filter((parsed) => !isBlockedName(parsed.requestSpecifier) && !isBlockedName(parsed.installName));

  if (!specifiers.length) return;

  const npmBuildRepo = CoreDataSource.getRepository(TenantNpmPackageBuild);
  const sourceRepo = CoreDataSource.getRepository(SourceCode);
  const compiledRepo = CoreDataSource.getRepository(CompiledCode);

  for (const parsed of specifiers) {
    const existingByRequested = await npmBuildRepo.findOne({
      where: {
        tenant: { id: tenant.id },
        specifier: parsed.requestSpecifier,
        requestedVersion,
      },
      relations: ['compiledCode', 'sourceCode'],
      order: { createdAt: 'DESC' },
    });
    if (existingByRequested?.compiledCode?.code) {
      let existingRuntimeSpecifier = '';
      try {
        const metadata = existingByRequested.sourceCode?.code
          ? JSON.parse(existingByRequested.sourceCode.code)
          : null;
        if (metadata && typeof metadata.runtimeSpecifier === 'string') {
          existingRuntimeSpecifier = metadata.runtimeSpecifier.trim();
        }
      } catch {
        existingRuntimeSpecifier = '';
      }
      if (
        existingRuntimeSpecifier &&
        existingRuntimeSpecifier === parsed.runtimeSpecifier
      ) {
        continue;
      }
    }

    const artifact = await buildArtifact(parsed.requestSpecifier, requestedVersion);
    const sourceCode = sourceRepo.create({
      code: JSON.stringify(
        {
          specifier: artifact.specifier,
          installName: artifact.installName,
          runtimeSpecifier: parsed.runtimeSpecifier,
          requestedVersion: artifact.requestedVersion,
          resolvedVersion: artifact.resolvedVersion,
          packageJson: artifact.packageMetadata,
        },
        null,
        2
      ),
    });
    const compiledCode = compiledRepo.create({ code: artifact.bundledSource });
    await sourceRepo.save(sourceCode);
    await compiledRepo.save(compiledCode);

    let targetBuild = existingByRequested;
    if (!targetBuild) {
      targetBuild = await npmBuildRepo.findOne({
        where: {
          tenant: { id: tenant.id },
          specifier: artifact.specifier,
          resolvedVersion: artifact.resolvedVersion,
        },
        relations: ['compiledCode', 'sourceCode'],
        order: { createdAt: 'DESC' },
      });
    }

    const npmBuild = targetBuild
      ? Object.assign(targetBuild, {
          installName: artifact.installName,
          requestedVersion: artifact.requestedVersion,
          resolvedVersion: artifact.resolvedVersion,
          sourceCode,
          compiledCode,
          dependencies: artifact.dependencies,
        })
      : npmBuildRepo.create({
          tenant,
          specifier: artifact.specifier,
          installName: artifact.installName,
          requestedVersion: artifact.requestedVersion,
          resolvedVersion: artifact.resolvedVersion,
          sourceCode,
          compiledCode,
          dependencies: artifact.dependencies,
        });

    try {
      await npmBuildRepo.save(npmBuild);
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
      const conflicted = await npmBuildRepo.findOne({
        where: {
          tenant: { id: tenant.id },
          specifier: artifact.specifier,
          resolvedVersion: artifact.resolvedVersion,
        },
      });
      if (!conflicted) {
        throw error;
      }
      conflicted.installName = artifact.installName;
      conflicted.requestedVersion = artifact.requestedVersion;
      conflicted.sourceCode = sourceCode;
      conflicted.compiledCode = compiledCode;
      conflicted.dependencies = artifact.dependencies;
      await npmBuildRepo.save(conflicted);
    }
  }
};
