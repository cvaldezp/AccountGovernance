// RoleScopeAssignment (Incremento 3) — asigna Ámbitos Administrativos a roles
// del sistema. Sin enforcement todavía: estas asignaciones no restringen
// ninguna operación real. Fuente de datos única (este módulo), consumida
// desde dos superficies: administración primaria en "Roles y Grupos",
// referencia cruzada de solo lectura en "Ámbitos Administrativos".

export interface RoleScopeAssignment {
  id:        number;
  roleKey:   string;
  scopeKey:  string;
  isActive:  boolean;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

export interface CreateAssignmentForm {
  roleKey:  string;
  scopeKey: string;
}
