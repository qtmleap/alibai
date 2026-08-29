import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/client/App'
import '@/client/index.css'

const container = document.getElementById('root')

if (container === null) {
  throw new Error('root element (#root) not found')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
