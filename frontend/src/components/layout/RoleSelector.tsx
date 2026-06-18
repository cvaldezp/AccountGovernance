import { useAuth } from '../../auth/useAuth';
import { ROLES_CONFIG } from '../../config/roles.config';
import type { RoleName } from '../../types';

export function RoleSelector() {
  const { user, switchRole } = useAuth();

  return (
    <div className="role-selector">
      <span className="role-selector-label">Rol activo:</span>
      <select
        value={user?.role}
        onChange={e => switchRole(e.target.value as RoleName)}
        title="Cambiar rol (solo para pruebas)"
      >
        {ROLES_CONFIG.map(r => (
          <option key={r.name} value={r.name}>
            {r.displayName}
          </option>
        ))}
      </select>
    </div>
  );
}
