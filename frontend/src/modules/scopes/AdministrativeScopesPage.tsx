import { useAuth } from '../../auth/useAuth';
import { AppBadge, AppButton, AppCard, AppInput, AppModal, AppPageHeader, AppTable } from '../../shared/ui';
import type { Column } from '../../shared/ui';
import { useAdministrativeScopes } from './useAdministrativeScopes';
import { FILTER_OPERATORS } from './types';
import type { AdministrativeScope, AdministrativeScopeFilter, CreateScopeForm, FilterForm, UpdateScopeForm } from './types';

function ErrorBanner({ message }: { message: string }) {
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 'var(--ds-radius-lg)', marginBottom: '12px',
      background: 'var(--ds-danger-light)', border: '1px solid var(--ds-danger-border)',
      color: 'var(--ds-danger-dark)', fontSize: 'var(--ds-text-sm)',
    }}>
      {message}
    </div>
  );
}

// Campos que CreateScopeForm y UpdateScopeForm comparten — todo salvo
// ScopeKey, que solo existe en Create (inmutable después). El formulario
// visual es el mismo para ambos; se tipa contra esta forma común en vez de
// ser genérico sobre las dos interfaces completas, para no pelear con la
// varianza de TypeScript en callbacks genéricos por un beneficio marginal.
type ScopeCommonFields = Pick<CreateScopeForm, 'name' | 'description' | 'category' | 'baseDn' | 'connectionProfile' | 'priority'>;

function ScopeFieldsForm({
  form, onChange,
}: {
  form: ScopeCommonFields;
  onChange: (key: keyof ScopeCommonFields, value: string | number) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <AppInput label="Nombre *" value={form.name} onChange={e => onChange('name', e.target.value)} />
      <AppInput
        label="Descripción" value={form.description}
        onChange={e => onChange('description', e.target.value)}
      />
      <AppInput
        label="Categoría" placeholder="Opcional — solo para organizar la lista"
        value={form.category} onChange={e => onChange('category', e.target.value)}
      />
      <AppInput
        label="Base DN *" placeholder="OU=Employees,OU=Cumbaya,DC=usfq,DC=edu,DC=ec"
        value={form.baseDn} onChange={e => onChange('baseDn', e.target.value)}
      />
      <AppInput
        label="Connection Profile" value={form.connectionProfile}
        onChange={e => onChange('connectionProfile', e.target.value)}
      />
      <div>
        <span style={{ fontSize: 'var(--ds-text-xs)', color: 'var(--ds-neutral-500)', display: 'block', marginBottom: '4px' }}>
          Prioridad
        </span>
        <input
          type="number" min={0} value={form.priority}
          onChange={e => onChange('priority', Number(e.target.value))}
          style={{ width: '100px', padding: '6px 8px', border: '1px solid var(--ds-neutral-300)', borderRadius: '4px', fontSize: 'var(--ds-text-sm)' }}
        />
      </div>
    </div>
  );
}

function FilterFieldsForm({
  form, onChange,
}: {
  form: FilterForm;
  onChange: <K extends keyof FilterForm>(key: K, value: FilterForm[K]) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <AppInput
        label="Tipo de filtro *" placeholder="ej. ExtensionAttribute, Company, Domain"
        value={form.filterType} onChange={e => onChange('filterType', e.target.value)}
      />
      <AppInput
        label="Atributo AD *" placeholder="ej. extensionAttribute14, company"
        value={form.attributeName} onChange={e => onChange('attributeName', e.target.value)}
      />
      <div>
        <span style={{ fontSize: 'var(--ds-text-xs)', color: 'var(--ds-neutral-500)', display: 'block', marginBottom: '4px' }}>
          Operador *
        </span>
        <select
          value={form.operator}
          onChange={e => onChange('operator', e.target.value as FilterForm['operator'])}
          style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--ds-neutral-300)', borderRadius: '4px', fontSize: 'var(--ds-text-sm)' }}
        >
          {FILTER_OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
        </select>
      </div>

      {form.operator !== 'Exists' && (
        <div>
          <AppInput label="Valor *" value={form.value} onChange={e => onChange('value', e.target.value)} />
          {form.operator === 'In' && (
            <span style={{ fontSize: 'var(--ds-text-xs)', color: 'var(--ds-neutral-400)', marginTop: '2px', display: 'block' }}>
              Separa los valores con comas (ej. A,B,C) — el orden y las mayúsculas no importan para detectar duplicados.
            </span>
          )}
        </div>
      )}

      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
        <input
          type="checkbox" checked={form.isActive}
          onChange={e => onChange('isActive', e.target.checked)}
          style={{ width: '16px', height: '16px', accentColor: 'var(--ds-brand-500)' }}
        />
        <span style={{ fontSize: 'var(--ds-text-sm)', color: 'var(--ds-neutral-700)' }}>Activo</span>
      </label>
    </div>
  );
}

function FilterRow({
  filter, isEditing, editForm, saving, saveError,
  isConfirmingDelete, isDeleting,
  onStartEdit, onCancelEdit, onFieldChange, onSave,
  onRequestDelete, onCancelDelete, onConfirmDelete,
}: {
  filter: AdministrativeScopeFilter;
  isEditing: boolean;
  editForm: FilterForm;
  saving: boolean;
  saveError: string | null;
  isConfirmingDelete: boolean;
  isDeleting: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onFieldChange: <K extends keyof FilterForm>(key: K, value: FilterForm[K]) => void;
  onSave: () => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  if (isEditing) {
    return (
      <div style={{
        padding: '14px', border: '2px solid var(--ds-brand-200)',
        borderRadius: 'var(--ds-radius-lg)', background: 'var(--ds-brand-50)',
      }}>
        <div style={{ fontWeight: 600, fontSize: 'var(--ds-text-sm)', color: 'var(--ds-brand-700)', marginBottom: '10px' }}>
          Editando filtro #{filter.id}
        </div>
        <FilterFieldsForm form={editForm} onChange={onFieldChange} />
        {saveError && <div style={{ marginTop: '10px' }}><ErrorBanner message={saveError} /></div>}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' }}>
          <AppButton variant="secondary" size="sm" onClick={onCancelEdit} disabled={saving}>Cancelar</AppButton>
          <AppButton variant="primary" size="sm" onClick={onSave} loading={saving}>Guardar</AppButton>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
      padding: '10px 14px', border: '1px solid var(--ds-neutral-200)',
      borderRadius: 'var(--ds-radius-lg)',
      background: filter.isActive ? 'var(--ds-neutral-0)' : 'var(--ds-neutral-50)',
      opacity: filter.isActive ? 1 : 0.65,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <AppBadge variant="neutral" size="sm">{filter.filterType}</AppBadge>
          <span style={{ fontFamily: 'var(--ds-font-mono)', fontWeight: 600, fontSize: 'var(--ds-text-sm)' }}>
            {filter.attributeName}
          </span>
          <span style={{ fontSize: 'var(--ds-text-xs)', color: 'var(--ds-neutral-500)' }}>{filter.operator}</span>
          {!filter.isActive && <AppBadge variant="neutral" size="sm">inactivo</AppBadge>}
        </div>
        {filter.value !== null && (
          <div style={{
            fontSize: 'var(--ds-text-xs)', color: 'var(--ds-neutral-400)',
            fontFamily: 'var(--ds-font-mono)', marginTop: '2px',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {filter.value}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        {isConfirmingDelete ? (
          <>
            <AppButton variant="danger" size="sm" onClick={onConfirmDelete} loading={isDeleting}>Confirmar</AppButton>
            <AppButton variant="secondary" size="sm" onClick={onCancelDelete} disabled={isDeleting}>Cancelar</AppButton>
          </>
        ) : (
          <>
            <AppButton variant="secondary" size="sm" onClick={onStartEdit}>Editar</AppButton>
            <AppButton variant="ghost" size="sm" onClick={onRequestDelete} style={{ color: 'var(--ds-danger-main)' }}>
              Eliminar
            </AppButton>
          </>
        )}
      </div>
    </div>
  );
}

function ScopeDetailPanel({ hook }: { hook: ReturnType<typeof useAdministrativeScopes> }) {
  const {
    selectedScope,
    editingScope, scopeForm, savingScope, scopeSaveError,
    startEditScope, cancelEditScope, updateScopeField, saveScope,
    togglingStatus, statusError, toggleScopeStatus,
    editingFilterId, filterForm, savingFilter, filterSaveError,
    startEditFilter, cancelEditFilter, updateFilterField, saveEditFilter,
    addingFilter, addFilterForm, savingAddFilter, addFilterError,
    openAddFilter, cancelAddFilter, updateAddFilterField, saveAddFilter,
    confirmDeleteFilterId, deletingFilterId,
    requestDeleteFilter, cancelDeleteFilter, confirmDeleteFilter,
  } = hook;

  if (!selectedScope) {
    return (
      <AppCard>
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--ds-neutral-400)', fontSize: 'var(--ds-text-sm)' }}>
          Selecciona un ámbito de la lista para ver su información y sus filtros.
        </div>
      </AppCard>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* ── Información general ─────────────────────────────────────────── */}
      <AppCard title="Información general">
        {editingScope && scopeForm ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <span style={{ fontSize: 'var(--ds-text-xs)', color: 'var(--ds-neutral-500)', display: 'block', marginBottom: '4px' }}>
                ScopeKey (no editable)
              </span>
              <input
                value={selectedScope.scopeKey} disabled readOnly
                style={{
                  width: '100%', padding: '6px 8px', border: '1px solid var(--ds-neutral-200)', borderRadius: '4px',
                  fontSize: 'var(--ds-text-sm)', fontFamily: 'var(--ds-font-mono)',
                  background: 'var(--ds-neutral-50)', color: 'var(--ds-neutral-500)',
                }}
              />
            </div>
            <ScopeFieldsForm
              form={scopeForm}
              onChange={(key, value) => updateScopeField(key, value as UpdateScopeForm[typeof key])}
            />
            {scopeSaveError && <ErrorBanner message={scopeSaveError} />}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <AppButton variant="secondary" size="sm" onClick={cancelEditScope} disabled={savingScope}>Cancelar</AppButton>
              <AppButton variant="primary" size="sm" onClick={saveScope} loading={savingScope}>Guardar</AppButton>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 'var(--ds-text-base)', color: 'var(--ds-neutral-900)' }}>
                    {selectedScope.name}
                  </span>
                  <AppBadge variant="neutral" size="sm">{selectedScope.scopeKey}</AppBadge>
                  {selectedScope.category && <AppBadge variant="neutral" size="sm">{selectedScope.category}</AppBadge>}
                  <AppBadge variant={selectedScope.isActive ? 'success' : 'neutral'} size="sm">
                    {selectedScope.isActive ? 'activo' : 'inactivo'}
                  </AppBadge>
                </div>
                {selectedScope.description && (
                  <div style={{ fontSize: 'var(--ds-text-sm)', color: 'var(--ds-neutral-500)', marginTop: '2px' }}>
                    {selectedScope.description}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <AppButton variant="secondary" size="sm" onClick={startEditScope}>Editar</AppButton>
                <AppButton
                  variant={selectedScope.isActive ? 'danger' : 'primary'} size="sm"
                  onClick={toggleScopeStatus} loading={togglingStatus}
                >
                  {selectedScope.isActive ? 'Inactivar' : 'Activar'}
                </AppButton>
              </div>
            </div>

            {statusError && <ErrorBanner message={statusError} />}

            <div style={{
              display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px',
              fontSize: 'var(--ds-text-sm)', color: 'var(--ds-neutral-600)',
            }}>
              <span style={{ color: 'var(--ds-neutral-400)' }}>Base DN</span>
              <span style={{ fontFamily: 'var(--ds-font-mono)', wordBreak: 'break-all' }}>{selectedScope.baseDn}</span>
              <span style={{ color: 'var(--ds-neutral-400)' }}>Connection Profile</span>
              <span style={{ fontFamily: 'var(--ds-font-mono)' }}>{selectedScope.connectionProfile}</span>
              <span style={{ color: 'var(--ds-neutral-400)' }}>Prioridad</span>
              <span>{selectedScope.priority}</span>
            </div>
          </div>
        )}
      </AppCard>

      {/* ── Filtros ──────────────────────────────────────────────────────── */}
      <AppCard title={`Filtros (${selectedScope.filters.length})`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {selectedScope.filters.length === 0 && !addingFilter && (
            <div style={{
              padding: '14px', textAlign: 'center', color: 'var(--ds-neutral-400)',
              fontSize: 'var(--ds-text-sm)', border: '1px dashed var(--ds-neutral-200)',
              borderRadius: 'var(--ds-radius-lg)',
            }}>
              Sin filtros — el ámbito se identifica solo por su Base DN, lo cual es válido y suficiente.
            </div>
          )}

          {selectedScope.filters.map(filter => (
            <FilterRow
              key={filter.id}
              filter={filter}
              isEditing={editingFilterId === filter.id}
              editForm={filterForm}
              saving={savingFilter}
              saveError={editingFilterId === filter.id ? filterSaveError : null}
              isConfirmingDelete={confirmDeleteFilterId === filter.id}
              isDeleting={deletingFilterId === filter.id}
              onStartEdit={() => startEditFilter(filter)}
              onCancelEdit={cancelEditFilter}
              onFieldChange={updateFilterField}
              onSave={saveEditFilter}
              onRequestDelete={() => requestDeleteFilter(filter.id)}
              onCancelDelete={cancelDeleteFilter}
              onConfirmDelete={confirmDeleteFilter}
            />
          ))}

          {addingFilter && (
            <div style={{
              padding: '14px', border: '2px solid var(--ds-success-border)',
              borderRadius: 'var(--ds-radius-lg)', background: 'var(--ds-success-light)',
            }}>
              <div style={{ fontWeight: 600, fontSize: 'var(--ds-text-sm)', color: 'var(--ds-success-dark)', marginBottom: '10px' }}>
                Nuevo filtro para {selectedScope.name}
              </div>
              <FilterFieldsForm form={addFilterForm} onChange={updateAddFilterField} />
              {addFilterError && <div style={{ marginTop: '10px' }}><ErrorBanner message={addFilterError} /></div>}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <AppButton variant="secondary" size="sm" onClick={cancelAddFilter} disabled={savingAddFilter}>Cancelar</AppButton>
                <AppButton variant="primary" size="sm" onClick={saveAddFilter} loading={savingAddFilter}>Guardar</AppButton>
              </div>
            </div>
          )}
        </div>

        {!addingFilter && editingFilterId === null && (
          <div style={{ marginTop: '10px' }}>
            <AppButton variant="secondary" size="sm" onClick={openAddFilter}>+ Agregar filtro</AppButton>
          </div>
        )}
      </AppCard>
    </div>
  );
}

export function AdministrativeScopesPage() {
  const { user } = useAuth();
  const isSystemAdmin = user?.roles.includes('SystemAdmin') ?? false;

  const hook = useAdministrativeScopes();
  const { scopes, loading, loadError, selectScope } = hook;
  const { isCreateModalOpen, createForm, creating, createError, openCreateModal, closeCreateModal, updateCreateField, saveCreate } = hook;

  // Defense in depth — el Sidebar ya oculta el enlace para no-SystemAdmin,
  // pero no hay guard de ruta en App.tsx, así que se re-verifica acá. Los
  // Scopes exponen estructura interna de AD (Base DN, OUs, atributos,
  // ConnectionProfile) — no deben ser visibles para ningún otro rol.
  if (!isSystemAdmin) {
    return (
      <AppCard>
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--ds-danger-dark)' }}>
          Acceso denegado. Esta sección es exclusiva del rol SystemAdmin.
        </div>
      </AppCard>
    );
  }

  const columns: Column<AdministrativeScope>[] = [
    {
      key: 'name', header: 'Nombre',
      render: s => (
        <div>
          <div style={{ fontWeight: 600 }}>{s.name}</div>
          <div style={{ fontSize: 'var(--ds-text-xs)', color: 'var(--ds-neutral-400)', fontFamily: 'var(--ds-font-mono)' }}>
            {s.scopeKey}
          </div>
        </div>
      ),
    },
    { key: 'category', header: 'Categoría', render: s => s.category ?? '—' },
    {
      key: 'baseDn', header: 'Base DN',
      render: s => (
        <span style={{
          fontFamily: 'var(--ds-font-mono)', fontSize: 'var(--ds-text-xs)',
          display: 'block', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {s.baseDn}
        </span>
      ),
    },
    { key: 'priority', header: 'Prioridad', align: 'center' },
    {
      key: 'isActive', header: 'Estado', align: 'center',
      render: s => <AppBadge variant={s.isActive ? 'success' : 'neutral'} size="sm">{s.isActive ? 'activo' : 'inactivo'}</AppBadge>,
    },
  ];

  return (
    <div>
      <AppPageHeader
        title="Ámbitos Administrativos"
        description="Define las poblaciones de usuarios de Active Directory (Scopes) que en un incremento futuro gobernarán qué puede administrar cada rol. Todavía sin efecto sobre ninguna operación real."
        action={<AppButton variant="primary" onClick={openCreateModal}>+ Nuevo Ámbito</AppButton>}
      />

      {loadError && <ErrorBanner message={loadError} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: '16px', alignItems: 'start' }}>
        <AppCard>
          <AppTable<AdministrativeScope>
            columns={columns}
            data={scopes}
            loading={loading}
            emptyMessage="Sin ámbitos creados todavía."
            keyExtractor={s => s.scopeKey}
            onRowClick={s => selectScope(s.scopeKey)}
          />
        </AppCard>

        <ScopeDetailPanel hook={hook} />
      </div>

      <AppModal
        open={isCreateModalOpen}
        onClose={closeCreateModal}
        title="Nuevo Ámbito Administrativo"
        loading={creating}
        footer={
          <>
            <AppButton variant="secondary" onClick={closeCreateModal} disabled={creating}>Cancelar</AppButton>
            <AppButton variant="primary" onClick={saveCreate} loading={creating}>Crear como borrador</AppButton>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <AppInput
            label="ScopeKey *" placeholder="ej. empleados-usfq"
            value={createForm.scopeKey}
            onChange={e => updateCreateField('scopeKey', e.target.value)}
          />
          <span style={{ fontSize: 'var(--ds-text-xs)', color: 'var(--ds-neutral-400)', marginTop: '-6px' }}>
            No se puede cambiar después de crear el ámbito.
          </span>
          <ScopeFieldsForm
            form={createForm}
            onChange={(key, value) => updateCreateField(key, value as CreateScopeForm[typeof key])}
          />
          <span style={{ fontSize: 'var(--ds-text-xs)', color: 'var(--ds-neutral-400)' }}>
            El ámbito se crea siempre inactivo (borrador). Actívalo después desde su ficha, una vez confirmado el Base DN.
          </span>
          {createError && <ErrorBanner message={createError} />}
        </div>
      </AppModal>
    </div>
  );
}
