import { useState } from 'react';
import {
  AD_ATTRIBUTE_CATALOG,
  type ADAttributeCategory,
} from '../../config/adAttributeCatalog';
import { AppCard, AppBadge, AppPageHeader } from '../../shared/ui';

// ── Category metadata ─────────────────────────────────────────────────────────

const CATEGORY_META: Record<ADAttributeCategory, { label: string; color: string; bg: string }> = {
  identity:       { label: 'Identidad',      color: '#3B82F6', bg: '#3B82F611' },
  contact:        { label: 'Contacto',        color: '#22C55E', bg: '#22C55E11' },
  organizational: { label: 'Organización',   color: '#8B5CF6', bg: '#8B5CF611' },
  account:        { label: 'Cuenta',          color: '#EF4444', bg: '#EF444411' },
  extension:      { label: 'Extensión',       color: '#F59E0B', bg: '#F59E0B11' },
  directory:      { label: 'Directorio',      color: '#64748B', bg: '#64748B11' },
};

const CATEGORIES: ADAttributeCategory[] = [
  'identity', 'contact', 'organizational', 'account', 'extension', 'directory',
];

const DATA_TYPE_LABEL: Record<string, string> = {
  string:   'Texto',
  integer:  'Entero',
  flags:    'Flags',
  datetime: 'Fecha/hora',
  dn:       'DN',
  boolean:  'Booleano',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function CategoryChip({
  category,
  active,
  count,
  onClick,
}: {
  category: ADAttributeCategory | 'all';
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  const meta = category === 'all'
    ? { label: 'Todos', color: '#475569', bg: '#47556911' }
    : CATEGORY_META[category];

  return (
    <button
      onClick={onClick}
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        gap:             '6px',
        padding:         '5px 12px',
        borderRadius:    'var(--ds-radius-full)',
        border:          active ? `2px solid ${meta.color}` : '2px solid var(--ds-neutral-200)',
        background:      active ? meta.bg : 'transparent',
        color:           active ? meta.color : 'var(--ds-neutral-500)',
        fontWeight:      active ? 700 : 500,
        fontSize:        '12px',
        cursor:          'pointer',
        transition:      'all 0.15s',
        whiteSpace:      'nowrap',
      }}
    >
      {meta.label}
      <span style={{
        fontSize:     '10px',
        background:   active ? meta.color : 'var(--ds-neutral-200)',
        color:        active ? '#fff' : 'var(--ds-neutral-600)',
        borderRadius: 'var(--ds-radius-full)',
        padding:      '1px 6px',
        fontWeight:   700,
      }}>
        {count}
      </span>
    </button>
  );
}

function CheckCell({ value }: { value: boolean }) {
  return value ? (
    <span style={{ color: 'var(--ds-success-dark)', fontWeight: 700, fontSize: '14px' }}>✓</span>
  ) : (
    <span style={{ color: 'var(--ds-neutral-300)', fontSize: '14px' }}>—</span>
  );
}

const TH: React.CSSProperties = {
  padding:       '10px 16px',
  textAlign:     'left',
  fontSize:      '11px',
  fontWeight:    700,
  color:         'var(--ds-neutral-500)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  borderBottom:  '1px solid var(--ds-neutral-200)',
  background:    'var(--ds-neutral-50)',
  whiteSpace:    'nowrap',
};

const TH_CENTER: React.CSSProperties = { ...TH, textAlign: 'center' };

// ── Main page ─────────────────────────────────────────────────────────────────

export function AttributeCatalogPage() {
  const [filterCategory, setFilterCategory] = useState<ADAttributeCategory | 'all'>('all');

  const filtered = filterCategory === 'all'
    ? AD_ATTRIBUTE_CATALOG
    : AD_ATTRIBUTE_CATALOG.filter(a => a.category === filterCategory);

  const countFor = (cat: ADAttributeCategory | 'all') =>
    cat === 'all' ? AD_ATTRIBUTE_CATALOG.length : AD_ATTRIBUTE_CATALOG.filter(a => a.category === cat).length;

  return (
    <div>
      <AppPageHeader
        title="Catálogo de Atributos AD"
        description="Referencia técnica de todos los atributos del directorio que el portal puede consultar o administrar"
      />

      {/* Summary stat chips */}
      <AppCard style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--ds-neutral-500)', marginRight: '4px', fontWeight: 600 }}>
            Filtrar por categoría:
          </span>
          <CategoryChip
            category="all"
            active={filterCategory === 'all'}
            count={countFor('all')}
            onClick={() => setFilterCategory('all')}
          />
          {CATEGORIES.map(cat => (
            <CategoryChip
              key={cat}
              category={cat}
              active={filterCategory === cat}
              count={countFor(cat)}
              onClick={() => setFilterCategory(cat)}
            />
          ))}
        </div>
      </AppCard>

      {/* Catalog table */}
      <AppCard noPadding>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--ds-neutral-100)' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ds-neutral-700)' }}>
            {filtered.length} atributo(s)
            {filterCategory !== 'all' && (
              <span style={{ fontWeight: 400, color: 'var(--ds-neutral-400)', marginLeft: '6px' }}>
                — {CATEGORY_META[filterCategory].label}
              </span>
            )}
          </span>
          <AppBadge variant="neutral" style={{ fontSize: '11px' }}>
            Solo lectura · No conectado a AD real
          </AppBadge>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>
                <th style={TH}>Nombre / Descripción</th>
                <th style={TH}>Atributo AD</th>
                <th style={TH}>Categoría</th>
                <th style={TH}>Tipo de dato</th>
                <th style={TH_CENTER}>Sensible</th>
                <th style={TH_CENTER}>Auditable</th>
                <th style={TH_CENTER}>Editable</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, idx) => (
                <tr
                  key={entry.key}
                  style={{ background: idx % 2 === 0 ? '#fff' : 'var(--ds-neutral-50)' }}
                >
                  {/* Display name + description */}
                  <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ds-neutral-900)', marginBottom: '3px' }}>
                      {entry.displayName}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--ds-neutral-400)', lineHeight: 1.4, maxWidth: '360px' }}>
                      {entry.description}
                    </div>
                  </td>

                  {/* AD Attribute Name */}
                  <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                    <span style={{ fontFamily: 'var(--ds-font-mono)', fontSize: '12px', color: 'var(--ds-neutral-700)', background: 'var(--ds-neutral-100)', padding: '2px 6px', borderRadius: 'var(--ds-radius-sm)', display: 'inline-block', whiteSpace: 'nowrap' }}>
                      {entry.adAttributeName}
                    </span>
                  </td>

                  {/* Category */}
                  <td style={{ padding: '12px 16px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: CATEGORY_META[entry.category].color, background: CATEGORY_META[entry.category].bg, padding: '3px 8px', borderRadius: 'var(--ds-radius-full)', border: `1px solid ${CATEGORY_META[entry.category].color}33` }}>
                      {CATEGORY_META[entry.category].label}
                    </span>
                  </td>

                  {/* Data type */}
                  <td style={{ padding: '12px 16px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '12px', color: 'var(--ds-neutral-500)' }}>
                      {DATA_TYPE_LABEL[entry.dataType] ?? entry.dataType}
                    </span>
                  </td>

                  {/* Booleans */}
                  <td style={{ padding: '12px 16px', verticalAlign: 'top', textAlign: 'center' }}>
                    <CheckCell value={entry.isSensitive} />
                  </td>
                  <td style={{ padding: '12px 16px', verticalAlign: 'top', textAlign: 'center' }}>
                    <CheckCell value={entry.requiresAudit} />
                  </td>
                  <td style={{ padding: '12px 16px', verticalAlign: 'top', textAlign: 'center' }}>
                    <CheckCell value={entry.isEditableCandidate} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AppCard>
    </div>
  );
}

