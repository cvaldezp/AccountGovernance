import type { AccountTypeKey, AccountSubTypeInfo, AccountFormData, AccountPreviewData } from './types';

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
  typeInfo:     { extensionAttribute14: string; defaultCompany?: string | null; descriptionTemplate: string },
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
  };
}
