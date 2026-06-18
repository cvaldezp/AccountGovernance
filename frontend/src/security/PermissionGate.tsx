import type { ReactNode } from 'react';
import { useAuth } from '../auth/useAuth';
import type { FieldName, PermissionAction } from '../types';
import { canAccess } from '../skills/PermissionValidationSkill';

interface PermissionGateProps {
  field: FieldName;
  action?: PermissionAction;
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGate({ field, action = 'read', fallback = null, children }: PermissionGateProps) {
  const { user } = useAuth();
  if (!user || !canAccess(user.role, field, action)) return <>{fallback}</>;
  return <>{children}</>;
}
