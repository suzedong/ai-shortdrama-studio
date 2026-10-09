import React from 'react'
import ReactDOM from 'react-dom/client'
import ErrorBoundary from './studio/ErrorBoundary'
import StudioApp from './studio/StudioApp'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <StudioApp />
    </ErrorBoundary>
  </React.StrictMode>,
)
