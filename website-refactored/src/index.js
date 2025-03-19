import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import './index.css';

import { NavbarStyle } from './pages/NavbarStyle'
import { DiscordDataManager } from './pages/lib/DiscordDataManger';

import Layout from './pages/Layout'
import FrontPage from './pages/FrontPage'
import FrontPageWithData from './pages/FrontpageWithData';
import Download from './pages/Download'
import Listfiles from './pages/Listfiles'
import Analyse from './pages/Analyse';
import NotFound from './pages/NotFound'
import reportWebVitals from './reportWebVitals'

const root = ReactDOM.createRoot(document.getElementById('root'));

let dmanager = new DiscordDataManager()
let activeChannel = dmanager.getActiveDBSync()

root.render(
  <NavbarStyle>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          {activeChannel === "" && <Route index element={<FrontPage />} />}
          {activeChannel !== "" && <Route index element={<FrontPageWithData />} />}
          <Route path="download" element={<Download />} />
          <Route path="listfiles" element={<Listfiles />} />
          <Route path="analyse" element={<Analyse />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </NavbarStyle>
);

reportWebVitals();
