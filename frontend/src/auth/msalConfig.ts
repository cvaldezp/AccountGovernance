import { type Configuration, LogLevel } from '@azure/msal-browser';

const clientId  = import.meta.env.VITE_AZURE_CLIENT_ID  as string;
const tenantId  = import.meta.env.VITE_AZURE_TENANT_ID  as string;
const apiScope  = import.meta.env.VITE_AZURE_API_SCOPE  as string;

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority:   `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
  system: {
    loggerOptions: {
      loggerCallback(level, message, containsPii) {
        if (containsPii) return;
        if (level === LogLevel.Error) console.error('[MSAL]', message);
      },
    },
  },
};

// Scopes requested when signing in and acquiring tokens for the backend API.
// Falls back to openid/profile if VITE_AZURE_API_SCOPE is not configured.
export const apiScopes: string[] = apiScope
  ? [apiScope]
  : ['openid', 'profile'];
