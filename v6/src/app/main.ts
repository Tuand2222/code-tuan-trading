import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import Debug from '../pages/Debug';
import './debug.css';
createRoot(document.getElementById('root')!).render(createElement(Debug));
