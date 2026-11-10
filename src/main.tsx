import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@xyflow/react/dist/style.css';

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { toast, Toaster } from 'sonner';
import bubblePopUrl from './assets/sounds/bubble-pop.mp3';

// Global toast instance for Tauri integration
declare global {
  interface Window {
    toast: any;
  }
}

// Play notification sound
function playBubblePop() {
  const audio = new Audio(bubblePopUrl);
  audio.volume = 0.6;
  audio.play().catch(() => { });
}

// Enhanced toast event handler with console logging
window.addEventListener('show-sonner-toast', (e: any) => {
  playBubblePop();
  const { type, message } = e.detail;

  const timestamp = new Date().toLocaleTimeString();
  const logEntry = `[${timestamp}] ${message}`;

  const colors = {
    success: '#22c55e',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6'
  };

  console.log(
    `%c${logEntry}`,
    `color: ${colors[type as keyof typeof colors] || colors.info}; font-weight: bold; font-family: 'Inter', sans-serif;`
  );

  const toastFn = (toast as any)[type] || toast.info || toast;
  toastFn(message, {
    duration: type === 'error' ? 5000 : 3000,
    style: {
      fontFamily: "'Inter', sans-serif",
      fontSize: '14px',
      lineHeight: '1.4',
    },
  });
});

// Set up global toast reference
const toastInstance = {
  success: (message: string) => window.dispatchEvent(new CustomEvent('show-sonner-toast', {
    detail: { type: 'success', message }
  })),
  error: (message: string) => window.dispatchEvent(new CustomEvent('show-sonner-toast', {
    detail: { type: 'error', message }
  })),
  warning: (message: string) => window.dispatchEvent(new CustomEvent('show-sonner-toast', {
    detail: { type: 'warning', message }
  })),
  info: (message: string) => window.dispatchEvent(new CustomEvent('show-sonner-toast', {
    detail: { type: 'info', message }
  })),
};

window.toast = toastInstance;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <Toaster
      richColors
      position="bottom-right"
      expand={true}
      toastOptions={{
        style: {
          fontFamily: "'Inter', sans-serif",
          fontSize: '14px',
          lineHeight: '1.5',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        },
        duration: 3000,
        className: 'normaflow-toast',
      }}
    />
  </React.StrictMode>
);
