
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log("Music Visionary: Booting application...");

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error("Music Visionary: Root element not found!");
} else {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("Music Visionary: React render initiated.");
  } catch (error) {
    console.error("Music Visionary: Failed to render app:", error);
    rootElement.innerHTML = `
      <div style="padding: 40px; text-align: center; color: white;">
        <h1 style="font-size: 20px;">Opstartfout</h1>
        <p style="color: #888;">Er is een probleem met het laden van de app. Controleer of je browser up-to-date is.</p>
        <pre style="font-size: 10px; color: #444; margin-top: 20px;">${error}</pre>
      </div>
    `;
  }
}
