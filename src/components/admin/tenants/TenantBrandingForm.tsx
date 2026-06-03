import { Input } from '@/components/ui/Input';

export type TenantBrandingFormState = {
  title: string;
  faviconUrl: string;
  appleTouchIconUrl: string;
};

type TenantBrandingFormProps = {
  value: TenantBrandingFormState;
  onChange: (value: TenantBrandingFormState) => void;
};

export function TenantBrandingForm({ value, onChange }: TenantBrandingFormProps) {
  const setField = (patch: Partial<TenantBrandingFormState>) => onChange({ ...value, ...patch });
  const previewTitle = value.title.trim() || 'Tenant Portal';
  const faviconText = value.faviconUrl.trim() || '/favicon.ico';
  const touchIconText = value.appleTouchIconUrl.trim() || '/apple-touch-icon.png';

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
      <div className="grid gap-5 md:grid-cols-2">
        <Input
          label="App title"
          placeholder="Tenant Portal"
          value={value.title}
          onChange={(event) => setField({ title: event.target.value })}
          helperText="Used for the browser title and PWA fallback name."
        />
        <Input
          label="Favicon URL"
          placeholder="/favicon.ico"
          value={value.faviconUrl}
          onChange={(event) => setField({ faviconUrl: event.target.value })}
          helperText="Use a local path, data URL, or HTTPS URL."
        />
        <div className="md:col-span-2">
          <Input
            label="Apple touch icon URL"
            placeholder="/apple-touch-icon.png"
            value={value.appleTouchIconUrl}
            onChange={(event) => setField({ appleTouchIconUrl: event.target.value })}
            helperText="Shown when the tenant is saved to an iOS home screen."
          />
        </div>
      </div>
      <aside className="rounded-2xl border border-borderSubtle bg-bgApp p-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-textMuted">Preview</div>
        <div className="mt-3 rounded-xl border border-borderSubtle bg-bgSurface shadow-soft">
          <div className="flex items-center gap-2 rounded-t-xl border-b border-borderSubtle px-3 py-2">
            <span className="h-3 w-3 rounded-full bg-danger/70" />
            <span className="h-3 w-3 rounded-full bg-warning/70" />
            <span className="h-3 w-3 rounded-full bg-success/70" />
            <div className="ml-2 truncate rounded-md bg-bgApp px-2 py-1 text-xs text-textMuted">
              {previewTitle}
            </div>
          </div>
          <div className="space-y-3 px-4 py-4">
            <div>
              <div className="text-sm font-semibold text-textPrimary">{previewTitle}</div>
              <div className="mt-1 text-xs text-textMuted">Browser title and install prompt label</div>
            </div>
            <div className="rounded-lg border border-borderSubtle bg-bgApp px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.18em] text-textMuted">Favicon</div>
              <div className="mt-1 truncate text-xs font-mono text-textPrimary">{faviconText}</div>
            </div>
            <div className="rounded-lg border border-borderSubtle bg-bgApp px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.18em] text-textMuted">Apple Touch Icon</div>
              <div className="mt-1 truncate text-xs font-mono text-textPrimary">{touchIconText}</div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

export default TenantBrandingForm;
