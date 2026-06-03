import type React from 'react';
import { DataCard } from '@/components/ui/DataCard';
import { FormLayout } from '@/components/ui/FormLayout';

type TenantTabFormCardProps = {
  title: string;
  subtitle: string;
  loading?: boolean;
  loadingLabel?: string;
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export function TenantTabFormCard({
  title,
  subtitle,
  loading = false,
  loadingLabel = 'Loading…',
  onSubmit,
  actions,
  children,
}: TenantTabFormCardProps) {
  return (
    <DataCard title={title} subtitle={subtitle}>
      {loading ? (
        <div className="text-sm text-textMuted">{loadingLabel}</div>
      ) : (
        <FormLayout onSubmit={onSubmit} actions={actions}>
          {children}
        </FormLayout>
      )}
    </DataCard>
  );
}

export default TenantTabFormCard;
