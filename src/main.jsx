import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import CreatorPortal from './CreatorPortal'
import AdminPortal from './AdminPortal'
import Success from './Success'
import ResetPassword from './ResetPassword'
import ResetPasswordFan from './ResetPasswordFan'
import EventLanding from './EventLanding'

const path = window.location.pathname.toLowerCase()
const hash = window.location.hash
const RESERVED = ['success', 'reset-password', 'reset-password-fan', 'creator', 'admin', '']

// Extract segment after leading slash e.g. /shantimantra → shantimantra
const segment = path.replace(/^\//, '').split('/')[0].trim()

// Supabase appends #access_token=...&type=recovery to the redirect path
const hashParams = new URLSearchParams(hash.substring(1))
const isRecovery = hashParams.get('type') === 'recovery' && hashParams.get('access_token')

let Root
if (segment === 'reset-password-fan') {
  Root = <ResetPasswordFan />
} else if (segment === 'reset-password') {
  Root = <ResetPassword />
} else if (isRecovery) {
  // Recovery hash present but path didn't match a known reset route
  Root = <ResetPassword />
} else if (segment === 'success') {
  Root = <Success />
} else if (segment === 'creator') {
  Root = <CreatorPortal />
} else if (segment === 'admin') {
  Root = <AdminPortal />
} else if (segment && !RESERVED.includes(segment)) {
  // Unknown segment — could be a creator handle (fan portal) OR an event slug (landing page)
  // EventLanding will fetch by slug; if not found it falls back gracefully showing "Not Found"
  // and the fan portal handle lookup happens inside App via deepHandle
  Root = <EventLanding slug={segment} fallback={<App deepHandle={segment} />} />
} else {
  Root = <App deepHandle={null} />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>{Root}</StrictMode>
)
