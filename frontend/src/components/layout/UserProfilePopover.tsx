import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { ROLES_CONFIG } from '../../config/roles.config';

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'medium' });
}

export function UserProfilePopover() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (!user) return null;

  const roleConfig    = ROLES_CONFIG.find(r => r.name === user.role);
  const initials      = user.name.split(' ').map(w => w[0]).slice(0, 2).join('') || '?';
  const isSystemAdmin = user.roles.includes('SystemAdmin');

  return (
    <div className="user-profile-popover" ref={containerRef}>
      <button
        type="button"
        className="topbar-user"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <div className="topbar-avatar" style={{ background: roleConfig?.color ?? '#3b82f6' }}>
          {initials}
        </div>
        <div className="topbar-user-info">
          <span className="topbar-user-name">
            {user.name}
            {isSystemAdmin && <span className="ds-badge ds-badge--sm topbar-admin-badge">SystemAdmin</span>}
          </span>
          <span className="topbar-user-role">{user.email}</span>
          <span className="topbar-user-primary-role">Rol principal: {user.primaryRole}</span>
        </div>
      </button>

      {open && (
        <div className="user-profile-panel" role="dialog" aria-label="Perfil de sesión">
          <div className="user-profile-panel-header">
            <div
              className="topbar-avatar"
              style={{ background: roleConfig?.color ?? '#3b82f6', width: 40, height: 40, fontSize: 14 }}
            >
              {initials}
            </div>
            <div>
              <div className="user-profile-panel-name">{user.name}</div>
              <div className="user-profile-panel-email">{user.email}</div>
            </div>
          </div>

          <dl className="user-profile-panel-fields">
            <div>
              <dt>UPN</dt>
              <dd>{user.upn}</dd>
            </div>
            <div>
              <dt>Object ID</dt>
              <dd>{user.objectId ?? '—'}</dd>
            </div>
            <div>
              <dt>Roles detectados</dt>
              <dd className="user-profile-badge-list">
                {user.roles.length > 0
                  ? user.roles.map(r => (
                      <span key={r} className="ds-badge ds-badge--neutral ds-badge--sm">{r}</span>
                    ))
                  : '—'}
              </dd>
            </div>
            <div>
              <dt>Rol principal</dt>
              <dd>{user.primaryRole}</dd>
            </div>
            <div>
              <dt>Autorizado</dt>
              <dd>
                <span className={`ds-badge ds-badge--sm ${user.isAuthorized ? 'ds-badge--success' : 'ds-badge--danger'}`}>
                  {user.isAuthorized ? 'Sí' : 'No'}
                </span>
              </dd>
            </div>
            <div>
              <dt>Permisos recibidos</dt>
              <dd>{user.permissions.length > 0 ? user.permissions.join(', ') : 'Ninguno (reservado)'}</dd>
            </div>
            <div>
              <dt>Perfil cargado</dt>
              <dd>{formatDateTime(user.profileLoadedAt)}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
