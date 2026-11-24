import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppToasts } from './components/AppToasts.tsx'
import { LoginPage } from './components/login/LoginPage.tsx'
import { isSignedOut, loginUrl } from './lib/session.ts'
import { registerSW } from 'virtual:pwa-register'
import { applyDevFlags } from './lib/devFlags.ts'

applyDevFlags()

// `/login` is the sign-in page, rendered INSTEAD of the app, so it opens no broker connection.
const loginOnly = window.location.pathname === '/login'

function mount() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      {loginOnly ? (
        <LoginPage />
      ) : (
        <>
          <App />
          <AppToasts />
        </>
      )}
    </StrictMode>,
  )
}

// The cached PWA shell opens without asking Caddy, so a signed-out device would boot the app and loop on
// a refused WebSocket. Ask the login service first and send a signed-out visitor to /login.
if (loginOnly) {
  mount()
} else {
  void isSignedOut().then((out) => {
    if (out) window.location.replace(loginUrl(window.location.pathname + window.location.search))
    else mount()
  })
}

registerSW({ immediate: true })
