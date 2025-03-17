import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import './index.css';

import { NavbarStyle } from './pages/NavbarStyle.js'

import Layout from './pages/Layout.js'
import FrontPage from './pages/FrontPage.js'
import Download from './pages/Download.js'
import NotFound from './pages/NotFound.js'
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <NavbarStyle>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<FrontPage/>} />
          <Route path="download" element={<Download/>} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </NavbarStyle>
);

reportWebVitals();
