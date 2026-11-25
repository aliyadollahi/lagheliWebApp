import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import {initPWAInstallListener} from './hooks/usePWA.ts';
import './index.css';

initPWAInstallListener();

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  registerSW({immediate: true});
}

createRoot(document.getElementById('root')!).render(<App />);
