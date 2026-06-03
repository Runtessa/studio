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

  return (
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
  );
}

export default TenantBrandingForm;
