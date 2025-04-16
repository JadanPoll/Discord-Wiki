import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import './index.css';

import { NavbarStyle } from './pages/NavbarStyle'
import { DiscordDataManager } from './pages/lib/DiscordDataManger';

import Layout from './pages/Layout'
import FrontPage from './pages/FrontPage'
import FrontPageWithData from './pages/FrontpageWithData';
import Download from './pages/Pane_Dowload/Download';
import Listfiles from './pages/Pane_Titles/Listfiles';
import Analyse from './pages/Pane_Explore/Analyse';
import Preview from './pages/Preview';
import LoadDemo from './pages/Pane_XMenu/LoadDemo';
import NotFound from './pages/NotFound'
import SummaryPane from './pages/SummaryPane'; // ✅ Import SummaryPane here
import Community from './pages/Pane_Community/Community';
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
          <Route path="titles" element={<Listfiles />} />
          <Route path="xmenu" element={<LoadDemo />} />
          <Route path="explore" element={<Analyse />} />
          <Route path="community" element={<Community />} />
          <Route path="preview/:id" element={<Preview />} />
          <Route path="/explorer/:serverId" element={<Analyse />} />
          <Route path="notes/:topicId" element={<SummaryPane />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </NavbarStyle>
);

reportWebVitals();
