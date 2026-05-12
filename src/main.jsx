import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: '#1a1a1a',
          color: '#fff',
          border: '1px solid #333',
          borderRadius: '12px',
          fontSize: '13px',
        },
        success: {
          iconTheme: { primary: '#34d399', secondary: '#1a1a1a' },
        },
        error: {
          iconTheme: { primary: '#f87171', secondary: '#1a1a1a' },
        },
      }}
    />
    <App />
  </StrictMode>,
)
