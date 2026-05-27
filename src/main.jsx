import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import CreatorPortal from './CreatorPortal'
import AdminPortal from './AdminPortal'
import Success from './Success'
import ResetPassword from './ResetPassword'

const path = window.location.pathname.toLowerCase()
const RESERVED = ['success', 'reset-password', 'creator', 'admin', '']

// Extract segment after leading slash e.g. /maravoss → maravoss
const segment = path.replace(/^\//, '').split('/')[0].trim()

let Root
if (segment === 'success') {
  Root = <Success />
} else if (segment === 'reset-password') {
  Root = <ResetPassword />
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
