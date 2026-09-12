import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import Companion from './Companion';
import './styles.css';
import {RecoveryBoundary} from './RecoveryBoundary';

const Surface=new URLSearchParams(window.location.search).has('companion')?Companion:App;
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><RecoveryBoundary><Surface/></RecoveryBoundary></React.StrictMode>);
