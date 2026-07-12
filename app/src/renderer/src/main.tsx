import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

// Se aplica antes de pintar (incluida la pantalla de inicio de sesión) para
// que el modo oscuro persistido no parpadee en claro al arrancar.
const storedTheme = localStorage.getItem('ams-theme')
const theme = storedTheme === 'dark' || storedTheme === 'light'
  ? storedTheme
  : window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
document.documentElement.dataset['theme'] = theme

const container = document.getElementById('root')
if (!container) throw new Error('No existe el elemento #root')

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
