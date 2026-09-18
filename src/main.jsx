import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import LabAlertProvider from './alerts/LabAlertProvider.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LabAlertProvider>
      <App />
    </LabAlertProvider>
  </StrictMode>,
)
