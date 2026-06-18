// ── AD Attribute Catalog ──────────────────────────────────────────────────────
// Authoritative list of every AD attribute the portal may query or administer.
// This is a design-time reference — not a runtime permission system.
//
// Relationship to adFieldDefinitions.ts:
//   Each portal-managed field (ADFieldDefinition) references one entry here
//   to inherit displayName, description, isSensitive, and requiresAudit.
//   Field definitions add portal-specific concerns: fieldType, sortOrder,
//   allowedValues, isActive, and the app-level adAttributeName alias.

export type ADAttributeCategory =
  | 'identity'       // who the user is
  | 'contact'        // how to reach them
  | 'organizational' // org structure and hierarchy
  | 'account'        // authentication, locks, and password
  | 'extension'      // extensionAttribute slots (open use)
  | 'directory';     // system-managed directory metadata

export type ADAttributeDataType =
  | 'string'   // plain text
  | 'integer'  // whole number
  | 'flags'    // bit-flag integer (e.g. userAccountControl)
  | 'datetime' // timestamp (AD FILETIME or GeneralizedTime)
  | 'dn'       // Distinguished Name or multi-value DN list
  | 'boolean'; // true / false

export interface ADAttributeCatalogEntry {
  key:                 string;             // stable portal key, e.g. 'attr-display-name'
  adAttributeName:     string;             // real LDAP attribute name
  displayName:         string;             // human-readable label (Spanish)
  category:            ADAttributeCategory;
  dataType:            ADAttributeDataType;
  isEditableCandidate: boolean;            // could this be edited through the portal?
  isSensitive:         boolean;            // PII or security-critical data?
  requiresAudit:       boolean;            // must every change be logged?
  description:         string;
}

// ── Catalog entries ───────────────────────────────────────────────────────────

export const AD_ATTRIBUTE_CATALOG: ADAttributeCatalogEntry[] = [

  // ── Identity ──────────────────────────────────────────────────────────────

  {
    key:                 'attr-display-name',
    adAttributeName:     'displayName',
    displayName:         'Nombre Completo',
    category:            'identity',
    dataType:            'string',
    isEditableCandidate: true,
    isSensitive:         false,
    requiresAudit:       true,
    description:         'Nombre visible del usuario en el directorio. Aparece en Exchange, Teams y aplicaciones institucionales. Un cambio incorrecto afecta la identidad visible en todo el ecosistema Microsoft.',
  },
  {
    key:                 'attr-given-name',
    adAttributeName:     'givenName',
    displayName:         'Nombre',
    category:            'identity',
    dataType:            'string',
    isEditableCandidate: true,
    isSensitive:         false,
    requiresAudit:       false,
    description:         'Primer nombre del usuario tal como aparece en el directorio activo.',
  },
  {
    key:                 'attr-sn',
    adAttributeName:     'sn',
    displayName:         'Apellido',
    category:            'identity',
    dataType:            'string',
    isEditableCandidate: true,
    isSensitive:         false,
    requiresAudit:       false,
    description:         'Apellido (surname) del usuario registrado en el directorio activo.',
  },
  {
    key:                 'attr-upn',
    adAttributeName:     'userPrincipalName',
    displayName:         'UPN (Usuario@Dominio)',
    category:            'identity',
    dataType:            'string',
    isEditableCandidate: false,
    isSensitive:         false,
    requiresAudit:       true,
    description:         'User Principal Name: identificador único de inicio de sesión. Cambios afectan la autenticación en todos los servicios vinculados al dominio. Requiere coordinación con el equipo de Infraestructura.',
  },
  {
    key:                 'attr-samaccount',
    adAttributeName:     'sAMAccountName',
    displayName:         'Nombre de Cuenta (SAM)',
    category:            'identity',
    dataType:            'string',
    isEditableCandidate: false,
    isSensitive:         false,
    requiresAudit:       true,
    description:         'Nombre de cuenta NetBIOS heredado (pre-Windows 2000). Crítico para compatibilidad con sistemas legacy y aplicaciones que usan autenticación NTLM. No se recomienda modificar.',
  },
  {
    key:                 'attr-employee-id',
    adAttributeName:     'employeeID',
    displayName:         'ID Empleado',
    category:            'organizational',
    dataType:            'string',
    isEditableCandidate: true,
    isSensitive:         false,
    requiresAudit:       false,
    description:         'Código interno del empleado. Puede usarse para sincronización con sistemas de RRHH como Workday. Debe coincidir con el identificador en el sistema de origen.',
  },

  // ── Organizational ────────────────────────────────────────────────────────

  {
    key:                 'attr-company',
    adAttributeName:     'company',
    displayName:         'Empresa',
    category:            'organizational',
    dataType:            'string',
    isEditableCandidate: true,
    isSensitive:         false,
    requiresAudit:       false,
    description:         'Nombre de la empresa u organización a la que pertenece el usuario en el directorio.',
  },
  {
    key:                 'attr-department',
    adAttributeName:     'department',
    displayName:         'Departamento',
    category:            'organizational',
    dataType:            'string',
    isEditableCandidate: true,
    isSensitive:         false,
    requiresAudit:       false,
    description:         'Departamento o área organizacional al que pertenece el usuario.',
  },
  {
    key:                 'attr-title',
    adAttributeName:     'title',
    displayName:         'Cargo',
    category:            'organizational',
    dataType:            'string',
    isEditableCandidate: true,
    isSensitive:         false,
    requiresAudit:       false,
    description:         'Título o puesto de trabajo del usuario dentro de la organización.',
  },
  {
    key:                 'attr-manager',
    adAttributeName:     'manager',
    displayName:         'Jefe Directo',
    category:            'organizational',
    dataType:            'dn',
    isEditableCandidate: true,
    isSensitive:         false,
    requiresAudit:       false,
    description:         'Distinguished Name del jefe directo o supervisor del usuario. Usado por Exchange y apps de RRHH para reportes jerárquicos.',
  },

  // ── Contact ───────────────────────────────────────────────────────────────

  {
    key:                 'attr-mail',
    adAttributeName:     'mail',
    displayName:         'Correo Institucional',
    category:            'contact',
    dataType:            'string',
    isEditableCandidate: false,
    isSensitive:         false,
    requiresAudit:       true,
    description:         'Dirección de correo electrónico institucional vinculada al buzón Exchange/Microsoft 365. Cambios requieren coordinación con el equipo de Exchange.',
  },
  {
    key:                 'attr-office',
    adAttributeName:     'physicalDeliveryOfficeName',
    displayName:         'Oficina',
    category:            'contact',
    dataType:            'string',
    isEditableCandidate: true,
    isSensitive:         false,
    requiresAudit:       false,
    description:         'Ubicación física de la oficina donde trabaja el usuario dentro de la institución.',
  },
  {
    key:                 'attr-telephone',
    adAttributeName:     'telephoneNumber',
    displayName:         'Teléfono Laboral',
    category:            'contact',
    dataType:            'string',
    isEditableCandidate: true,
    isSensitive:         false,
    requiresAudit:       false,
    description:         'Número de teléfono fijo de trabajo registrado en el directorio institucional.',
  },
  {
    key:                 'attr-mobile',
    adAttributeName:     'mobile',
    displayName:         'Teléfono Móvil',
    category:            'contact',
    dataType:            'string',
    isEditableCandidate: true,
    isSensitive:         true,
    requiresAudit:       false,
    description:         'Número de teléfono móvil del usuario. Considerado dato personal sensible.',
  },
  {
    key:                 'attr-ext-email',
    adAttributeName:     'Custom-External-Email-Address',
    displayName:         'Email Externo',
    category:            'contact',
    dataType:            'string',
    isEditableCandidate: true,
    isSensitive:         true,
    requiresAudit:       true,
    description:         'Correo electrónico personal del usuario. Usado para recuperación de contraseña y notificaciones externas al dominio institucional.',
  },

  // ── Extension attributes ──────────────────────────────────────────────────

  {
    key: 'attr-ext1', adAttributeName: 'extensionAttribute1',
    displayName: 'Atributo Extensión 1', category: 'extension', dataType: 'string',
    isEditableCandidate: true, isSensitive: false, requiresAudit: false,
    description: 'Atributo de extensión de uso genérico. Asignación institucional: pendiente de definir.',
  },
  {
    key: 'attr-ext2', adAttributeName: 'extensionAttribute2',
    displayName: 'Atributo Extensión 2', category: 'extension', dataType: 'string',
    isEditableCandidate: true, isSensitive: false, requiresAudit: false,
    description: 'Atributo de extensión de uso genérico. Asignación institucional: pendiente de definir.',
  },
  {
    key: 'attr-ext3', adAttributeName: 'extensionAttribute3',
    displayName: 'Atributo Extensión 3', category: 'extension', dataType: 'string',
    isEditableCandidate: true, isSensitive: false, requiresAudit: false,
    description: 'Atributo de extensión de uso genérico. Asignación institucional: pendiente de definir.',
  },
  {
    key: 'attr-ext5', adAttributeName: 'extensionAttribute5',
    displayName: 'Atributo Extensión 5', category: 'extension', dataType: 'string',
    isEditableCandidate: true, isSensitive: false, requiresAudit: false,
    description: 'Atributo de extensión de uso genérico. Asignación institucional: pendiente de definir.',
  },
  {
    key: 'attr-ext6', adAttributeName: 'extensionAttribute6',
    displayName: 'Atributo Extensión 6', category: 'extension', dataType: 'string',
    isEditableCandidate: true, isSensitive: false, requiresAudit: false,
    description: 'Atributo de extensión de uso genérico. Asignación institucional: pendiente de definir.',
  },
  {
    key: 'attr-ext12', adAttributeName: 'extensionAttribute12',
    displayName: 'Atributo Extensión 12', category: 'extension', dataType: 'string',
    isEditableCandidate: true, isSensitive: false, requiresAudit: false,
    description: 'Atributo de extensión de uso genérico. Asignación institucional: pendiente de definir.',
  },
  {
    key: 'attr-ext13', adAttributeName: 'extensionAttribute13',
    displayName: 'Atributo Extensión 13', category: 'extension', dataType: 'string',
    isEditableCandidate: true, isSensitive: false, requiresAudit: false,
    description: 'Atributo de extensión de uso genérico. Asignación institucional: pendiente de definir.',
  },
  {
    key: 'attr-ext14', adAttributeName: 'extensionAttribute14',
    displayName: 'Atributo Extensión 14', category: 'extension', dataType: 'string',
    isEditableCandidate: true, isSensitive: false, requiresAudit: false,
    description: 'Atributo de extensión de uso genérico. Asignación institucional: pendiente de definir.',
  },
  {
    key: 'attr-ext15', adAttributeName: 'extensionAttribute15',
    displayName: 'Atributo Extensión 15', category: 'extension', dataType: 'string',
    isEditableCandidate: true, isSensitive: false, requiresAudit: false,
    description: 'Atributo de extensión de uso genérico. Asignación institucional: pendiente de definir.',
  },

  // ── Account ───────────────────────────────────────────────────────────────

  {
    key:                 'attr-uac',
    adAttributeName:     'userAccountControl',
    displayName:         'Control de Cuenta (UAC)',
    category:            'account',
    dataType:            'flags',
    isEditableCandidate: true,
    isSensitive:         true,
    requiresAudit:       true,
    description:         'Entero de flags que controla el estado de la cuenta: habilitada/deshabilitada, bloqueada, requiere cambio de contraseña, etc. Modificar incorrectamente puede bloquear el acceso del usuario a todos los servicios.',
  },
  {
    key:                 'attr-lockout-time',
    adAttributeName:     'lockoutTime',
    displayName:         'Hora de Bloqueo',
    category:            'account',
    dataType:            'datetime',
    isEditableCandidate: false,
    isSensitive:         true,
    requiresAudit:       true,
    description:         'Marca de tiempo de cuándo fue bloqueada la cuenta por intentos de autenticación fallidos. Valor 0 indica que la cuenta no está bloqueada.',
  },
  {
    key:                 'attr-pwd-last-set',
    adAttributeName:     'pwdLastSet',
    displayName:         'Último Cambio de Contraseña',
    category:            'account',
    dataType:            'datetime',
    isEditableCandidate: false,
    isSensitive:         true,
    requiresAudit:       false,
    description:         'Marca de tiempo del último cambio de contraseña. Valor 0 obliga al usuario a cambiar la contraseña en el próximo inicio de sesión.',
  },
  {
    key:                 'attr-last-logon',
    adAttributeName:     'lastLogonTimestamp',
    displayName:         'Último Inicio de Sesión',
    category:            'account',
    dataType:            'datetime',
    isEditableCandidate: false,
    isSensitive:         false,
    requiresAudit:       false,
    description:         'Marca de tiempo del último inicio de sesión. Replicado entre controladores de dominio con latencia. Almacenado como FILETIME de 64 bits.',
  },

  // ── Directory (system-managed) ────────────────────────────────────────────

  {
    key:                 'attr-distinguished-name',
    adAttributeName:     'distinguishedName',
    displayName:         'Distinguished Name (DN)',
    category:            'directory',
    dataType:            'dn',
    isEditableCandidate: false,
    isSensitive:         false,
    requiresAudit:       false,
    description:         'Ruta única del objeto en el árbol LDAP. Generado automáticamente por AD al crear o mover el objeto. No es editable directamente.',
  },
  {
    key:                 'attr-member-of',
    adAttributeName:     'memberOf',
    displayName:         'Miembro de Grupos',
    category:            'directory',
    dataType:            'dn',
    isEditableCandidate: false,
    isSensitive:         false,
    requiresAudit:       true,
    description:         'Lista de DN de los grupos de seguridad y distribución a los que pertenece el usuario. Administrado desde la gestión de grupos, no desde el perfil del usuario.',
  },
  {
    key:                 'attr-when-created',
    adAttributeName:     'whenCreated',
    displayName:         'Fecha de Creación',
    category:            'directory',
    dataType:            'datetime',
    isEditableCandidate: false,
    isSensitive:         false,
    requiresAudit:       false,
    description:         'Fecha y hora en que el objeto fue creado en el directorio. Solo lectura, gestionado por AD.',
  },
  {
    key:                 'attr-when-changed',
    adAttributeName:     'whenChanged',
    displayName:         'Última Modificación en AD',
    category:            'directory',
    dataType:            'datetime',
    isEditableCandidate: false,
    isSensitive:         false,
    requiresAudit:       false,
    description:         'Fecha y hora de la última modificación del objeto en el directorio. Actualizado automáticamente por AD en cada cambio.',
  },
];

// ── Lookup helpers ────────────────────────────────────────────────────────────

/** Look up by real LDAP attribute name. */
export function getAttributeByName(
  adAttributeName: string,
): ADAttributeCatalogEntry | undefined {
  return AD_ATTRIBUTE_CATALOG.find(a => a.adAttributeName === adAttributeName);
}

/** Look up by portal key (e.g. 'attr-ext-email'). */
export function getAttributeByKey(
  key: string,
): ADAttributeCatalogEntry | undefined {
  return AD_ATTRIBUTE_CATALOG.find(a => a.key === key);
}

/** Return all entries for a given category. */
export function getAttributesByCategory(
  category: ADAttributeCategory,
): ADAttributeCatalogEntry[] {
  return AD_ATTRIBUTE_CATALOG.filter(a => a.category === category);
}
