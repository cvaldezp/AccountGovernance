import type { AccountTypeKey, AccountTypeInfo, AccountSubTypeInfo, AccountFormData, AccountPreviewData } from './types';
import { normalizeAndValidateAccountName } from '../../shared/account-naming/normalizeAndValidateAccountName';
import type { AccountNamingPolicy } from '../../shared/account-naming/types';

export const AD_DOMAIN = 'usfq.edu.ec';

export function computeSamAccountName(
  form:           AccountFormData,
  policy:         AccountNamingPolicy | null,
  subTypePrefix?: string,
): { sam: string; isValid: boolean; errorMessage: string | null } {
  const validation = normalizeAndValidateAccountName(form.accountName || '', policy, subTypePrefix);
  const sam = subTypePrefix ? `${subTypePrefix}${validation.normalizedValue}` : validation.normalizedValue;
  return { sam, isValid: validation.isValid, errorMessage: validation.errorMessage };
}

export function computeDisplayName(form: AccountFormData): string {
  return [form.firstName, form.apellidos]
    .map(p => p?.trim())
    .filter(Boolean)
    .join(' ');
}

export function computePreview(
  typeKey:      AccountTypeKey,
  form:         AccountFormData,
  typeInfo:     AccountTypeInfo,
  policy:       AccountNamingPolicy | null,
  subTypeInfo?: AccountSubTypeInfo,
): AccountPreviewData {
  const { sam, isValid, errorMessage } = computeSamAccountName(form, policy, subTypeInfo?.samPrefix);

  return {
    userPrincipalName:    sam ? `${sam}@${AD_DOMAIN}` : '',
    sAMAccountName:       sam,
    displayName:          computeDisplayName(form),
    company:              typeInfo.defaultCompany ?? 'USFQ',
    description:          form.description.trim()
                            ? `${typeInfo.descriptionTemplate} - ${form.description.trim()}`
                            : typeInfo.descriptionTemplate,
    extensionAttribute14: typeInfo.extensionAttribute14,
    givenName:            form.firstName || null,
    sn:                   form.apellidos || null,
    recoveryEmail:        form.recoveryEmail || null,
    targetOU:             subTypeInfo?.targetOU ?? null,
    accountTypeKey:       typeKey,
    accountTypeLabel:     typeInfo.label,
    subTypeKey:           subTypeInfo?.key ?? null,
    subTypeLabel:         subTypeInfo?.label ?? null,
    accountNameValid:     isValid,
    accountNameError:     errorMessage,
  };
}
