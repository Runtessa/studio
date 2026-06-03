import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/router';
import { useToast } from '@/components/ui/Toast';
import { useSessionToken } from '@/lib/client/session';
import { hasPermissionFromUser } from '@/lib/client/access';
import { fetchSharedModuleProject, updateSharedModuleProject } from './editorApi';
import {
  DEFAULT_PROJECT_FORM,
  formatDeps,
  hasProjectErrors,
  parseDeps,
  validateProjectForm,
  type ProjectFormErrors,
  type ProjectFormState,
} from './model';
import { useSharedModuleAccessState } from './useSharedModuleAccessState';
import { useSharedModuleRoutesState } from './useSharedModuleRoutesState';

export function useSharedModuleEditor() {
  const router = useRouter();
  const { token, setToken, ready } = useSessionToken();
  const { success, error: showError } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<ProjectFormState>(DEFAULT_PROJECT_FORM);
  const [validationErrors, setValidationErrors] = useState<ProjectFormErrors>({ name: '', version: '', entryPath: '' });
  const [canEditProject, setCanEditProject] = useState(true);

  const idRaw = router.query.id;
  const projectId = Array.isArray(idRaw) ? idRaw[0] : idRaw;
  const access = useSharedModuleAccessState({ token, projectId, success, showError });
  const routes = useSharedModuleRoutesState({ token, projectId, canEditProject, success, showError });

  useEffect(() => {
    const bootstrap = async () => {
      if (!ready || !token || !projectId) return;
      try {
        const meRes = await fetch('/api/me', { headers: { Authorization: `Session ${token}` } });
        const meData = await meRes.json();
        if (!meRes.ok) throw new Error(meData.error || 'Failed to load user');
        const canWrite = hasPermissionFromUser(meData.user, 'ide.shared_modules.write');
        setIsAdmin(canWrite);
        if (!canWrite) return void router.replace('/dashboard');
        const project = await fetchSharedModuleProject(token, projectId);
        if (!project) return void setError('Shared backend project not found');
        setForm({
          name: project.name,
          version: project.version,
          entryPath: project.entryPath || 'src/index.js',
          fileExtension: project.fileExtension || 'js',
          dependencies: formatDeps(project.dependencies),
        });
        setCanEditProject(project.canEdit !== false);
        await Promise.all([access.loadAccess(token, projectId), routes.loadEndpoints(token)]);
      } catch (err: any) {
        setError(err.message);
        if (err.message?.toLowerCase().includes('unauthorized')) setToken('');
      } finally {
        setLoading(false);
      }
    };
    void bootstrap();
  }, [token, ready, setToken, router, projectId]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const errors = validateProjectForm(form);
    setValidationErrors(errors);
    if (hasProjectErrors(errors) || !projectId || !canEditProject) return;
    try {
      await updateSharedModuleProject(token, projectId, {
        name: form.name,
        version: form.version,
        entryPath: form.entryPath,
        dependencies: parseDeps(form.dependencies),
        fileExtension: form.fileExtension || 'js',
      });
      success('Shared backend project updated');
      router.push('/admin/shared-modules');
    } catch (err: any) {
      showError(err.message || 'Failed to update shared backend project');
    }
  };

  return {
    ready,
    token,
    isAdmin,
    error,
    loading,
    form,
    validationErrors,
    canEditProject,
    setForm,
    handleSubmit,
    ...access,
    ...routes,
  };
}

export default useSharedModuleEditor;
