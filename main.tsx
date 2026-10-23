import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initTheme } from './theme'
import ErrorBoundary from './ErrorBoundary'
import { initErrorReporting } from './errorReporter'

initTheme()
initErrorReporting()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

// Service worker: web push, notification clicks and an offline fallback (see public/sw.js).
if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
