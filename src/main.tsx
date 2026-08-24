import '@fontsource/dm-sans';
import '@fontsource/inter';
import '@fontsource/dm-serif-display';
import '@xyflow/react/dist/style.css';

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { toast, Toaster } from 'sonner';
import { listen } from '@tauri-apps/api/event';

// Global toast instance for Tauri integration
declare global {
  interface Window {
    toast: any;
  }
}

// Play notification sound
function playBubblePop() {
  const audio = new Audio('/src/assets/sounds/bubble-pop.mp3');
  audio.volume = 0.6;
  audio.play().catch(() => { });
}

// Listen for compatibility result from Tauri backend
listen('compatibility_result', (event) => {
  const message = event.payload === true
    ? 'Current operations are compatible!'
    : 'Operations are not compatible! Please check your flow and uploaded file.';

  // Play sound for notifications
  playBubblePop();

  window.dispatchEvent(new CustomEvent('show-sonner-toast', {
    detail: {
      type: event.payload === true ? 'success' : 'warning',
      message
    }
  }));
});

// Listen for processing updates from Tauri
listen('processing_update', (event: any) => {
  const { phase, operation, progress, message } = event.payload;

  // Play sound for processing updates
  playBubblePop();

  window.dispatchEvent(new CustomEvent('processing-update', {
    detail: { phase, operation, progress, message }
  }));

  // Dispatch internal processing update event
  window.dispatchEvent(new CustomEvent('processing-update', {
    detail: { phase, operation, progress, message }
  }));
});

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
    `color: ${colors[type as keyof typeof colors] || colors.info}; font-weight: bold; font-family: 'CMU Serif Roman', serif;`
  );

  const toastFn = (toast as any)[type] || toast.info || toast;
  toastFn(message, {
    duration: type === 'error' ? 5000 : 3000,
    style: {
      fontFamily: "'CMU Serif Roman', serif",
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
          fontFamily: "'CMU Serif Roman', serif",
          fontSize: '14px',
          lineHeight: '1.5',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        },
        duration: 3000,
        className: 'cmu-toast',
      }}
    />
  </React.StrictMode>
);