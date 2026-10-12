import type { WorkspaceContext } from './workspace-context';

const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object')
    return JSON.stringify(
      Object.keys(value)
        .sort()
        .map((key) => [key, stable((value as Record<string, unknown>)[key])]),
    );
  return JSON.stringify(value) ?? 'null';
};

export function snapshot(workspace: WorkspaceContext, acl: Record<string, unknown>) {
  const values = new Map<string, string>();
  const put = (keys: string[], value: unknown) => keys.forEach((key) => values.set(key, stable(value)));
  for (const row of workspace.modules)
    put(
      [`module:${row.id}`, `module:${row.method}:${row.routePath}`],
      [row.code, row.routePath, row.method, row.fileExtension],
    );
  for (const row of workspace.models)
    put([`model:${row.id}`, `model:${row.path}`], [row.code, row.path, row.fileExtension]);
  for (const row of workspace.uiPackages)
    put(
      [`ui:${row.id}`, `ui:${row.name}@${row.version}`],
      [row.code, row.name, row.version, row.fileExtension, [...(row.dependencies || [])].sort()],
    );
  for (const kind of ['ui', 'module'] as const) {
    const projects = kind === 'ui' ? workspace.sharedUi : workspace.sharedModules;
    const files = kind === 'ui' ? workspace.sharedUiFiles : workspace.sharedModuleFiles;
    for (const project of projects)
      put(
        [`project:${kind}:${project.id}`, `project:${kind}:${project.name}@${project.version}`],
        [project.name, project.version, project.entryPath, [...(project.dependencies || [])].sort()],
      );
    for (const file of files || []) {
      const project = projects.find((item) => item.id === file.projectId);
      put(
        [
          `shared:${kind}:${file.id}`,
          `shared:${kind}:${file.projectId}:${file.path}`,
          ...(project ? [`shared:${kind}:${project.name}@${project.version}:${file.path}`] : []),
        ],
        [file.content, file.path, file.fileExtension],
      );
    }
  }
  for (const file of ['permissions', 'roles', 'endpoints']) put([`acl:${file}`], acl[file]);
  return values;
}
