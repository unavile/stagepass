import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import Success from './Success'
import ResetPassword from './ResetPassword'

const path = window.location.pathname

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {path === '/success' ? <Success /> :
     path === '/reset-password' ? <ResetPassword /> :
     <App />}
  </StrictMode>
)