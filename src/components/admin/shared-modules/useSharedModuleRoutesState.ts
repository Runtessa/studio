import { useMemo, useState, type FormEvent } from 'react';
import {
  createSharedModuleEndpoint,
  deleteSharedModuleEndpoint,
  fetchSharedModuleEndpoints,
  updateSharedModuleEndpoint,
} from './editorApi';
import {
  DEFAULT_ENDPOINT_FORM,
  validateEndpointForm,
  type EndpointFormErrors,
  type EndpointFormState,
  type SharedEndpoint,
} from './model';

type UseSharedModuleRoutesStateInput = {
  token: string | undefined;
  projectId: string | undefined;
  canEditProject: boolean;
  success: (message: string) => void;
  showError: (message: string) => void;
};

export function useSharedModuleRoutesState({
  token,
  projectId,
  canEditProject,
  success,
  showError,
}: UseSharedModuleRoutesStateInput) {
  const [endpoints, setEndpoints] = useState<SharedEndpoint[]>([]);
  const [endpointLoading, setEndpointLoading] = useState(false);
  const [endpointForm, setEndpointForm] = useState<EndpointFormState>(DEFAULT_ENDPOINT_FORM);
  const [endpointErrors, setEndpointErrors] = useState<EndpointFormErrors>({ routePath: '' });
  const [editingEndpointId, setEditingEndpointId] = useState<string | null>(null);
  const [endpointEditForm, setEndpointEditForm] = useState<EndpointFormState>({ routePath: '', method: 'GET' });
  const [endpointEditErrors, setEndpointEditErrors] = useState<EndpointFormErrors>({ routePath: '' });

  const projectEndpoints = useMemo(
    () => endpoints.filter((endpoint) => endpoint.packageId === projectId),
    [endpoints, projectId]
  );

  const loadEndpoints = async (activeToken: string) => {
    setEndpointLoading(true);
    try {
      const data = await fetchSharedModuleEndpoints(activeToken);
      setEndpoints(data.endpoints || []);
    } finally {
      setEndpointLoading(false);
    }
  };

  const handleEndpointCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !projectId || !canEditProject) return;
    const errors = validateEndpointForm(endpointForm);
    setEndpointErrors(errors);
    if (errors.routePath) return;
    try {
      await createSharedModuleEndpoint(token, {
        routePath: endpointForm.routePath,
        method: endpointForm.method,
        packageId: projectId,
      });
      success('Route added');
      setEndpointForm(DEFAULT_ENDPOINT_FORM);
      await loadEndpoints(token);
    } catch (err: any) {
      showError(err.message || 'Failed to add route');
    }
  };

  const startEditEndpoint = (endpoint: SharedEndpoint) => {
    setEditingEndpointId(endpoint.id);
    setEndpointEditForm({ routePath: endpoint.routePath, method: endpoint.method });
    setEndpointEditErrors({ routePath: '' });
  };

  const cancelEditEndpoint = () => {
    setEditingEndpointId(null);
    setEndpointEditForm({ routePath: '', method: 'GET' });
    setEndpointEditErrors({ routePath: '' });
  };

  const handleEndpointEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !editingEndpointId || !canEditProject) return;
    const errors = validateEndpointForm(endpointEditForm);
    setEndpointEditErrors(errors);
    if (errors.routePath) return;
    try {
      await updateSharedModuleEndpoint(token, editingEndpointId, {
        routePath: endpointEditForm.routePath,
        method: endpointEditForm.method,
      });
      success('Route updated');
      cancelEditEndpoint();
      await loadEndpoints(token);
    } catch (err: any) {
      showError(err.message || 'Failed to update route');
    }
  };

  const handleEndpointDelete = async (endpointId: string) => {
    if (!token || !canEditProject) return;
    try {
      await deleteSharedModuleEndpoint(token, endpointId);
      success('Route deleted');
      await loadEndpoints(token);
    } catch (err: any) {
      showError(err.message || 'Failed to delete route');
    }
  };

  return {
    endpointLoading,
    endpointForm,
    endpointErrors,
    editingEndpointId,
    endpointEditForm,
    endpointEditErrors,
    projectEndpoints,
    setEndpointForm,
    setEndpointEditForm,
    loadEndpoints,
    handleEndpointCreate,
    startEditEndpoint,
    cancelEditEndpoint,
    handleEndpointEdit,
    handleEndpointDelete,
  };
}

export default useSharedModuleRoutesState;
