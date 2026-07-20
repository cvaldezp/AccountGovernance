import type { AccountNameValidation, AccountNamingPolicy } from './types';

// Límite duro de sAMAccountName en Active Directory (pre-Windows 2000 logon
// name) — no configurable, mismo valor que AccountNamingPolicyService en el
// backend (AdSamAccountNameHardLimit).
const AD_SAM_ACCOUNT_NAME_HARD_LIMIT = 20;

// Sin regex en ningún punto — mismo criterio que el backend (ver diseño
// acordado del Incremento 2.1): comparación de membresía a un conjunto y
// recorrido simple del string, para que ambos lados se mantengan en paridad
// sin depender de que dos motores de regex interpreten lo mismo igual.
function isAlphanumeric(c: string): boolean {
  return (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9');
}

function buildCharsMessage(policy: AccountNamingPolicy): string {
  const specials = Array.from(policy.allowedChars).filter(c => !isAlphanumeric(c));
  return specials.length > 0
    ? `Solo se permiten letras minúsculas, números, y estos caracteres: ${specials.join(' ')}`
    : 'Solo se permiten letras minúsculas y números.';
}

/**
 * Única normalización permitida: trim + minúsculas culturalmente estables.
 * `.toLowerCase()` (sin `.toLocaleLowerCase()`) usa el algoritmo Unicode fijo,
 * no sensible a la configuración regional del navegador — equivalente a
 * `ToLowerInvariant()` en el backend. Nunca elimina, translitera ni sustituye
 * ningún carácter: si el resultado no es válido, se rechaza tal cual, nunca
 * se "arregla" en silencio.
 *
 * `samPrefix` es el prefijo del tipo/subtipo seleccionado (ej. 'sys', 'cyber')
 * — se usa únicamente para el chequeo de longitud efectiva de sAMAccountName,
 * igual que en el backend.
 */
export function normalizeAndValidateAccountName(
  raw: string,
  policy: AccountNamingPolicy | null,
  samPrefix: string | undefined,
): AccountNameValidation {
  const normalized = raw.trim().toLowerCase();

  if (normalized.length === 0) {
    return { isValid: false, normalizedValue: normalized, errorMessage: null };
  }

  if (!policy) {
    // Política aún no cargada — no se puede afirmar validez todavía.
    return { isValid: false, normalizedValue: normalized, errorMessage: null };
  }

  if (normalized.length < policy.minLength || normalized.length > policy.maxLength) {
    return {
      isValid: false, normalizedValue: normalized,
      errorMessage: `La cuenta debe tener entre ${policy.minLength} y ${policy.maxLength} caracteres.`,
    };
  }

  const allowedSet = new Set(Array.from(policy.allowedChars));
  for (const c of normalized) {
    if (!allowedSet.has(c)) {
      return { isValid: false, normalizedValue: normalized, errorMessage: buildCharsMessage(policy) };
    }
  }

  if (policy.disallowLeadingTrailingSpecialChars &&
      (!isAlphanumeric(normalized[0]) || !isAlphanumeric(normalized[normalized.length - 1]))) {
    return {
      isValid: false, normalizedValue: normalized,
      errorMessage: 'La cuenta no puede comenzar ni terminar con un carácter especial.',
    };
  }

  if (policy.disallowConsecutiveSpecialChars) {
    for (let i = 0; i < normalized.length - 1; i++) {
      if (!isAlphanumeric(normalized[i]) && !isAlphanumeric(normalized[i + 1])) {
        return {
          isValid: false, normalizedValue: normalized,
          errorMessage: 'La cuenta no puede contener caracteres especiales consecutivos.',
        };
      }
    }
  }

  const effectiveLength = (samPrefix?.length ?? 0) + normalized.length;
  if (effectiveLength > AD_SAM_ACCOUNT_NAME_HARD_LIMIT) {
    const message = samPrefix
      ? `Con el prefijo '${samPrefix}' de este tipo de cuenta, el nombre no puede superar los ` +
        `${AD_SAM_ACCOUNT_NAME_HARD_LIMIT - samPrefix.length} caracteres.`
      : `El nombre de cuenta no puede superar los ${AD_SAM_ACCOUNT_NAME_HARD_LIMIT} caracteres ` +
        '(límite de Active Directory).';
    return { isValid: false, normalizedValue: normalized, errorMessage: message };
  }

  return { isValid: true, normalizedValue: normalized, errorMessage: null };
}

/** Máximo efectivo de longitud de "Cuenta" para el tipo/subtipo seleccionado —
 * el menor entre MaxLength de la política y lo que deja disponible el límite
 * de 20 caracteres de AD una vez restado el prefijo. Usado para mostrarlo en
 * el hint del formulario (punto 5 del diseño acordado). */
export function effectiveMaxLength(policy: AccountNamingPolicy | null, samPrefix: string | undefined): number | null {
  if (!policy) return null;
  const adCeiling = AD_SAM_ACCOUNT_NAME_HARD_LIMIT - (samPrefix?.length ?? 0);
  return Math.min(policy.maxLength, adCeiling);
}

/** Texto de ayuda mostrado bajo el campo "Cuenta", construido enteramente a
 * partir de la política (nunca hardcodeado) — mismo criterio de mensaje que
 * el backend, para que el rechazo del servidor y el hint del cliente digan
 * lo mismo. */
export function buildPolicyHint(policy: AccountNamingPolicy | null, samPrefix: string | undefined): string {
  if (!policy) return 'Cargando la política de nombres de cuenta…';

  const max = effectiveMaxLength(policy, samPrefix) ?? policy.maxLength;
  const specials = Array.from(policy.allowedChars).filter(c => !isAlphanumeric(c));
  const charsText = specials.length > 0
    ? `letras minúsculas, números, y: ${specials.join(' ')}`
    : 'letras minúsculas y números';

  const parts = [
    `Solo se permite: ${charsText}.`,
    `Entre ${policy.minLength} y ${max} caracteres.`,
  ];
  if (policy.disallowLeadingTrailingSpecialChars) parts.push('No puede empezar ni terminar con carácter especial.');
  if (policy.disallowConsecutiveSpecialChars) parts.push('Sin caracteres especiales consecutivos.');

  return parts.join(' ');
}
