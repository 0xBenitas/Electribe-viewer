import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { usePartsStore } from './store/parts.ts';
import './styles/globals.css';

// Restaure les noms/couleurs de part persistés avant le premier rendu utile.
void usePartsStore.getState().loadMetadata();

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
