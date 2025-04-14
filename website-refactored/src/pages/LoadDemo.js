import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { DiscordDataManager } from "./lib/DiscordDataManger";
import { engineAnalyseDriver } from "./lib/EngineAnalyseDriver";
import { loadConversationEngine, processAllContextChains, calculateGlossary, calculateDisplayGlossary } from "./lib/engine2.js";
import styles from "./LoadDemo.module.css";
import FloatingBackground from "./FloatingBackground.js";

const moment = require("moment");

const LoadDemo = () => {
  const navigate = useNavigate();

  const [democatalogue, setDemoCatalogue] = useState(null);
  const [prgsbarValue, setPrgsbarValue] = useState(0);
  const [prgsModal, setPrgsModal] = useState(null);
  const prgsModalRef = useRef(null);

  // Fetch the list of demo files on mount
  useEffect(() => {
    const fetchFiles = async () => {
      const url = "/demo/files.json";
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(res.statusText);
        setDemoCatalogue(await res.json());
      } catch (err) {
        alert(`Cannot fetch demo file list: ${err}`);
      }
    };
    fetchFiles();
  }, []);

  // Download and process the file
  const download = async (filename) => {
    // Initialize Bootstrap modal (from the CDN script)
    let prg = new window.bootstrap.Modal(prgsModalRef.current, { keyboard: false });
    setPrgsModal(prg);
    prg.show();

    // Download JSON file
    const url = `/demo/files/${filename}`;
    let res;
    try {
      res = await fetch(url);
      if (!res.ok) throw new Error(res.statusText);
    } catch (err) {
      alert(`Cannot download the file: ${err}`);
      prg.hide();
      return;
    }
    setPrgsbarValue(60);

    // Remove unnecessary info from the JSON file and extract messages
    let messages = (await res.json()).messages;

    // Prepare unique filename for database
    let db_filename = `DEMO-${filename.replaceAll("_", "-")}_${Date.now()}`;
    let nickname = `DEMO: ${filename}`;
    console.log(`Saving as ${db_filename}`);

    let dataManager = new DiscordDataManager();
    let messagesStr = JSON.stringify(messages);
    console.log(messages);
    console.log(messagesStr);

    // Analyse messages
    let result = await engineAnalyseDriver(messagesStr, db_filename);

    if (result.status === true) {
      await dataManager.setGlossary(db_filename, result.glossary);
      await dataManager.setRelationships(db_filename, result.tree);
      console.log(result.blocks);
      await dataManager.setConversationBlocks(db_filename, result.blocks);
    } else {
      console.error(`CANNOT ANALYSE DATA: ${result.message}`);
      alert(`CANNOT ANALYSE DATA: ${result.message}`);
      prg.hide();
      navigate(0);
      return;
    }

    setPrgsbarValue(100);

    let dblist = await dataManager.getDBServersObjList();

    // Add the new filename to the list of DBs
    dblist.push(db_filename);

    // Update the DB list with the new filename
    await dataManager.setDBServersObjList(dblist);

    // Set the channel nickname
    await dataManager.setChannelNickname(db_filename, nickname);

    // We won't put any icon to demo ATP.
    await dataManager.setServerGameDisc(db_filename, null);

    // Set the active DB to the new filename
    await dataManager.setActiveServerDisc(db_filename);

    // Store the messages for the new DB
    await dataManager.setMessages(db_filename, messages);

    // Wait a moment for changes to be pushed
    await new Promise((r) => setTimeout(r, 2000));

    console.log("DONE!");
    prg.hide();
    window.location.href = "/";
  };

  // While the demo catalogue is loading, show a temporary message.
  if (democatalogue === null)
    return (
      <div id="content-body" className="container container-fluid">
        <h1>Load Demo Files</h1>
        <p><i>Do not know where to start? Test out our selection of demo files!</i></p>
        <i>Loading...</i>
      </div>
    );

  return (
    <>
      <Helmet>
        <title>Load Demo Files</title>
        {/* Bootstrap JS bundle */}
        <script
          src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"
          integrity="sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz"
          crossOrigin="anonymous"
        ></script>
        {/* Ensure proper scaling on mobile devices */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Helmet>

      {/* Floating ambient background */}
      <FloatingBackground />

      <div id="content-body" className="container container-fluid">
        <h1>Load Demo Files</h1>
        <p>
          <i>Do not know where to start? Test out our selection of demo files!</i>
        </p>

        {/* Use Bootstrap row and column classes for responsive grid */}
        <div className="row">
          {democatalogue.map((data, index) => (
            <div className="col-sm-12 col-md-4 mb-4" key={data.filename}>
              <div
                className={`${styles.card} card h-100`}
                style={{ animationDelay: `${index * 0.3}s` }}
              >
                <div className="card-body">
                  <h5 className="card-title">{data.name}</h5>
                  <p className="card-text">{data.description}</p>
                  <a
                    href="#"
                    className="card-link"
                    onClick={() => {
                      download(data.filename);
                    }}
                  >
                    Download
                  </a>
                </div>
              </div>
            </div>
          ))}


        {(() => {
        const itemsPerRow = 3;
        const totalRows = 2;
        const totalSlots = itemsPerRow * totalRows;

        const extraSlots = totalSlots - democatalogue.length;

        return Array.from({ length: extraSlots }).map((_, idx) => (
            <div key={`placeholder-${idx}`} className="col-sm-12 col-md-4 mb-4">
            <Link to="/download">
                <div
                className={`${styles.card} card ${styles.placeholderCard} h-100`}
                style={{ cursor: "pointer", textDecoration: "none" }}
                >
                <div
                    className="card-body d-flex align-items-center justify-content-center"
                    style={{ fontSize: "2rem", color: "#aaa" }}
                >
                    +
                </div>
                </div>
            </Link>
            </div>
        ));
        })()}

        </div>

        {/* Progress Modal */}
        <div
          className="modal fade"
          id="prgsbarModal"
          data-bs-backdrop="static"
          data-bs-keyboard="false"
          tabIndex="-1"
          aria-labelledby="prgsbarModalLabel"
          ref={prgsModalRef}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h1 className="modal-title fs-5">Downloading...</h1>
              </div>
              <div className="modal-body">
                <div
                  className="progress"
                  role="progressbar"
                  aria-label="Download progress"
                  aria-valuenow="0"
                  aria-valuemin="0"
                  aria-valuemax="100"
                >
                  <div className="progress-bar" style={{ width: `${prgsbarValue}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoadDemo;
