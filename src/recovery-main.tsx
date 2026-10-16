import React from 'react';
import {createRoot} from 'react-dom/client';
import {RecoveryReader, validRecoveryBridge} from './RecoveryReader';
import './recovery-reader.css';
const bridge=(window as unknown as {sunnyRecovery?:unknown}).sunnyRecovery;
createRoot(document.getElementById('root')!).render(<React.StrictMode>{validRecoveryBridge(bridge)?<RecoveryReader bridge={bridge}/>:<main><h1>Recovery reader unavailable</h1><p>Close this window and use the approved recovery shortcut.</p></main>}</React.StrictMode>);
