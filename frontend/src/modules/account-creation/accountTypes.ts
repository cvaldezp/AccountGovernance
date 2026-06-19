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
  typeKey:        AccountTypeKey,
  form:           AccountFormData,
  subTypePrefix?: string,
): string {
  if (typeKey === 'SERVICE') {
    return `svc_${normalizeToAscii(form.serviceName || 'servicio')}`;
  }
  const first = normalizeToAscii(form.firstName || '');
  const last  = normalizeToAscii(form.lastName1  || '');
  const base  = first.length > 0 ? `${first[0]}${last}` : last;
  return subTypePrefix ? `${subTypePrefix}.${base}` : base;
}

export function computeDisplayName(typeKey: AccountTypeKey, form: AccountFormData): string {
  if (typeKey === 'SERVICE') return `SVC - ${form.serviceName || 'Servicio'}`;
  return [form.firstName, form.lastName1, form.lastName2]
    .map(p => p?.trim())
    .filter(Boolean)
    .join(' ');
}

export function computeDescription(
  typeKey:       AccountTypeKey,
  form:          AccountFormData,
  subTypeLabel?: string,
): string {
  switch (typeKey) {
    case 'GENERIC':    return `Cuenta genérica — ${form.department || 'Sin departamento'}`;
    case 'PARTNER':    return `Cuenta partner — ${form.company || 'Sin empresa'}`;
    case 'SERVICE':    return form.description || `Cuenta de servicio — ${form.serviceName || 'Servicio'}`;
    case 'EXTENSION':  return `Cuenta de extensión — ${form.department || 'Sin departamento'}`;
    case 'PRIVILEGED': {
      const label = subTypeLabel ? ` ${subTypeLabel}` : '';
      return `Cuenta privilegiada${label} — ${form.department || 'Sin departamento'}`;
    }
    default: return form.description || '';
  }
}

export function computePreview(
  typeKey:      AccountTypeKey,
  form:         AccountFormData,
  typeInfo:     { extensionAttribute14: string },
  subTypeInfo?: AccountSubTypeInfo,
): AccountPreviewData {
  const sam  = computeSamAccountName(typeKey, form, subTypeInfo?.samPrefix);
  const ea14 = typeKey === 'PRIVILEGED' && subTypeInfo
    ? subTypeInfo.extensionAttribute14
    : typeInfo.extensionAttribute14;

  return {
    userPrincipalName:    sam ? `${sam}@${AD_DOMAIN}` : '',
    sAMAccountName:       sam,
    displayName:          computeDisplayName(typeKey, form),
    description:          computeDescription(typeKey, form, subTypeInfo?.label),
    extensionAttribute14: ea14,
  };
}
