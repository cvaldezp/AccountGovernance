import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { UserProfilePopover } from './UserProfilePopover';
import { useAuth } from '../../auth/useAuth';

export function Layout({ children }: { children: ReactNode }) {
  const { logout } = useAuth();

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <header className="top-bar">
          <div className="topbar-title">
            <span style={{
              fontSize:     '11px',
              fontWeight:   700,
              letterSpacing:'0.08em',
              textTransform:'uppercase',
              padding:      '2px 8px',
              borderRadius: '4px',
              background:   'var(--ds-brand-500)',
              color:        'white',
            }}>
              USFQ
            </span>
          </div>
          <div className="topbar-right">
            <UserProfilePopover />
            <button
              onClick={logout}
              title="Cerrar sesión"
              style={{
                background:   'none',
                border:       '1px solid var(--ds-neutral-200)',
                borderRadius: 'var(--ds-radius-md)',
                padding:      '5px 12px',
                cursor:       'pointer',
                fontSize:     'var(--ds-text-xs)',
                color:        'var(--ds-neutral-500)',
                fontWeight:   500,
              }}
            >
              Salir
            </button>
          </div>
        </header>

        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
