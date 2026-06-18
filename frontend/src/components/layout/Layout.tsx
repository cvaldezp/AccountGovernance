import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { RoleSelector } from './RoleSelector';
import { useAuth } from '../../auth/useAuth';
import { ROLES_CONFIG } from '../../config/roles.config';

export function Layout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const roleConfig = ROLES_CONFIG.find(r => r.name === user?.role);
  const initials = user?.name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('') ?? '?';

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <header className="top-bar">
          <div className="topbar-title">
            <span className="topbar-env-badge">MOCK</span>
          </div>
          <div className="topbar-right">
            <RoleSelector />
            <div className="topbar-user">
              <div
                className="topbar-avatar"
                style={{ background: roleConfig?.color ?? '#3b82f6' }}
              >
                {initials}
              </div>
              <div className="topbar-user-info">
                <span className="topbar-user-name">{user?.name}</span>
                <span className="topbar-user-role">{roleConfig?.displayName}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
