import { useState } from 'react';
import { AppBadge, AppButton, AppCard, AppInput, AppModal, AppPageHeader } from '../../shared/ui';
import { useAuth } from '../../auth/useAuth';
import { useAttributeCatalog } from './useAttributeCatalog';
import type { Attribute, AttributeForm } from './types';

// ── Category metadata ─────────────────────────────────────────────────────────

const CATEGORIES = ['identity', 'contact', 'organizational', 'account', 'extension', 'directory'] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_META: Record<Category, { label: string; color: string; bg: string }> = {
  identity:       { label: 'Identidad',     color: '#3B82F6', bg: '#3B82F611' },
  contact:        { label: 'Contacto',      color: '#22C55E', bg: '#22C55E11' },
  organizational: { label: 'Organización',  color: '#8B5CF6', bg: '#8B5CF611' },
  account:        { label: 'Cuenta',        color: '#EF4444', bg: '#EF444411' },
  extension:      { label: 'Extensión',     color: '#F59E0B', bg: '#F59E0B11' },
  directory:      { label: 'Directorio',    color: '#64748B', bg: '#64748B11' },
};

const UNKNOWN_CATEGORY_META = { label: 'Sin categoría', color: '#94A3B8', bg: '#94A3B811' };

function categoryMeta(category: string | null) {
  return category && category in CATEGORY_META
    ? CATEGORY_META[category as Category]
    : UNKNOWN_CATEGORY_META;
}

const DATA_TYPES = ['string', 'integer', 'flags', 'datetime', 'dn', 'boolean'] as const;
const DATA_TYPE_LABEL: Record<string, string> = {
  string: 'Texto', integer: 'Entero', flags: 'Flags', datetime: 'Fecha/hora', dn: 'DN', boolean: 'Booleano',
};

const FIELD_TYPES = ['Text', 'Email', 'Select', 'Textarea'] as const;

// ── Sub-components ────────────────────────────────────────────────────────────

function CategoryChip({
  category, active, count, onClick,
}: {
  category: Category | 'all';
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
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '5px 12px', borderRadius: 'var(--ds-radius-full)',
        border: active ? `2px solid ${meta.color}` : '2px solid var(--ds-neutral-200)',
        background: active ? meta.bg : 'transparent',
        color: active ? meta.color : 'var(--ds-neutral-500)',
        fontWeight: active ? 700 : 500, fontSize: '12px', cursor: 'pointer',
        transition: 'all 0.15s', whiteSpace: 'nowrap',
      }}
    >
      {meta.label}
      <span style={{
        fontSize: '10px', background: active ? meta.color : 'var(--ds-neutral-200)',
        color: active ? '#fff' : 'var(--ds-neutral-600)', borderRadius: 'var(--ds-radius-full)',
        padding: '1px 6px', fontWeight: 700,
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
  padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700,
  color: 'var(--ds-neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em',
  borderBottom: '1px solid var(--ds-neutral-200)', background: 'var(--ds-neutral-50)', whiteSpace: 'nowrap',
};
const TH_CENTER: React.CSSProperties = { ...TH, textAlign: 'center' };

const SELECT_STYLE: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 'var(--ds-radius-xl)',
  border: '1px solid var(--ds-neutral-200)', fontFamily: 'var(--ds-font-body)',
  fontSize: 'var(--ds-text-base)', color: 'var(--ds-neutral-800)', background: 'var(--ds-neutral-0)',
};

function FieldRow({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ds-neutral-600)', marginBottom: '4px' }}>
        {label}{required && <span style={{ color: 'var(--ds-danger-main)' }}> *</span>}
      </label>
      {children}
    </div>
  );
}

function AttributeFormFields({
  form, editingFieldKey, onChange,
}: {
  form: AttributeForm;
  editingFieldKey: string | null;
  onChange: <K extends keyof AttributeForm>(key: K, value: AttributeForm[K]) => void;
}) {
  return (
    <div>
      <FieldRow label="FieldKey (clave interna, inmutable)" required>
        <AppInput
          value={form.fieldKey}
          onChange={e => onChange('fieldKey', e.target.value)}
          disabled={editingFieldKey !== null}
          placeholder="field-mi-atributo"
        />
      </FieldRow>

      <FieldRow label="Atributo LDAP (AdAttributeName)" required>
        <AppInput
          value={form.adAttributeName}
          onChange={e => onChange('adAttributeName', e.target.value)}
          placeholder="mail, department, extensionAttribute7…"
        />
      </FieldRow>

      <FieldRow label="Nombre visible" required>
        <AppInput
          value={form.displayName}
          onChange={e => onChange('displayName', e.target.value)}
        />
      </FieldRow>

      <FieldRow label="Descripción">
        <AppInput
          value={form.description}
          onChange={e => onChange('description', e.target.value)}
        />
      </FieldRow>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <FieldRow label="Categoría" required>
          <select style={SELECT_STYLE} value={form.category} onChange={e => onChange('category', e.target.value)}>
            <option value="">—</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
          </select>
        </FieldRow>

        <FieldRow label="Tipo de dato (LDAP)" required>
          <select style={SELECT_STYLE} value={form.dataType} onChange={e => onChange('dataType', e.target.value)}>
            <option value="">—</option>
            {DATA_TYPES.map(d => <option key={d} value={d}>{DATA_TYPE_LABEL[d]}</option>)}
          </select>
        </FieldRow>
      </div>

      <FieldRow label="Tipo de campo (widget del formulario)">
        <select style={SELECT_STYLE} value={form.fieldType} onChange={e => onChange('fieldType', e.target.value)}>
          {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </FieldRow>

      <FieldRow label="Valores permitidos (separados por coma, opcional)">
        <AppInput
          value={form.allowedValues}
          onChange={e => onChange('allowedValues', e.target.value)}
          placeholder="Enabled, Disabled"
        />
      </FieldRow>

      <FieldRow label="Placeholder (opcional)">
        <AppInput
          value={form.placeholder}
          onChange={e => onChange('placeholder', e.target.value)}
        />
      </FieldRow>

      <div style={{ display: 'flex', gap: '20px', marginTop: '4px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--ds-neutral-700)' }}>
          <input type="checkbox" checked={form.isSensitive} onChange={e => onChange('isSensitive', e.target.checked)} />
          Sensible
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--ds-neutral-700)' }}>
          <input type="checkbox" checked={form.requiresAudit} onChange={e => onChange('requiresAudit', e.target.checked)} />
          Requiere auditoría
        </label>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AttributeCatalogPage() {
  const [filterCategory, setFilterCategory] = useState<Category | 'all'>('all');

  const { user } = useAuth();
  // El backend es la barrera real (mutaciones gateadas a SystemAdmin en
  // PermissionsController) — esto solo evita mostrar controles que igual
  // serían rechazados con 403 para el resto de roles.
  const isSystemAdmin = user?.roles.includes('SystemAdmin') ?? false;

  const {
    attributes, loading, loadError,
    isModalOpen, mode, form, saving, saveError,
    statusUpdatingKey,
    openCreate, openEdit, closeModal, updateField, save, toggleStatus,
  } = useAttributeCatalog();

  const filtered = filterCategory === 'all'
    ? attributes
    : attributes.filter(a => a.category === filterCategory);

  const countFor = (cat: Category | 'all') =>
    cat === 'all' ? attributes.length : attributes.filter(a => a.category === cat).length;

  return (
    <div>
      <AppPageHeader
        title="Catálogo de Atributos AD"
        description={isSystemAdmin
          ? 'Administra los atributos del directorio que el portal gestiona: crear, editar, activar e inactivar.'
          : 'Catálogo de atributos del directorio gestionados por el portal (solo lectura).'}
        action={isSystemAdmin ? <AppButton variant="primary" onClick={openCreate}>Nuevo atributo</AppButton> : undefined}
      />

      {loadError && <div className="ds-alert ds-alert--error">{loadError}</div>}

      <AppCard style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--ds-neutral-500)', marginRight: '4px', fontWeight: 600 }}>
            Filtrar por categoría:
          </span>
          <CategoryChip category="all" active={filterCategory === 'all'} count={countFor('all')} onClick={() => setFilterCategory('all')} />
          {CATEGORIES.map(cat => (
            <CategoryChip key={cat} category={cat} active={filterCategory === cat} count={countFor(cat)} onClick={() => setFilterCategory(cat)} />
          ))}
        </div>
      </AppCard>

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
        </div>

        {loading ? (
          <div className="ds-loading">Cargando...</div>
        ) : (
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
                  <th style={TH_CENTER}>Activo</th>
                  {isSystemAdmin && <th style={TH_CENTER}>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((attr: Attribute, idx) => (
                  <tr key={attr.fieldKey} style={{ background: idx % 2 === 0 ? '#fff' : 'var(--ds-neutral-50)' }}>
                    <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ds-neutral-900)', marginBottom: '3px' }}>
                        {attr.displayName}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--ds-neutral-400)', lineHeight: 1.4, maxWidth: '360px' }}>
                        {attr.description}
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                      <span style={{ fontFamily: 'var(--ds-font-mono)', fontSize: '12px', color: 'var(--ds-neutral-700)', background: 'var(--ds-neutral-100)', padding: '2px 6px', borderRadius: 'var(--ds-radius-sm)', display: 'inline-block', whiteSpace: 'nowrap' }}>
                        {attr.adAttributeName}
                      </span>
                    </td>

                    <td style={{ padding: '12px 16px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: categoryMeta(attr.category).color, background: categoryMeta(attr.category).bg, padding: '3px 8px', borderRadius: 'var(--ds-radius-full)', border: `1px solid ${categoryMeta(attr.category).color}33` }}>
                        {categoryMeta(attr.category).label}
                      </span>
                    </td>

                    <td style={{ padding: '12px 16px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '12px', color: 'var(--ds-neutral-500)' }}>
                        {attr.dataType ? DATA_TYPE_LABEL[attr.dataType] ?? attr.dataType : '—'}
                      </span>
                    </td>

                    <td style={{ padding: '12px 16px', verticalAlign: 'top', textAlign: 'center' }}>
                      <CheckCell value={attr.isSensitive} />
                    </td>
                    <td style={{ padding: '12px 16px', verticalAlign: 'top', textAlign: 'center' }}>
                      <CheckCell value={attr.requiresAudit} />
                    </td>
                    <td style={{ padding: '12px 16px', verticalAlign: 'top', textAlign: 'center' }}>
                      <AppBadge variant={attr.isActive ? 'success' : 'neutral'} size="sm">
                        {attr.isActive ? 'Activo' : 'Inactivo'}
                      </AppBadge>
                    </td>
                    {isSystemAdmin && (
                      <td style={{ padding: '12px 16px', verticalAlign: 'top', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <AppButton size="sm" variant="ghost" onClick={() => openEdit(attr)}>Editar</AppButton>
                        <AppButton
                          size="sm"
                          variant="ghost"
                          loading={statusUpdatingKey === attr.fieldKey}
                          onClick={() => toggleStatus(attr)}
                        >
                          {attr.isActive ? 'Inactivar' : 'Activar'}
                        </AppButton>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AppCard>

      <AppModal
        open={isModalOpen}
        onClose={closeModal}
        title={mode === 'create' ? 'Nuevo atributo AD' : `Editar: ${form.displayName || form.fieldKey}`}
        loading={saving}
        footer={
          <>
            <AppButton variant="secondary" onClick={closeModal} disabled={saving}>Cancelar</AppButton>
            <AppButton variant="primary" onClick={() => void save()} loading={saving}>Guardar</AppButton>
          </>
        }
      >
        {saveError && <div className="ds-alert ds-alert--error">{saveError}</div>}
        <AttributeFormFields
          form={form}
          editingFieldKey={mode === 'edit' ? form.fieldKey : null}
          onChange={updateField}
        />
      </AppModal>
    </div>
  );
}
