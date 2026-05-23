import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import CreatorPortal from './CreatorPortal'
import AdminPortal from './AdminPortal'
import Success from './Success'
import ResetPassword from './ResetPassword'

const path = window.location.pathname.toLowerCase()

let Root
if (path === '/success') {
  Root = <Success />
} else if (path === '/reset-password') {
  Root = <ResetPassword />
} else if (path === '/creator' || path === '/creator/') {
  Root = <CreatorPortal />
} else if (path === '/admin' || path === '/admin/') {
  Root = <AdminPortal />
} else {
  Root = <App />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>{Root}</StrictMode>
)
