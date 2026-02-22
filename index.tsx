
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

console.log('Mounting React App...');

try {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log('React App mounted successfully');
} catch (error) {
  console.error('Failed to mount React App:', error);
}
