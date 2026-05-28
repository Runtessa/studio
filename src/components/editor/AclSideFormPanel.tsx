import { useMemo, useState } from 'react';

export type AclFileKind = 'permissions' | 'roles' | 'endpoints';

type AclSideFormPanelProps = {
  file: AclFileKind;
  content: string;
  onChangeContent: (nextContent: string) => void;
};

type EndpointRule = {
  read?: string[];
  write?: string[];
  edit?: string[];
  delete?: string[];
  allowAnonymous?: boolean;
};

const toCsv = (values: string[] | undefined) => (values ?? []).join(', ');

const parseCsv = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const pretty = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

const inputClass =
  'w-full rounded border border-[#3c3c3c] bg-[#1f1f1f] px-2 py-1 text-xs text-gray-100 outline-none focus:border-[#0e639c]';

const sectionTitleClass = 'text-[11px] font-semibold uppercase tracking-wide text-gray-300';

const parseAclContent = (content: string) => {
  try {
    const parsed = JSON.parse(content || '{}');
    return { parsed, error: null as string | null };
  } catch (err) {
    return {
      parsed: null,
      error: (err as Error).message || 'Invalid JSON',
    };
  }
};

const normalizePermissions = (parsed: unknown) => {
  const obj = typeof parsed === 'object' && parsed ? (parsed as { permissions?: unknown }) : {};
  const list = Array.isArray(obj.permissions) ? obj.permissions : [];
  return {
    permissions: list.map((item) => {
      const row = typeof item === 'object' && item ? (item as { key?: unknown; label?: unknown }) : {};
      return {
        key: typeof row.key === 'string' ? row.key : '',
        label: typeof row.label === 'string' ? row.label : '',
      };
    }),
  };
};

const normalizeRoles = (parsed: unknown) => {
  const obj = typeof parsed === 'object' && parsed ? (parsed as Record<string, unknown>) : {};
  const readMap = (value: unknown) => {
    const source = typeof value === 'object' && value ? (value as Record<string, unknown>) : {};
    const next: Record<string, string[]> = {};
    Object.entries(source).forEach(([key, perms]) => {
      if (!Array.isArray(perms)) return;
      next[key] = perms.filter((perm): perm is string => typeof perm === 'string');
    });
    return next;
  };
  return {
    roles: readMap(obj.roles),
    groups: readMap(obj.groups),
  };
};

const normalizeEndpoints = (parsed: unknown) => {
  const source = typeof parsed === 'object' && parsed ? (parsed as Record<string, unknown>) : {};
  const next: Record<string, EndpointRule> = {};
  Object.entries(source).forEach(([path, value]) => {
    const rule = typeof value === 'object' && value ? (value as EndpointRule) : {};
    next[path] = {
      read: Array.isArray(rule.read) ? rule.read.filter((item): item is string => typeof item === 'string') : [],
      write: Array.isArray(rule.write)
        ? rule.write.filter((item): item is string => typeof item === 'string')
        : [],
      edit: Array.isArray(rule.edit) ? rule.edit.filter((item): item is string => typeof item === 'string') : [],
      delete: Array.isArray(rule.delete)
        ? rule.delete.filter((item): item is string => typeof item === 'string')
        : [],
      allowAnonymous: Boolean(rule.allowAnonymous),
    };
  });
  return next;
};

export function AclSideFormPanel({ file, content, onChangeContent }: AclSideFormPanelProps) {
  const parsedState = useMemo(() => parseAclContent(content), [content]);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleValues, setNewRoleValues] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupValues, setNewGroupValues] = useState('');
  const [newEndpointPath, setNewEndpointPath] = useState('');

  if (parsedState.error || parsedState.parsed === null) {
    return (
      <aside className="w-[360px] min-w-[320px] border-l border-[#2a2d2e] bg-[#252526] p-3">
        <div className="rounded border border-red-700 bg-red-950/40 p-3 text-xs text-red-200">
          <div className="font-semibold">Invalid ACL JSON</div>
          <div className="mt-1 break-words">{parsedState.error}</div>
          <div className="mt-2 text-[11px] text-red-300">Fix JSON in editor to continue using form.</div>
        </div>
      </aside>
    );
  }

  if (file === 'permissions') {
    const model = normalizePermissions(parsedState.parsed);
    return (
      <aside className="w-[360px] min-w-[320px] border-l border-[#2a2d2e] bg-[#252526] p-3">
        <div className={sectionTitleClass}>Permissions</div>
        <div className="mt-2 space-y-2 overflow-y-auto">
          {model.permissions.map((row, index) => (
            <div key={`perm-${index}`} className="rounded border border-[#3c3c3c] p-2">
              <input
                className={inputClass}
                value={row.key}
                onChange={(event) => {
                  const next = [...model.permissions];
                  next[index] = { ...next[index], key: event.target.value };
                  onChangeContent(pretty({ permissions: next }));
                }}
                placeholder="permission key"
              />
              <input
                className={`${inputClass} mt-2`}
                value={row.label}
                onChange={(event) => {
                  const next = [...model.permissions];
                  next[index] = { ...next[index], label: event.target.value };
                  onChangeContent(pretty({ permissions: next }));
                }}
                placeholder="label"
              />
              <button
                type="button"
                className="mt-2 rounded bg-[#5a1d1d] px-2 py-1 text-[11px] text-red-200 hover:bg-[#6e2626]"
                onClick={() => {
                  const next = model.permissions.filter((_, idx) => idx !== index);
                  onChangeContent(pretty({ permissions: next }));
                }}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="w-full rounded bg-[#0e639c] px-2 py-1.5 text-xs font-medium text-white hover:bg-[#1177bb]"
            onClick={() => onChangeContent(pretty({ permissions: [...model.permissions, { key: '', label: '' }] }))}
          >
            Add Permission
          </button>
        </div>
      </aside>
    );
  }

  if (file === 'roles') {
    const model = normalizeRoles(parsedState.parsed);
    const renderMapSection = (label: string, section: 'roles' | 'groups') => {
      const entries = Object.entries(model[section]);
      return (
        <div>
          <div className={sectionTitleClass}>{label}</div>
          <div className="mt-2 space-y-2">
            {entries.map(([key, values]) => (
              <div key={`${section}-${key}`} className="rounded border border-[#3c3c3c] p-2">
                <div className="text-[11px] text-gray-300">{key}</div>
                <input
                  className={`${inputClass} mt-2`}
                  value={toCsv(values)}
                  onChange={(event) => {
                    const next = {
                      ...model,
                      [section]: { ...model[section], [key]: parseCsv(event.target.value) },
                    };
                    onChangeContent(pretty(next));
                  }}
                  placeholder="perm.a, perm.b"
                />
                <button
                  type="button"
                  className="mt-2 rounded bg-[#5a1d1d] px-2 py-1 text-[11px] text-red-200 hover:bg-[#6e2626]"
                  onClick={() => {
                    const { [key]: _removed, ...rest } = model[section];
                    onChangeContent(pretty({ ...model, [section]: rest }));
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
            <div className="rounded border border-[#3c3c3c] p-2">
              <input
                className={inputClass}
                value={section === 'roles' ? newRoleName : newGroupName}
                onChange={(event) => {
                  if (section === 'roles') {
                    setNewRoleName(event.target.value);
                    return;
                  }
                  setNewGroupName(event.target.value);
                }}
                placeholder={`new ${section} name`}
              />
              <input
                className={`${inputClass} mt-2`}
                value={section === 'roles' ? newRoleValues : newGroupValues}
                onChange={(event) => {
                  if (section === 'roles') {
                    setNewRoleValues(event.target.value);
                    return;
                  }
                  setNewGroupValues(event.target.value);
                }}
                placeholder="perm.a, perm.b"
              />
              <button
                type="button"
                className="mt-2 rounded bg-[#0e639c] px-2 py-1 text-[11px] text-white hover:bg-[#1177bb]"
                onClick={() => {
                  const key = (section === 'roles' ? newRoleName : newGroupName).trim();
                  const values = section === 'roles' ? newRoleValues : newGroupValues;
                  if (!key) return;
                  const next = {
                    ...model,
                    [section]: { ...model[section], [key]: parseCsv(values) },
                  };
                  onChangeContent(pretty(next));
                  if (section === 'roles') {
                    setNewRoleName('');
                    setNewRoleValues('');
                    return;
                  }
                  setNewGroupName('');
                  setNewGroupValues('');
                }}
              >
                Add {section.slice(0, -1)}
              </button>
            </div>
          </div>
        </div>
      );
    };

    return (
      <aside className="w-[360px] min-w-[320px] border-l border-[#2a2d2e] bg-[#252526] p-3">
        <div className="space-y-4 overflow-y-auto">
          {renderMapSection('Roles', 'roles')}
          {renderMapSection('Groups', 'groups')}
        </div>
      </aside>
    );
  }

  const model = normalizeEndpoints(parsedState.parsed);
  const endpointEntries = Object.entries(model);
  return (
    <aside className="w-[360px] min-w-[320px] border-l border-[#2a2d2e] bg-[#252526] p-3">
      <div className={sectionTitleClass}>Endpoints</div>
      <div className="mt-2 space-y-2 overflow-y-auto">
        {endpointEntries.map(([path, rule]) => (
          <div key={path} className="rounded border border-[#3c3c3c] p-2">
            <div className="text-[11px] text-gray-300 break-all">{path}</div>
            {(['read', 'write', 'edit', 'delete'] as const).map((accessKey) => (
              <input
                key={`${path}-${accessKey}`}
                className={`${inputClass} mt-2`}
                value={toCsv(rule[accessKey])}
                onChange={(event) => {
                  const nextRule = { ...rule, [accessKey]: parseCsv(event.target.value) };
                  onChangeContent(pretty({ ...model, [path]: nextRule }));
                }}
                placeholder={`${accessKey}: perm.a, perm.b`}
              />
            ))}
            <label className="mt-2 flex items-center gap-2 text-xs text-gray-300">
              <input
                type="checkbox"
                checked={Boolean(rule.allowAnonymous)}
                onChange={(event) => {
                  const nextRule = { ...rule, allowAnonymous: event.target.checked };
                  onChangeContent(pretty({ ...model, [path]: nextRule }));
                }}
              />
              Allow Anonymous
            </label>
            <button
              type="button"
              className="mt-2 rounded bg-[#5a1d1d] px-2 py-1 text-[11px] text-red-200 hover:bg-[#6e2626]"
              onClick={() => {
                const { [path]: _removed, ...rest } = model;
                onChangeContent(pretty(rest));
              }}
            >
              Remove
            </button>
          </div>
        ))}
        <div className="rounded border border-[#3c3c3c] p-2">
          <input
            className={inputClass}
            value={newEndpointPath}
            onChange={(event) => setNewEndpointPath(event.target.value)}
            placeholder="/api/path"
          />
          <button
            type="button"
            className="mt-2 rounded bg-[#0e639c] px-2 py-1 text-[11px] text-white hover:bg-[#1177bb]"
            onClick={() => {
              const path = newEndpointPath.trim();
              if (!path) return;
              onChangeContent(
                pretty({
                  ...model,
                  [path]: { read: [], write: [], edit: [], delete: [], allowAnonymous: false },
                })
              );
              setNewEndpointPath('');
            }}
          >
            Add Endpoint
          </button>
        </div>
      </div>
    </aside>
  );
}
