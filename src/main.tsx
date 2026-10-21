import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import '@fontsource/press-start-2p/400.css';
import './app/styles.css';
import { App } from './app/App';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
