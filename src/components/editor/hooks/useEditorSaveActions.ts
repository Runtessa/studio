import { useCallback, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { DEFAULT_MODEL_EXTENSION } from '@/components/editor/constants';
import {
  buildImportedDraftFileId,
  normalizeImportedDraftPath,
} from '@/components/editor/utils/importReactApp';
import {
  buildSharedBundle,
  compileWithBabel,
  coerceModuleExtension,
  coerceUiExtension,
  extractUiDependencies,
  normalizeModelPath,
  normalizeSharedPath,
  parseDependencies,
  resolveSharedExtension,
  UI_BUILTIN_DEPENDENCIES,
} from '@/components/editor/utils';
import type {
  AclConfigDto,
  ActiveFile,
  SharedFileDto,
  SharedProjectDto,
  UIPackageDto,
} from '@/components/editor/types';

type Params = {
  adminFetch: (url: string, options?: { method?: string; body?: unknown }) => Promise<any>;
  apiFetch: (url: string, options?: { method?: string; body?: unknown }) => Promise<any>;
  sharedBasePath: string;
  sharedProject: SharedProjectDto | null;
  setSharedProject: Dispatch<SetStateAction<SharedProjectDto | null>>;
  sharedFilesRef: MutableRefObject<SharedFileDto[]>;
  setSharedFiles: Dispatch<SetStateAction<SharedFileDto[]>>;
  savedContentsRef: MutableRefObject<Record<string, string>>;
  fileContents: Record<string, string>;
  savedContents: Record<string, string>;
  setFileContents: Dispatch<SetStateAction<Record<string, string>>>;
  setSavedContents: Dispatch<SetStateAction<Record<string, string>>>;
  aclConfig: AclConfigDto | null;
  setAclConfig: Dispatch<SetStateAction<AclConfigDto | null>>;
  uiData: UIPackageDto[];
  setUiData: Dispatch<SetStateAction<UIPackageDto[]>>;
  reloadTree: () => Promise<void>;
  loadHistory: () => Promise<void> | void;
  activeFile: ActiveFile | null;
  openFiles: ActiveFile[];
  setActiveFile: Dispatch<SetStateAction<ActiveFile | null>>;
  setOpenFiles: Dispatch<SetStateAction<ActiveFile[]>>;
  isFileDirty: (file: ActiveFile) => boolean;
  success: (message: string) => void;
  showError: (message: string) => void;
};

export const useEditorSaveActions = ({
  adminFetch,
  apiFetch,
  sharedBasePath,
  sharedProject,
  setSharedProject,
  sharedFilesRef,
  setSharedFiles,
  savedContentsRef,
  fileContents,
  savedContents,
  setFileContents,
  setSavedContents,
  aclConfig,
  setAclConfig,
  uiData,
  setUiData,
  reloadTree,
  loadHistory,
  activeFile,
  openFiles,
  setActiveFile,
  setOpenFiles,
  isFileDirty,
  success,
  showError,
}: Params) => {
  const [modelMigrationBusy, setModelMigrationBusy] = useState(false);

  const syncSharedPackage = useCallback(
    async (project: SharedProjectDto, files: SharedFileDto[], entryPathOverride?: string) => {
      const normalizedEntry = normalizeSharedPath(entryPathOverride ?? project.entryPath ?? '');
      if (!normalizedEntry) {
        throw new Error('Shared project entry path is missing.');
      }
      const entryFile = files.find((file) => normalizeSharedPath(file.path) === normalizedEntry);
      if (!entryFile) {
        throw new Error(`Entry file not found: ${normalizedEntry}`);
      }
      const entrySource = entryFile.content ?? '';
      const entryExtension = resolveSharedExtension(normalizedEntry, entryFile.fileExtension);
      const bundle = {
        files: files.map((file) => ({ path: file.path, fileExtension: file.fileExtension, content: file.content ?? '' })),
      };
      await adminFetch(`${sharedBasePath}/${project.id}`, {
        method: 'PUT',
        body: {
          name: project.name,
          version: project.version,
          entryPath: normalizedEntry,
          code: entrySource,
          codeBlob: JSON.stringify(bundle),
          dependencies: project.dependencies ?? [],
          fileExtension: entryExtension,
        },
      });
      return { ...project, entryPath: normalizedEntry };
    },
    [adminFetch, sharedBasePath],
  );

  const saveFile = useCallback(
    async (file: ActiveFile) => {
      const meta = file.meta;
      if (!meta) return;
      const content = fileContents[file.id] ?? savedContents[file.id] ?? '';
      if (meta.kind === 'shared') {
        if (!sharedProject) {
          throw new Error('Shared project is not loaded.');
        }
        const projectId = meta.projectId || sharedProject.id;
        await adminFetch(`${sharedBasePath}/${projectId}/files/${meta.fileId}`, {
          method: 'PUT',
          body: { path: meta.path, content, fileExtension: meta.fileExtension },
        });
        const currentSaved = savedContentsRef.current;
        const currentFiles = sharedFilesRef.current;
        const nextSaved = { ...currentSaved, [file.id]: content };
        const nextFiles = currentFiles.map((item) =>
          item.id === meta.fileId ? { ...item, content } : item,
        );
        const nextProject = await syncSharedPackage(sharedProject, nextFiles);
        savedContentsRef.current = nextSaved;
        sharedFilesRef.current = nextFiles;
        setSharedProject(nextProject);
        setSharedFiles(nextFiles);
        setSavedContents(nextSaved);
        return;
      }
      if (meta.kind === 'acl') {
        let parsed: any;
        try {
          parsed = content.trim() ? JSON.parse(content) : {};
        } catch {
          throw new Error('ACL file must be valid JSON.');
        }
        const response = await apiFetch('/api/acl/config', {
          method: 'PUT',
          body: { file: meta.file, content: parsed },
        });
        const nextAcl: AclConfigDto = {
          permissions: (response as any)?.permissions ?? aclConfig?.permissions ?? { permissions: [] },
          roles: (response as any)?.roles ?? aclConfig?.roles ?? { roles: {} },
          endpoints: (response as any)?.endpoints ?? aclConfig?.endpoints ?? {},
        };
        setAclConfig(nextAcl);
        const normalizedContent =
          meta.file === 'permissions'
            ? JSON.stringify(nextAcl.permissions ?? {}, null, 2) + '\n'
            : meta.file === 'roles'
              ? JSON.stringify(nextAcl.roles ?? {}, null, 2) + '\n'
              : JSON.stringify(nextAcl.endpoints ?? {}, null, 2) + '\n';
        setFileContents((prev) => ({ ...prev, [file.id]: normalizedContent }));
        setSavedContents((prev) => ({ ...prev, [file.id]: normalizedContent }));
        return;
      }
      if (meta.kind === 'model') {
        await apiFetch(`/api/models/${meta.backendId}`, {
          method: 'PUT',
          body: {
            path: normalizeModelPath(meta.path),
            code: content,
            fileExtension: DEFAULT_MODEL_EXTENSION,
          },
        });
        setSavedContents((prev) => ({ ...prev, [file.id]: content }));
        return;
      }
      if (meta.kind === 'module') {
        await apiFetch(`/api/modules/${meta.backendId}`, {
          method: 'PUT',
          body: {
            routePath: meta.routePath,
            method: meta.method,
            code: content,
            fileExtension: coerceModuleExtension(meta.fileExtension),
          },
        });
      } else {
        const importedSession =
          meta.kind === 'ui' &&
          meta.draftId &&
          meta.entryPath &&
          (meta.importedFiles?.length ?? 0) > 0
            ? {
                draftId: meta.draftId,
                entryPath: meta.entryPath,
                importedFiles: meta.importedFiles ?? [],
              }
            : null;
        const entryExtension =
          importedSession
            ? (meta.entryPath?.split('.').pop() || meta.fileExtension || 'jsx')
            : meta.fileExtension;
        const uiExtension = coerceUiExtension(entryExtension);
        if (uiExtension !== 'css' && !window.Babel) {
          throw new Error('Babel runtime not loaded in browser; cannot build code_blob');
        }
        const detectedDependencies = extractUiDependencies(content);
        const baseDependencies = parseDependencies((meta.dependencies ?? []).join(','));
        const dependencies = Array.from(
          new Set(
            [...baseDependencies, ...detectedDependencies].filter(
              (dep) => dep && !UI_BUILTIN_DEPENDENCIES.has(dep),
            ),
          ),
        ).sort((a, b) => a.localeCompare(b));

        const compiled =
          importedSession
            ? buildSharedBundle(
                {
                  id: '__import-draft__',
                  name: meta.name,
                  version: meta.version,
                  entryPath: importedSession.entryPath,
                  dependencies,
                  fileExtension: uiExtension,
                },
                importedSession.importedFiles.map((sourceFile) => {
                  const sourcePath = normalizeImportedDraftPath(sourceFile.path);
                  const sourceId = buildImportedDraftFileId(importedSession.draftId, sourcePath);
                  return {
                    id: sourcePath,
                    path: sourcePath,
                    fileExtension: sourceFile.fileExtension,
                    content: fileContents[sourceId] ?? sourceFile.content,
                  };
                }),
              )
            : uiExtension === 'css'
            ? content
            : compileWithBabel(content);

        if (importedSession) {
          const entryDraftId = buildImportedDraftFileId(
            importedSession.draftId,
            importedSession.entryPath
          );
          const entrySource = fileContents[entryDraftId] ?? content;
          const matchedExisting = uiData.find(
            (pkg) =>
              pkg.id === meta.backendId ||
              (pkg.name === meta.name && pkg.version === meta.version),
          );
          const savedPackage = matchedExisting
            ? ((await apiFetch(`/api/ui-entities/${matchedExisting.id}`, {
                method: 'PUT',
                body: {
                  name: meta.name,
                  version: meta.version,
                  code: entrySource,
                  codeBlob: compiled,
                  dependencies,
                  fileExtension: uiExtension,
                },
              })) as UIPackageDto)
            : ((await apiFetch('/api/ui-entities', {
                method: 'POST',
                body: {
                  name: meta.name,
                  version: meta.version,
                  code: entrySource,
                  codeBlob: compiled,
                  dependencies,
                  fileExtension: uiExtension,
                },
              })) as UIPackageDto);
          const createdPackage = savedPackage;
          const nextFileId = `ui-${createdPackage.id}`;
          setUiData((prev) => {
            if (prev.some((pkg) => pkg.id === createdPackage.id)) {
              return prev.map((pkg) => (pkg.id === createdPackage.id ? createdPackage : pkg));
            }
            return [...prev, createdPackage];
          });
          const draftFileIds = new Set(
            importedSession.importedFiles.map((sourceFile) =>
              buildImportedDraftFileId(importedSession.draftId, sourceFile.path),
            ),
          );
          setSavedContents((prev) => {
            const next = { ...prev };
            draftFileIds.forEach((id) => {
              next[id] = fileContents[id] ?? next[id] ?? '';
            });
            next[nextFileId] = entrySource;
            return next;
          });
          setOpenFiles((prev) =>
            prev.map((item) => {
              if (item.meta?.kind !== 'ui' || item.meta.draftId !== meta.draftId) {
                return item;
              }
              return {
                ...item,
                meta: {
                  ...item.meta,
                  backendId: createdPackage.id,
                  name: createdPackage.name,
                  version: createdPackage.version,
                  dependencies,
                  fileExtension: createdPackage.fileExtension,
                },
              };
            }),
          );
          setActiveFile((prev) => {
            if (!prev?.meta || prev.meta.kind !== 'ui' || prev.meta.draftId !== meta.draftId) {
              return prev;
            }
            return {
              ...prev,
              meta: {
                ...prev.meta,
                backendId: createdPackage.id,
              },
            };
          });
          return;
        }

        if (!meta.backendId) {
          throw new Error('UI entity id is missing.');
        }
        await apiFetch(`/api/ui-entities/${meta.backendId}`, {
          method: 'PUT',
          body: {
            name: meta.name,
            version: meta.version,
            code: content,
            codeBlob: compiled,
            dependencies,
            fileExtension: uiExtension,
          },
        });
        setUiData((prev) =>
          prev.map((pkg) =>
            pkg.id === meta.backendId ? { ...pkg, dependencies } : pkg,
          ),
        );
        setOpenFiles((prev) =>
          prev.map((item) => {
            if (item.id !== file.id || item.meta?.kind !== 'ui') return item;
            return {
              ...item,
              meta: {
                ...item.meta,
                dependencies,
              },
            };
          }),
        );
      }
      setSavedContents((prev) => ({ ...prev, [file.id]: content }));
    },
    [
      aclConfig,
      adminFetch,
      apiFetch,
      fileContents,
      savedContents,
      savedContentsRef,
      setAclConfig,
      setFileContents,
      setSavedContents,
      setSharedFiles,
      setSharedProject,
      uiData,
      setUiData,
      setActiveFile,
      setOpenFiles,
      sharedBasePath,
      sharedFilesRef,
      sharedProject,
      syncSharedPackage,
    ],
  );

  const runModelMigration = useCallback(
    async (adapterKey?: string, options?: { silent?: boolean }) => {
      if (modelMigrationBusy) return;
      setModelMigrationBusy(true);
      try {
        const result = await apiFetch('/api/models/migrate', {
          method: 'POST',
          body: adapterKey ? { adapterKey } : {},
        });
        if (result.pendingDraftChanges) showError('Recovered the previous activation. Activate again to apply the latest model edits.');
        else if (!options?.silent) success('Models activated');
      } catch (err) {
        showError((err as Error).message || 'Migration failed');
      } finally {
        setModelMigrationBusy(false);
      }
    },
    [apiFetch, modelMigrationBusy, showError, success],
  );

  const handleSaveFile = useCallback(
    async (file: ActiveFile) => {
      if (!file.meta) return;
      try {
        await saveFile(file);
        if (file.meta.kind === 'model') {
          await runModelMigration(undefined, { silent: true });
        }
        success('Saved');
        await reloadTree();
        if (
          activeFile?.id === file.id &&
          file.meta.kind !== 'shared' &&
          file.meta.kind !== 'acl' &&
          file.meta.kind !== 'model'
        ) {
          await loadHistory();
        }
      } catch (err) {
        showError((err as Error).message || 'Save failed');
      }
    },
    [activeFile?.id, loadHistory, reloadTree, runModelMigration, saveFile, showError, success],
  );

  const handleSaveAll = useCallback(async () => {
    if (openFiles.length === 0) return;
    const dirtyFiles = openFiles.filter(isFileDirty);
    if (dirtyFiles.length === 0) {
      success('Nothing to save');
      return;
    }
    const seenDrafts = new Set<string>();
    const saveQueue: ActiveFile[] = [];
    dirtyFiles.forEach((dirtyFile) => {
      const meta = dirtyFile.meta;
      if (!meta || meta.kind !== 'ui' || !meta.draftId) {
        saveQueue.push(dirtyFile);
        return;
      }
      if (seenDrafts.has(meta.draftId)) return;
      seenDrafts.add(meta.draftId);
      const entryPath = normalizeImportedDraftPath(meta.entryPath || '');
      const preferred = dirtyFiles.find(
        (item) =>
          item.meta?.kind === 'ui' &&
          item.meta.draftId === meta.draftId &&
          normalizeImportedDraftPath(item.meta.draftFilePath || '') === entryPath,
      );
      saveQueue.push(preferred ?? dirtyFile);
    });
    let firstError: string | null = null;
    let savedActive = false;
    const savedModel = saveQueue.some((queuedFile) => queuedFile.meta?.kind === 'model');
    for (const file of saveQueue) {
      try {
        await saveFile(file);
        if (activeFile?.id === file.id) savedActive = true;
      } catch (err) {
        if (!firstError) firstError = (err as Error).message || 'Save failed';
      }
    }
    if (firstError) showError(firstError);
    else success('Saved all');
    if (!firstError && savedModel) {
      await runModelMigration(undefined, { silent: true });
    }
    await reloadTree();
    if (
      savedActive &&
      activeFile?.meta?.kind !== 'shared' &&
      activeFile?.meta?.kind !== 'acl' &&
      activeFile?.meta?.kind !== 'model'
    ) {
      await loadHistory();
    }
  }, [
    activeFile?.id,
    activeFile?.meta?.kind,
    isFileDirty,
    loadHistory,
    normalizeImportedDraftPath,
    openFiles,
    reloadTree,
    runModelMigration,
    saveFile,
    showError,
    success,
  ]);

  return {
    modelMigrationBusy,
    runModelMigration,
    handleSaveFile,
    handleSaveAll,
    syncSharedPackage,
  };
};
