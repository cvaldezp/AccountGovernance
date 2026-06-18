import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../../auth/useAuth';
import { useRouter } from '../../routes/AppRoutes';
import {
  MOCK_USERS,
  MOCK_ACTIVITY_TIMELINE,
  MOCK_ALERTS,
} from '../../api/mockData';
import type { DashboardAlert, ActivityDataPoint } from '../../api/mockData';
import { getAuditEntries } from '../../api/auditApi';
import { getFieldDefinitions } from '../../api/adFieldMatrix';
import { AppButton, AppCard, AppBadge, AppPageHeader } from '../../shared/ui';
import type { AuditEntry } from '../../types/audit';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diffMs = new Date('2026-06-17T14:00:00Z').getTime() - new Date(iso).getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

function fmtDate(iso: string): string {
  const day   = parseInt(iso.slice(8), 10);
  const month = iso.slice(5, 7);
  const MONTHS: Record<string, string> = {
    '01':'Ene','02':'Feb','03':'Mar','04':'Abr','05':'May','06':'Jun',
    '07':'Jul','08':'Ago','09':'Sep','10':'Oct','11':'Nov','12':'Dic',
  };
  return `${MONTHS[month] ?? month} ${day}`;
}

function fieldDisplayName(fieldKey: string | undefined): string {
  if (!fieldKey) return '';
  const def = getFieldDefinitions().find(
    f => f.adAttributeName === fieldKey || f.fieldKey === fieldKey,
  );
  return def?.displayName ?? fieldKey;
}

const ACTION_META: Record<string, { label: string; color: string }> = {
  UPDATE_FIELD:    { label: 'Actualización',   color: 'var(--ds-info-main)'    },
  ENABLE_ACCOUNT:  { label: 'Habilitación',    color: 'var(--ds-success-main)' },
  DISABLE_ACCOUNT: { label: 'Deshabilitación', color: 'var(--ds-warning-main)' },
};

// ── SVG Line Chart ────────────────────────────────────────────────────────────

const SVG_W = 540;
const SVG_H = 200;
const PAD   = { l: 38, r: 16, t: 16, b: 34 };
const PW    = SVG_W - PAD.l - PAD.r;
const PH    = SVG_H - PAD.t - PAD.b;

type SeriesKey = keyof Omit<ActivityDataPoint, 'date'>;

const SERIES: { key: SeriesKey; label: string; color: string }[] = [
  { key: 'created',     label: 'Creados',     color: '#22C55E' },
  { key: 'deactivated', label: 'Desactivados', color: '#F59E0B' },
  { key: 'locked',      label: 'Bloqueados',  color: '#EF4444' },
  { key: 'deleted',     label: 'Eliminados',  color: '#94A3B8' },
];

function cubicPath(pts: [number, number][]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`;
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const cx = (x0 + x1) / 2;
    d += ` C ${cx} ${y0} ${cx} ${y1} ${x1} ${y1}`;
  }
  return d;
}

function LineChart({ data }: { data: ActivityDataPoint[] }) {
  const [hIdx, setHIdx] = useState<number | null>(null);

  const n      = data.length;
  const rawMax = Math.max(...data.flatMap(d => SERIES.map(s => d[s.key])), 1);
  const yMax   = Math.ceil(rawMax / 5) * 5;
  const yTicks = Array.from({ length: yMax / 5 + 1 }, (_, i) => i * 5);

  const xS    = (i: number) => PAD.l + (i / (n - 1)) * PW;
  const yS    = (v: number) => PAD.t + PH - (v / yMax) * PH;
  const baseY = PAD.t + PH;

  const zoneL = (i: number) => (i === 0     ? PAD.l      : (xS(i - 1) + xS(i)) / 2);
  const zoneR = (i: number) => (i === n - 1 ? PAD.l + PW : (xS(i) + xS(i + 1)) / 2);

  const hovered        = hIdx !== null ? data[hIdx] : null;
  const hovX           = hIdx !== null ? xS(hIdx) : 0;
  const tooltipLeftPct = (hovX / SVG_W) * 100;
  const flipTooltip    = hovX > SVG_W * 0.62;

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        onMouseLeave={() => setHIdx(null)}
      >
        {yTicks.map(t => (
          <g key={t}>
            <line x1={PAD.l} x2={PAD.l + PW} y1={yS(t)} y2={yS(t)} stroke="#E2E8F0" strokeWidth="1" />
            <text x={PAD.l - 6} y={yS(t)} textAnchor="end" dominantBaseline="middle" fontSize="10" fill="#94A3B8">{t}</text>
          </g>
        ))}
        <line x1={PAD.l} x2={PAD.l + PW} y1={baseY} y2={baseY} stroke="#E2E8F0" strokeWidth="1" />
        {data.map((d, i) => (
          <text key={i} x={xS(i)} y={SVG_H - 7} textAnchor="middle" fontSize="10" fill="#94A3B8">{fmtDate(d.date)}</text>
        ))}
        {SERIES.map(s => {
          const pts: [number, number][] = data.map((d, i) => [xS(i), yS(d[s.key])]);
          const last = pts[pts.length - 1];
          const first = pts[0];
          return (
            <path key={`area-${s.key}`} d={`${cubicPath(pts)} L ${last[0]} ${baseY} L ${first[0]} ${baseY} Z`} fill={s.color} fillOpacity="0.07" stroke="none" />
          );
        })}
        {SERIES.map(s => {
          const pts: [number, number][] = data.map((d, i) => [xS(i), yS(d[s.key])]);
          return <path key={`line-${s.key}`} d={cubicPath(pts)} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />;
        })}
        {SERIES.map(s =>
          data.map((d, i) => {
            const isHov = hIdx === i;
            return <circle key={`dot-${s.key}-${i}`} cx={xS(i)} cy={yS(d[s.key])} r={isHov ? 5 : 3.5} fill={isHov ? s.color : '#fff'} stroke={s.color} strokeWidth="2" pointerEvents="none" />;
          })
        )}
        {hIdx !== null && (
          <line x1={hovX} x2={hovX} y1={PAD.t} y2={baseY} stroke="#CBD5E1" strokeWidth="1" strokeDasharray="4 3" pointerEvents="none" />
        )}
        {data.map((_, i) => (
          <rect key={`zone-${i}`} x={zoneL(i)} y={PAD.t} width={zoneR(i) - zoneL(i)} height={PH} fill="transparent" style={{ cursor: 'crosshair' }} onMouseEnter={() => setHIdx(i)} />
        ))}
      </svg>

      {hovered !== null && hIdx !== null && (
        <div style={{ position: 'absolute', left: `${tooltipLeftPct}%`, top: '12px', transform: flipTooltip ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)', background: 'rgba(15, 23, 42, 0.93)', color: '#fff', borderRadius: '10px', padding: '10px 14px', fontSize: '12px', pointerEvents: 'none', zIndex: 20, minWidth: '152px', boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', marginBottom: '8px', letterSpacing: '0.04em' }}>{fmtDate(hovered.date)}</div>
          {SERIES.map(s => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <svg width="18" height="6" viewBox="0 0 18 6" style={{ flexShrink: 0 }}>
                <line x1="0" y1="3" x2="18" y2="3" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="9" cy="3" r="3" fill={s.color} />
              </svg>
              <span style={{ color: '#CBD5E1', flex: 1, fontSize: '11px' }}>{s.label}</span>
              <span style={{ fontWeight: 700, color: '#fff', fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>{hovered[s.key]}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', marginTop: '10px', paddingLeft: `${PAD.l}px` }}>
        {SERIES.map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="20" height="6" viewBox="0 0 20 6" style={{ display: 'block', flexShrink: 0 }}>
              <line x1="0" y1="3" x2="20" y2="3" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="10" cy="3" r="3" fill={s.color} />
            </svg>
            <span style={{ fontSize: '11px', color: 'var(--ds-neutral-500)' }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Dashboard sub-components ──────────────────────────────────────────────────

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ds-neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
      {children}
    </div>
  );
}

function DomainBlock({ domain, users, totalUsers }: { domain: string; users: typeof MOCK_USERS; totalUsers: number }) {
  const enabled  = users.filter(u => u.attributes.AccountStatus === 'Enabled').length;
  const disabled = users.filter(u => u.attributes.AccountStatus === 'Disabled').length;
  const locked   = users.filter(u => u.attributes.AccountStatus === 'Locked').length;
  const pct      = Math.round((users.length / totalUsers) * 100);

  return (
    <div style={{ background: 'var(--ds-neutral-50)', border: '1px solid var(--ds-neutral-200)', borderRadius: 'var(--ds-radius-xl)', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div>
          <div style={{ fontFamily: 'var(--ds-font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--ds-neutral-700)', marginBottom: '2px' }}>{domain}</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--ds-neutral-900)', lineHeight: 1 }}>{users.length}</div>
          <div style={{ fontSize: '11px', color: 'var(--ds-neutral-400)', marginTop: '2px' }}>usuarios · {pct}% del total</div>
        </div>
        <AppBadge variant="neutral">{pct}%</AppBadge>
      </div>
      <div style={{ height: '6px', borderRadius: '999px', background: 'var(--ds-neutral-200)', marginBottom: '14px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: '999px', background: 'linear-gradient(to right, var(--ds-brand-700), var(--ds-brand-400))', transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <StatusDot color="#22C55E" label="Habilitados"    count={enabled}  />
        <StatusDot color="#F59E0B" label="Deshabilitados" count={disabled} />
        <StatusDot color="#EF4444" label="Bloqueados"     count={locked}   />
      </div>
    </div>
  );
}

function StatusDot({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: '12px', color: 'var(--ds-neutral-600)', flex: 1 }}>{label}</span>
      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ds-neutral-800)' }}>{count}</span>
    </div>
  );
}

function ChangeRow({ entry }: { entry: AuditEntry }) {
  const meta = ACTION_META[entry.actionType] ?? { label: entry.actionType, color: 'var(--ds-neutral-400)' };
  const field = fieldDisplayName(entry.fieldKey);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '10px 0', borderBottom: '1px solid var(--ds-neutral-100)' }}>
      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: entry.success ? meta.color : 'var(--ds-neutral-300)', flexShrink: 0, marginTop: '5px' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ds-neutral-800)' }}>{entry.performedBy}</span>
          <span style={{ fontSize: '12px', color: 'var(--ds-neutral-400)' }}>·</span>
          <span style={{ fontSize: '12px', color: 'var(--ds-neutral-500)' }}>{meta.label}</span>
          {!entry.success && <AppBadge variant="danger">Error</AppBadge>}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--ds-neutral-500)', marginTop: '2px' }}>
          <span style={{ fontFamily: 'var(--ds-font-mono)', color: 'var(--ds-neutral-700)' }}>{entry.targetUser}</span>
          {field && (
            <> &rsaquo; <span style={{ color: 'var(--ds-neutral-600)' }}>{field}</span></>
          )}
        </div>
      </div>
      <div style={{ fontSize: '11px', color: 'var(--ds-neutral-400)', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {timeAgo(entry.timestamp)}
      </div>
    </div>
  );
}

function AlertRow({ alert }: { alert: DashboardAlert }) {
  const severityColor = { danger: 'var(--ds-danger-main)', warning: 'var(--ds-warning-main)', info: 'var(--ds-info-main)' }[alert.severity];
  const severityBg    = { danger: 'var(--ds-danger-light)', warning: 'var(--ds-warning-light)', info: 'var(--ds-info-light)' }[alert.severity];

  return (
    <div style={{ display: 'flex', gap: '12px', padding: '12px', borderRadius: 'var(--ds-radius-lg)', background: severityBg, border: `1px solid ${severityColor}22`, marginBottom: '8px' }}>
      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: severityColor, flexShrink: 0, marginTop: '3px' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ds-neutral-800)', marginBottom: '2px' }}>{alert.title}</div>
        <div style={{ fontSize: '12px', color: 'var(--ds-neutral-600)', lineHeight: 1.4 }}>{alert.description}</div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const [recentChanges, setRecentChanges] = useState<AuditEntry[]>([]);

  const total    = MOCK_USERS.length;
  const enabled  = MOCK_USERS.filter(u => u.attributes.AccountStatus === 'Enabled').length;
  const disabled = MOCK_USERS.filter(u => u.attributes.AccountStatus === 'Disabled').length;
  const locked   = MOCK_USERS.filter(u => u.attributes.AccountStatus === 'Locked').length;

  const usfqUsers = MOCK_USERS.filter(u => u.email.toLowerCase().includes('@usfq.edu.ec'));
  const asigUsers = MOCK_USERS.filter(u => u.email.toLowerCase().includes('@asig.edu.ec'));

  useEffect(() => {
    getAuditEntries().then(entries => setRecentChanges(entries.slice(0, 7)));
  }, []);

  return (
    <div>
      <AppPageHeader
        title="Dashboard Operativo"
        description={`Bienvenido, ${user?.name ?? 'Operador'}. Vista general del estado de cuentas Active Directory.`}
        action={
          <div style={{ display: 'flex', gap: '8px' }}>
            <AppButton size="sm" variant="secondary" onClick={() => navigate('audit')}>Ver auditoría</AppButton>
            <AppButton size="sm" variant="primary"   onClick={() => navigate('search')}>Buscar usuario</AppButton>
          </div>
        }
      />

      {/* Row 1: Stat cards */}
      <div className="ds-stat-grid" style={{ marginBottom: '16px' }}>
        <div className="ds-stat-card" style={{ borderTop: '3px solid var(--ds-neutral-300)' }}>
          <div className="ds-stat-card__label">Total Usuarios</div>
          <div className="ds-stat-card__value">{total}</div>
          <div style={{ fontSize: '11px', color: 'var(--ds-neutral-400)', marginTop: '6px' }}>
            {usfqUsers.length} USFQ · {asigUsers.length} ASIG
          </div>
        </div>
        <div className="ds-stat-card" style={{ borderTop: '3px solid #22C55E' }}>
          <div className="ds-stat-card__label">Habilitados</div>
          <div className="ds-stat-card__value" style={{ color: 'var(--ds-success-dark)' }}>{enabled}</div>
          <div style={{ fontSize: '11px', color: 'var(--ds-neutral-400)', marginTop: '6px' }}>{Math.round((enabled / total) * 100)}% del total</div>
        </div>
        <div className="ds-stat-card" style={{ borderTop: '3px solid #F59E0B' }}>
          <div className="ds-stat-card__label">Deshabilitados</div>
          <div className="ds-stat-card__value" style={{ color: 'var(--ds-warning-dark)' }}>{disabled}</div>
          <div style={{ fontSize: '11px', color: 'var(--ds-neutral-400)', marginTop: '6px' }}>{Math.round((disabled / total) * 100)}% del total</div>
        </div>
        <div className="ds-stat-card" style={{ borderTop: '3px solid #EF4444' }}>
          <div className="ds-stat-card__label">Bloqueados</div>
          <div className="ds-stat-card__value" style={{ color: 'var(--ds-danger-dark)' }}>{locked}</div>
          <div style={{ fontSize: '11px', color: 'var(--ds-neutral-400)', marginTop: '6px' }}>Requieren intervención</div>
        </div>
      </div>

      {/* Row 2: Domain breakdown + Activity chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <AppCard title="Resumen por Dominio">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <DomainBlock domain="USFQ.EDU.EC" users={usfqUsers} totalUsers={total} />
            <DomainBlock domain="ASIG.EDU.EC" users={asigUsers} totalUsers={total} />
          </div>
        </AppCard>

        <AppCard title="Actividad — Últimos 30 días" description="Evolución de operaciones sobre cuentas de usuario">
          <LineChart data={MOCK_ACTIVITY_TIMELINE} />
        </AppCard>
      </div>

      {/* Row 3: Últimos cambios + Alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '16px' }}>
        <AppCard
          title="Últimos Cambios"
          action={
            <AppButton size="sm" variant="ghost" onClick={() => navigate('audit')}>Ver todo</AppButton>
          }
        >
          <SectionLabel>Operaciones recientes del sistema de auditoría</SectionLabel>
          {recentChanges.length === 0 ? (
            <div style={{ color: 'var(--ds-neutral-400)', fontSize: '14px', padding: '20px 0' }}>Sin actividad registrada</div>
          ) : (
            recentChanges.map(entry => <ChangeRow key={entry.id} entry={entry} />)
          )}
        </AppCard>

        <AppCard title="Alertas Operativas">
          <SectionLabel>Estado del sistema</SectionLabel>
          {MOCK_ALERTS.map(alert => <AlertRow key={alert.id} alert={alert} />)}
        </AppCard>
      </div>
    </div>
  );
}
