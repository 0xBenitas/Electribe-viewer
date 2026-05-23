import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { usePartsStore } from './store/parts.ts';
import { usePresetsStore } from './store/presets.ts';
import './styles/globals.css';

// Restaure les données persistées (noms de part, presets) avant le premier rendu utile.
void usePartsStore.getState().loadMetadata();
void usePresetsStore.getState().load();

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
