import type { RouteKey } from '../types';

/**
 * Fuente única de qué roles pueden ver cada pantalla del portal. La consumen
 * el Sidebar (qué se muestra en el menú) y RouterView en App.tsx (guard de
 * ruta — defensa en profundidad). El backend sigue siendo la barrera real:
 * cada endpoint de configuración devuelve 403 a quien no es SystemAdmin.
 *
 * `'*'` = cualquier rol autenticado. SystemAdmin entra siempre a todo, sin
 * importar la lista — mismo bypass que el resto del portal.
 */
export type RouteRoles = readonly string[] | '*';

export const ROUTE_ACCESS: Record<RouteKey, RouteRoles> = {
  'dashboard':             '*',
  'search':                '*',
  'user-detail':           '*',
  'account-creation':      '*',
  'audit':                 '*',
  // Mismos roles de lectura que exige el backend (DistributionListsController.ReadRoles).
  'distribution-lists':    ['Seguridades', 'DragonHelp', 'Registro'],
  // Configuración — exclusiva de SystemAdmin (lista vacía = solo el bypass).
  'attribute-catalog':     [],
  'permissions-matrix':    [],
  'account-type-config':   [],
  'initial-groups':        [],
  'system-roles-config':   [],
  'administrative-scopes': [],
};

export function canAccessRoute(route: RouteKey, userRoles: readonly string[] | undefined): boolean {
  const roles = userRoles ?? [];
  if (roles.includes('SystemAdmin')) return true;
  const allowed = ROUTE_ACCESS[route];
  if (allowed === '*') return roles.length > 0;
  return roles.some(r => allowed.includes(r));
}
