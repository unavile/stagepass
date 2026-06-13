import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import CreatorPortal from './CreatorPortal'
import AdminPortal from './AdminPortal'
import Success from './Success'
import ResetPassword from './ResetPassword'
import ResetPasswordFan from './ResetPasswordFan'

const path = window.location.pathname.toLowerCase()
const hash = window.location.hash
const RESERVED = ['success', 'reset-password', 'reset-password-fan', 'creator', 'admin', '']

// Extract segment after leading slash e.g. /maravoss → maravoss
const segment = path.replace(/^\//, '').split('/')[0].trim()

// ── If the URL has a recovery token hash, show the path-appropriate reset screen ──
// Supabase appends #access_token=...&type=recovery to whatever path was passed
// as redirect_to, so /reset-password-fan#access_token=... lands here with
// segment === 'reset-password-fan'. Check path first, then fall back to the
// creator reset page for any other recovery link (legacy / no redirect_to set).
const hashParams = new URLSearchParams(hash.substring(1))
const isRecovery = hashParams.get('type') === 'recovery' && hashParams.get('access_token')

let Root
if (segment === 'reset-password-fan') {
  Root = <ResetPasswordFan />
} else if (segment === 'reset-password') {
  Root = <ResetPassword />
} else if (isRecovery) {
  // Recovery hash present but path didn't match a known reset route —
  // default to creator reset page (legacy behavior / no redirect_to)
  Root = <ResetPassword />
} else if (segment === 'success') {
  Root = <Success />
} else if (segment === 'creator') {
  Root = <CreatorPortal />
} else if (segment === 'admin') {
  Root = <AdminPortal />
} else if (segment && !RESERVED.includes(segment)) {
  // Looks like a creator handle — open fan portal with that creator pre-selected
  Root = <App deepHandle={segment} />
} else {
  Root = <App deepHandle={null} />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>{Root}</StrictMode>
)
