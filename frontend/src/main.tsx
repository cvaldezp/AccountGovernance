import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './shared/ui/styles/theme.css'
import './index.css'
import App from './App.tsx'
import { msalInstance } from './auth/msalInstance'

async function bootstrap() {
  console.log('[MSAL] initialize start')
  await msalInstance.initialize()
  console.log('[MSAL] initialize end')

  try {
    console.log('[MSAL] handleRedirectPromise start')
    const result = await msalInstance.handleRedirectPromise()
    console.log('[MSAL] handleRedirectPromise end, result account =', result?.account ?? null)
  } catch (error) {
    console.error('[MSAL] handleRedirectPromise error', error)
  }

  const accounts = msalInstance.getAllAccounts()
  console.log('[MSAL] all accounts count =', accounts.length)
  if (!msalInstance.getActiveAccount() && accounts.length > 0) {
    msalInstance.setActiveAccount(accounts[0])
  }
  console.log('[MSAL] active account =', msalInstance.getActiveAccount())

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
