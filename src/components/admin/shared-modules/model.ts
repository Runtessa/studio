export type SharedModuleProject = {
  id: string;
  name: string;
  version: string;
  entryPath: string;
  dependencies: string[];
  fileExtension: string;
  ownerTeamId?: number;
  editorTeamIds?: number[];
  canEdit?: boolean;
  canManageAccess?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type TeamOption = {
  id: number;
  key: string;
  name: string;
  isActive?: boolean;
};

export type SharedEndpoint = {
  id: string;
  routePath: string;
  method: string;
  packageId?: string;
  packageName?: string;
  packageVersion?: string;
  updatedAt?: string;
};

export type ProjectFormState = {
  name: string;
  version: string;
  entryPath: string;
  fileExtension: string;
  dependencies: string;
};

export type ProjectFormErrors = {
  name: string;
  version: string;
  entryPath: string;
};

export type EndpointFormState = {
  routePath: string;
  method: string;
};

export type EndpointFormErrors = {
  routePath: string;
};

export const FILE_EXTENSION_OPTIONS = [
  { label: 'JS', value: 'js' },
  { label: 'JSON', value: 'json' },
];

export const METHOD_OPTIONS = [
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
  { label: 'PUT', value: 'PUT' },
  { label: 'PATCH', value: 'PATCH' },
  { label: 'DELETE', value: 'DELETE' },
];

export const DEFAULT_PROJECT_FORM: ProjectFormState = {
  name: '',
  version: '1.0.0',
  entryPath: 'src/index.js',
  fileExtension: 'js',
  dependencies: '',
};

export const DEFAULT_ENDPOINT_FORM: EndpointFormState = {
  routePath: '/api/auth',
  method: 'GET',
};

export const formatDeps = (deps?: string[]) => (deps && deps.length ? deps.join('\n') : '');

export const parseDeps = (value: string) =>
  value
    .split(/[\n,]+/g)
    .map((entry) => entry.trim())
    .filter(Boolean);

export const validateProjectForm = (values: ProjectFormState): ProjectFormErrors => {
  const errors: ProjectFormErrors = { name: '', version: '', entryPath: '' };
  if (!values.name.trim()) errors.name = 'Name is required';
  if (!values.version.trim()) errors.version = 'Version is required';
  if (!values.entryPath.trim()) errors.entryPath = 'Entry file is required';
  return errors;
};

export const hasProjectErrors = (errors: ProjectFormErrors) =>
  Boolean(errors.name || errors.version || errors.entryPath);

export const validateEndpointForm = (values: EndpointFormState): EndpointFormErrors => {
  const errors: EndpointFormErrors = { routePath: '' };
  if (!values.routePath.trim()) errors.routePath = 'Route path is required';
  return errors;
};
