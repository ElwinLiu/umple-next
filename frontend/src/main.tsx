import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App'
import { AppShell } from './components/layout/AppShell'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route path="*" element={<AppShell />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
