import { apiFetch } from '../../api/apiFetch';
import type { CellAccess, MatrixFieldAccess, PermissionsMatrix } from './types';

export const permissionsMatrixApi = {
  async getMatrix(): Promise<PermissionsMatrix> {
    const res = await apiFetch('/api/permissions/matrix');
    return res.json() as Promise<PermissionsMatrix>;
  },

  async updateCell(roleKey: string, fieldKey: string, access: CellAccess): Promise<MatrixFieldAccess> {
    const res = await apiFetch(
      `/api/permissions/matrix/${encodeURIComponent(roleKey)}/${encodeURIComponent(fieldKey)}`,
      {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ access }),
      },
    );
    return res.json() as Promise<MatrixFieldAccess>;
  },
};
