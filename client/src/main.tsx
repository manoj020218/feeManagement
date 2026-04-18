import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Declare Capacitor types for TypeScript
declare global {
  interface Window {
    Capacitor: {
      isNativePlatform: () => boolean;
      Plugins: {
        GoogleAuth?: {
          signIn: () => Promise<{ authentication: { idToken: string } }>;
        };
        Browser?: {
          open: (opts: { url: string; windowName?: string }) => Promise<void>;
        };
        Filesystem?: unknown;
        App?: unknown;
      };
    };
    google?: unknown;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App/>
  </React.StrictMode>,
);
