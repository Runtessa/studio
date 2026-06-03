import { fetchJson } from '@/lib/client/api';
import type { SharedModuleProject } from './model';

export const fetchSharedModuleProject = async (token: string, projectId: string) => {
  const payload = await fetchJson(`/api/admin/shared-modules/${projectId}`, { token });
  return (payload?.package ?? payload) as SharedModuleProject | undefined;
};

export const fetchSharedModuleAccess = async (token: string, projectId: string) =>
  fetchJson(`/api/admin/shared-modules/${projectId}/access`, { token });

export const fetchSharedModuleEndpoints = async (token: string) =>
  fetchJson('/api/admin/shared-modules/endpoints', { token });

export const updateSharedModuleProject = async (
  token: string,
  projectId: string,
  body: {
    name: string;
    version: string;
    entryPath: string;
    dependencies: string[];
    fileExtension: string;
  }
) =>
  fetchJson(`/api/admin/shared-modules/${projectId}`, {
    method: 'PUT',
    token,
    body,
  });

export const createSharedModuleEndpoint = async (
  token: string,
  body: { routePath: string; method: string; packageId: string }
) =>
  fetchJson('/api/admin/shared-modules/endpoints', {
    method: 'POST',
    token,
    body,
  });

export const updateSharedModuleEndpoint = async (
  token: string,
  endpointId: string,
  body: { routePath: string; method: string }
) =>
  fetchJson(`/api/admin/shared-modules/endpoints/${endpointId}`, {
    method: 'PUT',
    token,
    body,
  });

export const deleteSharedModuleEndpoint = async (token: string, endpointId: string) =>
  fetchJson(`/api/admin/shared-modules/endpoints/${endpointId}`, {
    method: 'DELETE',
    token,
  });

export const saveSharedModuleAccess = async (
  token: string,
  projectId: string,
  body: { ownerTeamId: number | null; editorTeamIds: number[] }
) =>
  fetchJson(`/api/admin/shared-modules/${projectId}/access`, {
    method: 'PUT',
    token,
    body,
  });
