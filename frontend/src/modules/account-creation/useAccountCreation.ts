import { useState, useMemo, useEffect } from 'react';
import type {
  AccountTypeKey, AccountSubTypeKey, AccountTypeInfo, AccountSubTypeInfo,
  AccountFormData, AccountPreviewData, RecoveryEmailValidation,
} from './types';
import { computePreview } from './accountTypes';
import { accountCreationApi } from './accountCreationApi';

const BASE_FORM: AccountFormData = {
  accountName:    '',
  firstName:      '',
  apellidos:      '',
  recoveryEmail:  '',
  password:       '',
  passwordLength: 16,
};

const IDLE_VALIDATION: RecoveryEmailValidation = { status: 'idle', message: '' };

function generateSecurePassword(length: number): string {
  const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower   = 'abcdefghjkmnpqrstuvwxyz';
  const digits  = '23456789';
  const special = '!@#$%&*';
  const all     = upper + lower + digits + special;

  const pick = (charset: string) => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return charset[buf[0] % charset.length];
  };

  const required = [pick(upper), pick(lower), pick(digits), pick(special)];
  const rest      = Array.from({ length: Math.max(0, length - 4) }, () => pick(all));
  const chars     = [...required, ...rest];

  for (let i = chars.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const j = buf[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

export function useAccountCreation() {
  const [accountTypes,    setAccountTypes]    = useState<AccountTypeInfo[]>([]);
  const [typesLoading,    setTypesLoading]    = useState(true);
  const [selectedType,    setSelectedType]    = useState<AccountTypeKey | null>(null);
  const [selectedSubType, setSelectedSubType] = useState<AccountSubTypeKey | null>(null);
  const [form,            setForm]            = useState<AccountFormData>(BASE_FORM);
  const [emailValidation, setEmailValidation] = useState<RecoveryEmailValidation>(IDLE_VALIDATION);

  useEffect(() => {
    accountCreationApi.getAccountTypes()
      .then(types => setAccountTypes(types))
      .finally(() => setTypesLoading(false));
  }, []);

  const typeInfo = useMemo(
    () => accountTypes.find(t => t.key === selectedType) ?? null,
    [accountTypes, selectedType],
  );

  const subTypeInfo = useMemo<AccountSubTypeInfo | undefined>(
    () => typeInfo?.subTypes.find(s => s.key === selectedSubType),
    [typeInfo, selectedSubType],
  );

  const preview = useMemo<AccountPreviewData | null>(() => {
    if (!selectedType || !typeInfo) return null;
    if (selectedType === 'PRIVILEGED' && !subTypeInfo) return null;
    return computePreview(selectedType, form, typeInfo, subTypeInfo);
  }, [selectedType, form, typeInfo, subTypeInfo]);

  function updateField<K extends keyof AccountFormData>(key: K, value: AccountFormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    if (key === 'recoveryEmail') setEmailValidation(IDLE_VALIDATION);
  }

  function selectType(key: AccountTypeKey) {
    const type = accountTypes.find(t => t.key === key);
    setSelectedType(key);
    setSelectedSubType(null);
    setForm({ ...BASE_FORM, passwordLength: type?.defaultPasswordLength ?? 16 });
    setEmailValidation(IDLE_VALIDATION);
  }

  function selectSubType(key: AccountSubTypeKey) {
    setSelectedSubType(key);
    setEmailValidation(IDLE_VALIDATION);
  }

  function resetType() {
    setSelectedType(null);
    setSelectedSubType(null);
    setForm(BASE_FORM);
    setEmailValidation(IDLE_VALIDATION);
  }

  function generatePassword() {
    setForm(prev => ({ ...prev, password: generateSecurePassword(prev.passwordLength) }));
  }

  async function validateRecoveryEmail() {
    const email = form.recoveryEmail.trim();
    if (!email) return;

    setEmailValidation({ status: 'loading', message: 'Consultando AD…' });
    try {
      const result = await accountCreationApi.validateRecoveryEmail(email);
      setEmailValidation({
        status:          result.isValid ? 'valid' : 'invalid',
        message:         result.message,
        userDisplayName: result.userDisplayName,
      });
    } catch {
      setEmailValidation({ status: 'invalid', message: 'Error al conectar con el servicio AD.' });
    }
  }

  return {
    accountTypes,
    typesLoading,
    selectedType,
    selectedSubType,
    typeInfo,
    subTypeInfo,
    form,
    preview,
    emailValidation,
    selectType,
    selectSubType,
    resetType,
    updateField,
    generatePassword,
    validateRecoveryEmail,
  };
}
