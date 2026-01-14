import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // Vite handles .tsx extensions automatically
import './styles/index.css'; // This connects your new Figma styles

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);