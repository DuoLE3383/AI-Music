import { Buffer } from 'buffer';
import process from 'process';
window.Buffer = Buffer;
window.process = process;

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);