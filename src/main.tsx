import './components/local-captain.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import {lazy,Suspense} from 'react';
import './styles.css';
import './voyage-ui.css';
import './command-deck.css';
import './helm.css';
import './helm-motion.css';
import {RecoveryBoundary} from './RecoveryBoundary';

const isCompanion=new URLSearchParams(window.location.search).has('companion');
const Companion=lazy(()=>import('./Companion'));
const Surface=isCompanion?<Companion/>:<App/>;
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><RecoveryBoundary><Suspense fallback={<div className="loading-deck"><span/><h2>Loading Sunny HQ…</h2></div>}>{Surface}</Suspense></RecoveryBoundary></React.StrictMode>);
import './quarters.css';
import './room-stations.css';

import './work-navigation.css';
import './shipboard.css';

import './components/local-crew.css';
import './views/projects.css';
import './studio.css';

import './wanted-posters.css';
