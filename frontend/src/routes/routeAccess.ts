import type { RouteKey } from '../types';
import { useAuth } from '../auth/useAuth';

/**
 * Qué módulo (gov.AppResources) exige cada pantalla. Los permisos reales del
 * usuario vienen de /api/auth/me (`permissions`), resueltos por el backend a
 * partir de "Accesos por Rol" — el frontend no decide nada por rol: SystemAdmin
 * ya recibe todos los recursos activos desde el backend.
 *
 * Lo consumen el Sidebar (qué se muestra) y RouterView en App.tsx (guard de
 * ruta — defensa en profundidad). El backend sigue siendo la barrera real.
 */
export const ROUTE_RESOURCE: Record<RouteKey, string> = {
  'dashboard':             'dashboard',
  'search':                'users',
  'user-detail':           'users',
  'account-creation':      'account-creation',
  'audit':                 'audit',
  'distribution-lists':    'distribution-lists',
  'attribute-catalog':     'config.attribute-catalog',
  'permissions-matrix':    'config.permissions-matrix',
  'account-type-config':   'config.account-types',
  'initial-groups':        'config.initial-groups',
  'system-roles-config':   'config.system-roles',
  'administrative-scopes': 'config.administrative-scopes',
};

export function canAccessResource(resourceKey: string, permissions: readonly string[] | undefined): boolean {
  return (permissions ?? []).includes(resourceKey);
}

export function canAccessRoute(route: RouteKey, permissions: readonly string[] | undefined): boolean {
  return canAccessResource(ROUTE_RESOURCE[route], permissions);
}

/** ¿El usuario actual tiene este módulo/acción? Para ocultar botones de acciones. */
export function useCan(resourceKey: string): boolean {
  const { user } = useAuth();
  return canAccessResource(resourceKey, user?.permissions);
}
