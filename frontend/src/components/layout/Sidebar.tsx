import { useRouter } from '../../routes/AppRoutes';
import type { RouteKey } from '../../types';

interface NavItem {
  key: RouteKey;
  label: string;
  icon: string;
}

const MAIN_NAV: NavItem[] = [
  { key: 'dashboard',        label: 'Dashboard',           icon: '▦' },
  { key: 'search',           label: 'Buscar Usuario',      icon: '⊕' },
  { key: 'account-creation', label: 'Creación de Cuentas', icon: '◎' },
  { key: 'audit',            label: 'Auditoría',           icon: '☰' },
];

const CONFIG_NAV: NavItem[] = [
  { key: 'attribute-catalog',    label: 'Catálogo AD',       icon: '≡' },
  { key: 'permissions-matrix',   label: 'Matriz de Permisos',icon: '⊞' },
  { key: 'account-type-config',  label: 'Tipos de Cuenta',   icon: '⊟' },
];

function NavButton({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  return (
    <button
      className={`nav-item${active ? ' active' : ''}`}
      onClick={onClick}
    >
      <span className="nav-icon">{item.icon}</span>
      {item.label}
    </button>
  );
}

export function Sidebar() {
  const { currentRoute, navigate } = useRouter();

  const isActive = (key: RouteKey) =>
    currentRoute === key || (key === 'search' && currentRoute === 'user-detail');

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h2>AccountGov</h2>
        <span>Active Directory Manager</span>
      </div>

      <nav className="sidebar-nav">
        {MAIN_NAV.map(item => (
          <NavButton
            key={item.key}
            item={item}
            active={isActive(item.key)}
            onClick={() => navigate(item.key)}
          />
        ))}

        <div style={{
          margin:     '16px 0 6px',
          padding:    '0 16px',
          fontSize:   '10px',
          fontWeight: 700,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.35)',
          userSelect: 'none',
        }}>
          Configuración
        </div>

        {CONFIG_NAV.map(item => (
          <NavButton
            key={item.key}
            item={item}
            active={isActive(item.key)}
            onClick={() => navigate(item.key)}
          />
        ))}
      </nav>

      <div className="sidebar-footer">
        <span>v1.0.0 — Mock Mode</span>
      </div>
    </aside>
  );
}
