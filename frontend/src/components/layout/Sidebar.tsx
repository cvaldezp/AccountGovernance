import { useState } from 'react';
import { useRouter } from '../../routes/AppRoutes';
import { useAuth } from '../../auth/useAuth';
import { canAccessRoute } from '../../routes/routeAccess';
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

// "Grupos" is a parent module — Fase 1 solo tiene Listas de Distribución;
// Grupos de Seguridad se agregará aquí como ítem hermano más adelante.
const GROUPS_NAV_ITEMS: NavItem[] = [
  { key: 'distribution-lists', label: 'Listas de Distribución', icon: '✉' },
];

// Qué rol ve cada ítem lo decide ROUTE_ACCESS (routes/routeAccess.ts) — la
// sección Configuración completa es exclusiva de SystemAdmin.
const CONFIG_NAV: NavItem[] = [
  { key: 'attribute-catalog',     label: 'Catálogo AD',             icon: '≡' },
  { key: 'permissions-matrix',    label: 'Matriz de Permisos',      icon: '⊞' },
  { key: 'account-type-config',   label: 'Tipos de Cuenta',         icon: '⊟' },
  { key: 'initial-groups',        label: 'Grupos Iniciales',        icon: '⊕' },
  { key: 'system-roles-config',   label: 'Roles y Grupos',          icon: '⚙' },
  { key: 'administrative-scopes', label: 'Ámbitos Administrativos', icon: '◎' },
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

function NavGroup({
  label, icon, items, isActive, onNavigate,
}: {
  label:      string;
  icon:       string;
  items:      NavItem[];
  isActive:   (key: RouteKey) => boolean;
  onNavigate: (key: RouteKey) => void;
}) {
  const anyActive = items.some(item => isActive(item.key));
  const [open, setOpen] = useState(anyActive);

  return (
    <div>
      <button
        className={`nav-item${anyActive ? ' active' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="nav-icon">{icon}</span>
        {label}
        <span style={{ marginLeft: 'auto', fontSize: '10px', opacity: 0.6 }}>{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div style={{ paddingLeft: '16px', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {items.map(item => (
            <NavButton
              key={item.key}
              item={item}
              active={isActive(item.key)}
              onClick={() => onNavigate(item.key)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Mismo patrón de lectura de env que el resto del frontend (agents/api) —
// sin un tipado global de ImportMetaEnv dedicado.
const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
const MOCK_MODE = env['VITE_USE_MOCK_DATA'] === 'true';

function AboutPanel() {
  const buildDate = new Date(__BUILD_TIME__);
  const buildLabel = Number.isNaN(buildDate.getTime())
    ? __BUILD_TIME__
    : buildDate.toLocaleString();

  const rows: [string, string][] = [
    ['Versión',   __APP_VERSION__],
    ['Commit',    __GIT_COMMIT__],
    ['Build',     buildLabel],
    ['Ambiente',  import.meta.env.MODE],
    ['Mock data', MOCK_MODE ? 'Sí' : 'No'],
  ];

  return (
    <div style={{
      margin:       '0 12px 8px',
      padding:      '10px 12px',
      borderRadius: '6px',
      background:   'rgba(255,255,255,0.06)',
      fontSize:     '11px',
      lineHeight:   1.6,
      color:        'rgba(255,255,255,0.75)',
    }}>
      {rows.map(([label, value]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <span style={{ opacity: 0.6 }}>{label}</span>
          <span style={{ fontFamily: 'monospace' }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

export function Sidebar() {
  const { currentRoute, navigate } = useRouter();
  const { user } = useAuth();
  const canSee = (item: NavItem) => canAccessRoute(item.key, user?.roles);
  const mainItems   = MAIN_NAV.filter(canSee);
  const groupItems  = GROUPS_NAV_ITEMS.filter(canSee);
  const configItems = CONFIG_NAV.filter(canSee);
  const [showAbout, setShowAbout] = useState(false);

  const isActive = (key: RouteKey) =>
    currentRoute === key || (key === 'search' && currentRoute === 'user-detail');

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h2>AccountGov</h2>
        <span>Active Directory Manager</span>
      </div>

      <nav className="sidebar-nav">
        {mainItems.map(item => (
          <NavButton
            key={item.key}
            item={item}
            active={isActive(item.key)}
            onClick={() => navigate(item.key)}
          />
        ))}

        {groupItems.length > 0 && (
          <NavGroup
            label="Grupos"
            icon="◈"
            items={groupItems}
            isActive={isActive}
            onNavigate={navigate}
          />
        )}

        {configItems.length > 0 && <div style={{
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
        </div>}

        {configItems.map(item => (
          <NavButton
            key={item.key}
            item={item}
            active={isActive(item.key)}
            onClick={() => navigate(item.key)}
          />
        ))}
      </nav>

      {showAbout && <AboutPanel />}

      <div className="sidebar-footer">
        <button
          onClick={() => setShowAbout(v => !v)}
          aria-expanded={showAbout}
          title="Acerca de"
          style={{
            all:  'unset',
            cursor: 'pointer',
            fontFamily: 'monospace',
          }}
        >
          v{__APP_VERSION__} · {__GIT_COMMIT__}
        </button>
      </div>
    </aside>
  );
}
