import type { FieldConfig, RoleName } from '../types';
import { buildFieldConfigForRoles } from './adFieldMatrix';

/**
 * Returns the complete field matrix for the given role, resolved from:
 *   AD_FIELD_DEFINITIONS       (what each field is)
 *   ROLE_AD_FIELD_PERMISSIONS  (what this role can do with each field)
 *
 * Includes ALL active fields — even canView=false — so the UI has the full picture.
 * Use getViewableFields() from PermissionValidationSkill to filter for display.
 *
 * TODO (real API): Replace with:
 *   GET /api/account-governance/permissions/my-fields
 *   Authorization: Bearer <token>
 *   (role param can be removed once the backend derives it from the JWT)
 */
export async function fetchMyFields(role: RoleName): Promise<FieldConfig[]> {
  await simulateLatency();
  return buildFieldConfigForRoles(role);
}

function simulateLatency() {
  return new Promise(r => setTimeout(r, 150));
}
