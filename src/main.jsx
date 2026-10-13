import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import './modern.css';
import './residence.css';
import './premium.css';
import './editorial.css';

const container = document.getElementById('root');
const isManager = window.location.pathname.replace(/\/+$/, '') === '/plot-manager';
const prerendered = container.dataset.prerendered === 'true' && !isManager;
const app = (
  <React.StrictMode>
    <App seoOrigin={prerendered ? container.dataset.seoOrigin : undefined} copyrightYear={prerendered ? Number(container.dataset.copyrightYear) : undefined} />
  </React.StrictMode>
);

// Keep already-rendered content on screen while React attaches interactions.
if (prerendered) ReactDOM.hydrateRoot(container, app);
else ReactDOM.createRoot(container).render(app);
