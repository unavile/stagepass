import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import Success from './Success'

const isSuccessPage = window.location.pathname === '/success'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isSuccessPage ? <Success /> : <App />}
  </StrictMode>
)