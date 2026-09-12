import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import LabAlertProvider from './alerts/LabAlertProvider.jsx'
import WalkthroughProvider from './walkthrough/WalkthroughProvider.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LabAlertProvider>
      <WalkthroughProvider>
        <App />
      </WalkthroughProvider>
    </LabAlertProvider>
  </StrictMode>,
)
