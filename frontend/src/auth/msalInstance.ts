import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig } from './msalConfig';

// Singleton — used both inside React (via MsalProvider) and outside (authFetch).
export const msalInstance = new PublicClientApplication(msalConfig);
