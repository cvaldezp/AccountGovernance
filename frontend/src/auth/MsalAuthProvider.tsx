import { type ReactNode, useEffect, useState } from 'react';
import { MsalProvider, useMsal, useIsAuthenticated } from '@azure/msal-react';
import { InteractionStatus, type AccountInfo } from '@azure/msal-browser';
import { AuthContext } from './AuthContext';
import { msalInstance } from './msalInstance';
import { apiScopes } from './msalConfig';
import { fetchMe, type MeDto } from './authApi';
import type { AuthUser, RoleName } from '../types';

const ROLE_PRIORITY: RoleName[] = ['Seguridades', 'RRHH', 'Registro', 'DragonHelp'];

function primaryRole(roles: RoleName[]): RoleName {
  for (const r of ROLE_PRIORITY) {
    if (roles.includes(r)) return r;
  }
  return 'DragonHelp';
}

const VALID_ROLES = new Set<string>(['Seguridades', 'RRHH', 'Registro', 'DragonHelp']);

function toRoleNames(raw: string[]): RoleName[] {
  return raw.filter(r => VALID_ROLES.has(r)) as RoleName[];
}

// Inner component — can use MSAL hooks because it lives inside MsalProvider.
function AuthBridge({ children }: { children: ReactNode }) {
  const { instance, inProgress, accounts } = useMsal();
  const isAuthenticated  = useIsAuthenticated();
  const isMsalBusy       = inProgress !== InteractionStatus.None;

  const account: AccountInfo | null = instance.getActiveAccount() ?? accounts[0] ?? null;

  console.log('[MSAL] AuthBridge render — all accounts count =', accounts.length, ', active account =', account?.username ?? null);

  const [meData,    setMeData]    = useState<MeDto | null>(null);
  const [meFetched, setMeFetched] = useState(false);
  const [meError,   setMeError]   = useState<string | null>(null);

  // Fetch /api/auth/me whenever the active account changes.
  useEffect(() => {
    if (!account) {
      setMeData(null);
      setMeFetched(false);
      setMeError(null);
      return;
    }

    let cancelled = false;
    setMeFetched(false);
    setMeError(null);

    console.log('[MSAL] fetchMe start, account =', account.username);
    fetchMe(instance, account).then(result => {
      if (cancelled) return;
      if (!result) {
        setMeError(
          'No se pudo obtener el perfil del servidor. ' +
          'Verifica la configuración de la API o contacta a Sistemas.',
        );
      }
      setMeData(result);
      setMeFetched(true);
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.localAccountId]);

  // Show loading while MSAL interaction is in progress, or while /me is pending.
  const isLoading = isMsalBusy || (!!account && !meFetched);

  const user: AuthUser | null = (account && meData)
    ? (() => {
        const roles = toRoleNames(meData.roles);
        return {
          id:    account.localAccountId,
          name:  meData.displayName ?? account.name ?? account.username,
          email: meData.email       ?? meData.upn   ?? account.username,
          role:  primaryRole(roles),
          roles,
        };
      })()
    : null;

  async function login() {
    await instance.loginRedirect({ scopes: apiScopes });
  }

  function logout() {
    void instance.logoutRedirect({ account: account ?? undefined });
  }

  async function getAccessToken(): Promise<string | null> {
    if (!account) return null;
    try {
      const result = await instance.acquireTokenSilent({ scopes: apiScopes, account });
      return result.accessToken;
    } catch {
      // Consistent with the redirect-based login flow — this navigates away
      // and the token becomes available after handleRedirectPromise resolves.
      await instance.acquireTokenRedirect({ scopes: apiScopes });
      return null;
    }
  }

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated, isLoading, meError, login, logout, getAccessToken }}
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
