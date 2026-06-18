import { useId, type InputHTMLAttributes } from 'react';

export interface AppInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
}

export function AppInput({
  label,
  error,
  hint,
  wrapperClassName,
  className,
  id,
  ...inputProps
}: AppInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  const wrapperClass = [
    'ds-input',
    error ? 'ds-input--error' : '',
    wrapperClassName ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapperClass}>
      {label && (
        <label htmlFor={inputId} className="ds-input__label">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={['ds-input__field', className ?? ''].filter(Boolean).join(' ')}
        {...inputProps}
      />
      {error && <span className="ds-input__error">{error}</span>}
      {!error && hint && <span className="ds-input__hint">{hint}</span>}
    </div>
  );
}
