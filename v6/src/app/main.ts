import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import Workspace from '../pages/Workspace';
import './debug.css';
import './workspace.css';
import './journal.css';
createRoot(document.getElementById('root')!).render(createElement(Workspace));
