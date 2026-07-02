import { useAuth } from './useAuth';
import { AppButton } from '../shared/ui';

export function LoginPage() {
  const { login, isLoading } = useAuth();

  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      minHeight:      '100vh',
      background:     'var(--ds-neutral-50)',
      gap:            '28px',
    }}>
      {/* Logo / título */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize:     '36px',
          fontWeight:   800,
          color:        'var(--ds-brand-600)',
          letterSpacing:'-0.02em',
          marginBottom: '6px',
        }}>
          AccountGov
        </div>
        <div style={{ fontSize: 'var(--ds-text-sm)', color: 'var(--ds-neutral-500)' }}>
          Portal de administración de Active Directory — USFQ
        </div>
      </div>

      {/* Tarjeta de login */}
      <div style={{
        background:   'white',
        borderRadius: 'var(--ds-radius-xl)',
        padding:      '36px 44px',
        border:       '1px solid var(--ds-neutral-200)',
        boxShadow:    '0 4px 32px rgba(0,0,0,0.06)',
        textAlign:    'center',
        minWidth:     '340px',
        display:      'flex',
        flexDirection:'column',
        gap:          '20px',
      }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 'var(--ds-text-base)', color: 'var(--ds-neutral-800)', marginBottom: '6px' }}>
            Iniciar sesión
          </div>
          <div style={{ fontSize: 'var(--ds-text-sm)', color: 'var(--ds-neutral-500)' }}>
            Usa tu cuenta institucional de Microsoft
          </div>
        </div>

        <AppButton
          variant="primary"
          size="md"
          onClick={() => { void login(); }}
          loading={isLoading}
          style={{ width: '100%', gap: '10px' }}
        >
          Continuar con Microsoft
        </AppButton>
      </div>

      <div style={{ fontSize: 'var(--ds-text-xs)', color: 'var(--ds-neutral-300)' }}>
        Solo cuentas @usfq.edu.ec autorizadas
      </div>
    </div>
  );
}
