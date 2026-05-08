import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { printBanner } from './lib/logger.js'
import { GITHUB_URL, WECHAT_ID } from './config.js'

printBanner({
  version: __APP_VERSION__,
  github: GITHUB_URL,
  wechat: WECHAT_ID,
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
