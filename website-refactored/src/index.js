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
import Preview from './pages/Preview';
import ServerExperience from './pages/ServerExperience';
import NotFound from './pages/NotFound'
import SummaryPane from './pages/SummaryPane'; // ✅ Import SummaryPane here

import reportWebVitals from './reportWebVitals'
import { Helmet } from 'react-helmet';

const root = ReactDOM.createRoot(document.getElementById('root'));

let dmanager = new DiscordDataManager()
let activeChannel = dmanager.getActiveServerDiscSync()

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
          <Route path="preview/:id" element={<Preview />} />
          <Route path="/server-experience/:serverId" element={<ServerExperience />} />
          <Route path="/explorer/:serverId" element={<Analyse />} />
          <Route path="notes/:topicId" element={<SummaryPane />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </NavbarStyle>
);

reportWebVitals();
