import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { TextArea } from '@/components/ui/TextArea';
import { AdapterGroupForm } from './AdapterGroupForm';
import { AdapterTable } from './AdapterTable';
import {
  COMMON_ADAPTERS,
  asObject,
  buildReadWriteEntry,
  buildSingleEntry,
  getDefaultOptionKey,
  getDefaultEntryMode,
  getAdapterDescription,
  getAdapterLabel,
  normalizeConfigKey,
  parseAdapterConfig,
  stringifyAdapterConfig,
} from './adapterConfigModel';

type AdapterConfigFormProps = {
  value: string;
  error?: string;
  helperText: string;
  onChange: (value: string) => void;
};

const ensureConfigShape = (config: Record<string, any>) => ({
  ...config,
  adapters: asObject(config.adapters),
});

const parseConfigDraft = (value: string) => {
  if (!value.trim()) {
    return { config: ensureConfigShape({}), error: '' };
  }

  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { config: null, error: 'Adapter config JSON must be an object.' };
    }
    return { config: ensureConfigShape(parsed as Record<string, any>), error: '' };
  } catch {
    return { config: null, error: 'Adapter config JSON is invalid.' };
  }
};

export function AdapterConfigForm({ value, error, helperText, onChange }: AdapterConfigFormProps) {
  const [presetAdapter, setPresetAdapter] = useState('postgres');
  const [customAdapterKey, setCustomAdapterKey] = useState('');
  const [selectedAdapter, setSelectedAdapter] = useState('');
  const [advancedMode, setAdvancedMode] = useState(false);
  const [lastValidConfig, setLastValidConfig] = useState<Record<string, any>>(() =>
    ensureConfigShape(parseAdapterConfig(value))
  );
  const parsedDraft = parseConfigDraft(value);
  const draftError = parsedDraft.error;
  const config = parsedDraft.config || lastValidConfig;
  const adapters = asObject(config.adapters);
  const adapterEntries = Object.entries(adapters);
  const activeAdapter = selectedAdapter && adapters[selectedAdapter] ? selectedAdapter : adapterEntries[0]?.[0] || '';
  const adapterCount = adapterEntries.length;
  const optionCount = adapterEntries.reduce(
    (total, [, block]) => total + Object.keys(asObject(block)).length,
    0
  );
  const structuredEditorAvailable = !advancedMode || !draftError;

  useEffect(() => {
    if (parsedDraft.config) {
      setLastValidConfig(parsedDraft.config);
    }
  }, [value]);

  const updateConfig = (mutate: (next: Record<string, any>) => void) => {
    const next = ensureConfigShape(parseAdapterConfig(value));
    mutate(next);
    onChange(stringifyAdapterConfig(next));
  };

  const addAdapter = () => updateConfig((next) => {
    const key = normalizeConfigKey(customAdapterKey || presetAdapter);
    if (!key || next.adapters[key]) return;
    const optionKey = getDefaultOptionKey(key);
    next.adapters[key] =
      getDefaultEntryMode(key) === 'readWrite'
        ? { [optionKey]: buildReadWriteEntry(key, optionKey) }
        : { [optionKey]: buildSingleEntry(key, optionKey) };
    setSelectedAdapter(key);
    setCustomAdapterKey('');
  });

  const renameAdapter = (previousKey: string, rawNextKey: string) => updateConfig((next) => {
    const nextKey = normalizeConfigKey(rawNextKey);
    if (!nextKey || nextKey === previousKey || next.adapters[nextKey]) return;
    next.adapters[nextKey] = next.adapters[previousKey];
    delete next.adapters[previousKey];
    setSelectedAdapter(nextKey);
  });

  const removeAdapter = (key: string) => updateConfig((next) => {
    delete next.adapters[key];
    if (selectedAdapter === key) setSelectedAdapter('');
  });

  const updateAdapterBlock = (key: string, block: Record<string, any>) => updateConfig((next) => {
    next.adapters[key] = block;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-sm font-medium text-textPrimary">Adapter configuration</div>
          <p className="mt-1 text-xs text-textMuted">
            Configure adapter access with form fields. Secret values stay in tenant secrets; this form stores refs only.
          </p>
        </div>
        <Button type="button" variant={advancedMode ? 'primary' : 'secondary'} size="sm" onClick={() => setAdvancedMode((current) => !current)}>
          {advancedMode ? 'Hide advanced mode' : 'Advanced mode'}
        </Button>
      </div>

      {structuredEditorAvailable ? (
        <>
          <section className="rounded-lg border border-borderSubtle bg-bgSurface p-4">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-textPrimary">Adapters workspace</h3>
                <p className="mt-1 text-xs text-textMuted">
                  Add adapter types, review what is configured, then edit one adapter at a time.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-borderSubtle bg-bgApp px-2.5 py-1 text-xs text-textPrimary">
                  {adapterCount} adapter{adapterCount === 1 ? '' : 's'}
                </span>
                <span className="rounded-full border border-borderSubtle bg-bgApp px-2.5 py-1 text-xs text-textPrimary">
                  {optionCount} option{optionCount === 1 ? '' : 's'}
                </span>
              </div>
            </div>
            <div className="grid gap-4 rounded-lg border border-borderSubtle bg-bgApp p-4 lg:grid-cols-[220px_1fr_auto]">
              <Select
                label="Common adapter"
                value={presetAdapter}
                options={COMMON_ADAPTERS.map((adapter) => ({
                  label: adapter.label,
                  value: adapter.key,
                }))}
                onChange={(e) => setPresetAdapter(e.target.value)}
              />
              <Input
                label="Custom adapter key"
                placeholder="stripe or rabbitmq"
                value={customAdapterKey}
                onChange={(e) => setCustomAdapterKey(e.target.value)}
                helperText={
                  customAdapterKey
                    ? 'Custom adapter key will be normalized on save.'
                    : `${getAdapterLabel(presetAdapter)}: ${getAdapterDescription(presetAdapter)}`
                }
              />
              <Button type="button" variant="secondary" size="sm" className="self-end" onClick={addAdapter}>
                Add adapter
              </Button>
            </div>
            <div className="mt-3 rounded-lg border border-borderSubtle bg-bgSurface px-3 py-2 text-xs text-textMuted">
              Common adapters start with a sensible default option. Custom adapters start as single-secret integrations unless you add read/write options later.
            </div>
          </section>

          <AdapterTable
            adapters={adapterEntries}
            selectedAdapter={activeAdapter}
            onSelect={setSelectedAdapter}
            onRemove={removeAdapter}
          />

          {activeAdapter ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-borderSubtle bg-bgSurface px-4 py-3">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-textPrimary">{getAdapterLabel(activeAdapter)}</h3>
                    <p className="mt-1 text-xs text-textMuted">{getAdapterDescription(activeAdapter)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-borderSubtle bg-bgApp px-2.5 py-1 text-xs text-textPrimary">
                      key: {activeAdapter}
                    </span>
                    <span className="rounded-full border border-borderSubtle bg-bgApp px-2.5 py-1 text-xs text-textPrimary">
                      {Object.keys(asObject(adapters[activeAdapter])).length} option{Object.keys(asObject(adapters[activeAdapter])).length === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              </div>
              <AdapterGroupForm
                key={activeAdapter}
                adapter={activeAdapter}
                block={asObject(adapters[activeAdapter])}
                onRename={(nextAdapter) => renameAdapter(activeAdapter, nextAdapter)}
                onRemove={() => removeAdapter(activeAdapter)}
                onChange={(nextBlock) => updateAdapterBlock(activeAdapter, nextBlock)}
              />
            </div>
          ) : null}
        </>
      ) : (
        <div className="rounded-lg border border-danger bg-bgApp px-4 py-3 text-sm text-danger">
          {draftError} Fix the JSON below to resume the structured editor.
        </div>
      )}

      {advancedMode ? (
        <section className="rounded-lg border border-borderSubtle bg-bgSurface p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-textPrimary">Advanced mode</h3>
            <p className="mt-1 text-xs text-textMuted">
              Edit the raw adapter config JSON directly. Invalid JSON pauses the structured editor until it is fixed.
            </p>
          </div>
          <TextArea
            label="Adapter config JSON"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            error={draftError || error}
            className="min-h-[360px] font-mono text-xs"
            spellCheck={false}
          />
        </section>
      ) : null}

      {!advancedMode && error ? <p className="text-xs text-danger">{error}</p> : null}
      <p className="text-xs text-textMuted">{helperText}</p>
    </div>
  );
}
