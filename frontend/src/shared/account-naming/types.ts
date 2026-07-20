// Política de nombres de cuenta — única para todo el sistema de creación de
// cuentas (Genéricas, Partner, Servicio, Extensión, Privilegiadas y cualquier
// tipo futuro). El backend es la autoridad definitiva; este módulo replica el
// mismo algoritmo (sin regex, ver normalizeAndValidateAccountName.ts) solo
// para dar feedback en vivo mientras el usuario escribe.

export interface AccountNamingPolicy {
  allowedChars:                        string;
  minLength:                           number;
  maxLength:                           number;
  disallowLeadingTrailingSpecialChars: boolean;
  disallowConsecutiveSpecialChars:     boolean;
  updatedAt:                           string;
  updatedBy:                           string | null;
}

export interface UpdateAccountNamingPolicy {
  allowedChars:                        string;
  minLength:                           number;
  maxLength:                           number;
  disallowLeadingTrailingSpecialChars: boolean;
  disallowConsecutiveSpecialChars:     boolean;
}

export interface AccountNameValidation {
  isValid:         boolean;
  normalizedValue: string;
  errorMessage:    string | null;
}
