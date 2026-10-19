/*
 * Copyright 2009-2025 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './globals.css';

/*
 * Apply the stored theme before the first paint. useTheme (hooks/useTheme.ts)
 * does the same thing in an effect, which runs after React has already painted
 * a light frame — on a dark-mode reload that reads as a white flash. Mirror its
 * storage key and OS fallback here so the very first frame is correct.
 */
const storedTheme = localStorage.getItem('ui-theme');
const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
if (storedTheme === 'dark' || (storedTheme === null && prefersDark)) {
  document.documentElement.classList.add('dark');
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
