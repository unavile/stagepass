import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

function Test() {
  return <div style={{ color: 'white', padding: 40 }}>React is working</div>
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Test />
  </StrictMode>
)