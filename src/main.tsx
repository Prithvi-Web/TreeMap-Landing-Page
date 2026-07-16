import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/700.css'
import './index.css'
import App from './App.tsx'

// The pinned story reads best from the top; don't let the browser restore a
// mid-narrative scroll position on reload.
history.scrollRestoration = 'manual'
window.scrollTo(0, 0)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
