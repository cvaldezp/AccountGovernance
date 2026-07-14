import { type ReactNode, useEffect, useState } from 'react';
import { MsalProvider, useMsal, useIsAuthenticated } from '@azure/msal-react';
import { InteractionStatus, type AccountInfo } from '@azure/msal-browser';
import { AuthContext } from './AuthContext';
import { msalInstance } from './msalInstance';
import { apiScopes } from './msalConfig';
import { fetchMe, type MeDto } from './authApi';
import type { AuthStatus, AuthUser, RoleName } from '../types';

// Role priority is resolved server-side (ISystemAuthorizationService.ResolvePrimaryRoleAsync) —
// the frontend only validates that the value it received is a known RoleName.
const VALID_ROLES = new Set<string>(['Seguridades', 'RRHH', 'Registro', 'DragonHelp', 'SystemAdmin']);

function toRoleNames(raw: string[]): RoleName[] {
  return raw.filter(r => VALID_ROLES.has(r)) as RoleName[];
}

function toRoleName(raw: string | null): RoleName | null {
  return raw !== null && VALID_ROLES.has(raw) ? (raw as RoleName) : null;
}

// Inner component — can use MSAL hooks because it lives inside MsalProvider.
function AuthBridge({ children }: { children: ReactNode }) {
  const { instance, inProgress, accounts } = useMsal();
  const isAuthenticated  = useIsAuthenticated();
  const isMsalBusy       = inProgress !== InteractionStatus.None;

  const account: AccountInfo | null = instance.getActiveAccount() ?? accounts[0] ?? null;

  console.log('[MSAL] AuthBridge render — all accounts count =', accounts.length, ', active account =', account?.username ?? null);

  const [meData,     setMeData]     = useState<MeDto | null>(null);
  const [meFetched,  setMeFetched]  = useState(false);
  const [meError,    setMeError]    = useState<string | null>(null);
  const [meLoadedAt, setMeLoadedAt] = useState<string | null>(null);

  // Fetch /api/auth/me whenever the active account changes.
  useEffect(() => {
    if (!account) {
      setMeData(null);
      setMeFetched(false);
      setMeError(null);
      setMeLoadedAt(null);
      return;
    }

    let cancelled = false;
    setMeFetched(false);
    setMeError(null);

    console.log('[MSAL] fetchMe start, account =', account.username);
    console.log('[AUTH] Usuario autenticado:', account.username);
    fetchMe().then(result => {
      if (cancelled) return;
      if (!result) {
        // Technical failure (network/API/timeout) — distinct from "authenticated but no roles".
        setMeError(
          'No se pudo obtener el perfil del servidor. ' +
          'Verifica la configuración de la API o contacta a Sistemas.',
        );
      } else {
        console.log('[AUTH] Roles recibidos:', result.roles);
        console.log(
          result.isAuthorized ? '[AUTH] Usuario autorizado:' : '[AUTH] Usuario sin autorización:',
          account.username,
        );
      }
      setMeData(result);
      setMeFetched(true);
      setMeLoadedAt(new Date().toISOString());
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.localAccountId]);

  // Show loading while MSAL interaction is in progress, or while /me is pending.
  const isLoading = isMsalBusy || (!!account && !meFetched);

  const isAuthorized = meData?.isAuthorized ?? false;

  const status: AuthStatus = isLoading
    ? 'authenticating'
    : (isAuthorized ? 'authorized' : 'unauthorized');

  const user: AuthUser | null = (account && meData && isAuthorized)
    ? (() => {
        const role = toRoleName(meData.primaryRole);
        if (!role) {
          // Backend contract violation: isAuthorized=true implies a valid PrimaryRole.
          console.error('[AUTH] isAuthorized=true pero primaryRole es inválido:', meData.primaryRole);
          return null;
        }
        return {
          id:              account.localAccountId,
          name:            meData.displayName ?? account.name ?? account.username,
          email:           meData.email       ?? meData.upn   ?? account.username,
          role,
          roles:           toRoleNames(meData.roles),
          upn:             meData.upn,
          objectId:        meData.objectId,
          primaryRole:     role,
          permissions:     meData.permissions,
          isAuthorized:    meData.isAuthorized,
          profileLoadedAt: meLoadedAt ?? new Date().toISOString(),
        };
      })()
    : null;

  async function login() {
    await instance.loginRedirect({ scopes: apiScopes });
  }

  function logout() {
    void instance.logoutRedirect({ account: account ?? undefined });
  }

  return (
    <AuthContext.Provider
      value={{ status, user, isAuthenticated, isLoading, meError, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function MsalAuthProvider({ children }: { children: ReactNode }) {
  return (
    <MsalProvider instance={msalInstance}>
      <AuthBridge>
        {children}
      </AuthBridge>
    </MsalProvider>
  );
}
