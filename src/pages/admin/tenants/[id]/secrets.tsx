import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function TenantSecretsPage() {
  const router = useRouter();
  const tenantIdRaw = router.query.id;
  const tenantId = Array.isArray(tenantIdRaw) ? tenantIdRaw[0] : tenantIdRaw;

  useEffect(() => {
    if (!tenantId) return;
    void router.replace(`/admin/tenants/${tenantId}?tab=secrets`);
  }, [router, tenantId]);

  return null;
}
