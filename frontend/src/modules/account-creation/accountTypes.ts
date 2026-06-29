import type { AccountTypeKey, AccountTypeInfo, AccountSubTypeInfo, AccountFormData, AccountPreviewData } from './types';

export const AD_DOMAIN = 'usfq.edu.ec';

function normalizeToAscii(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

export function computeSamAccountName(
  form:           AccountFormData,
  subTypePrefix?: string,
): string {
  const cuenta = normalizeToAscii(form.accountName || '');
  return subTypePrefix ? `${subTypePrefix}${cuenta}` : cuenta;
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
  subTypeInfo?: AccountSubTypeInfo,
): AccountPreviewData {
  const sam = computeSamAccountName(form, subTypeInfo?.samPrefix);

  return {
    userPrincipalName:    sam ? `${sam}@${AD_DOMAIN}` : '',
    sAMAccountName:       sam,
    displayName:          computeDisplayName(form),
    company:              typeInfo.defaultCompany ?? 'USFQ',
    description:          typeKey === 'GENERIC' ? 'Genérica' : typeInfo.descriptionTemplate,
    extensionAttribute14: typeInfo.extensionAttribute14,
    givenName:            form.firstName || null,
    sn:                   form.apellidos || null,
    recoveryEmail:        form.recoveryEmail || null,
    targetOU:             subTypeInfo?.targetOU ?? null,
    accountTypeKey:       typeKey,
    accountTypeLabel:     typeInfo.label,
    subTypeKey:           subTypeInfo?.key ?? null,
    subTypeLabel:         subTypeInfo?.label ?? null,
  };
}
