import React from 'react';
import {createRoot} from 'react-dom/client';
import Catalogue from './app/components/Catalogue';
import './lib/fonts';
import './app/globals.css';
createRoot(document.getElementById('root')!).render(<Catalogue/>);
