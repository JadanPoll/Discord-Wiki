import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { DiscordDataManager } from "./lib/DiscordDataManger";
import { engineAnalyseDriver } from "./lib/EngineAnalyseDriver";
import {
  loadConversationEngine,
  processAllContextChains,
  calculateGlossary,
  calculateDisplayGlossary,
} from "./lib/engine2.js";
import styles from "./LoadDemo.module.css";
import FloatingBackground from "./FloatingBackground.js";
import moment from "moment";
import io from "socket.io-client";

const socket = io(location.hostname === 'localhost' || location.hostname === '' 
  ? 'http://127.0.0.1:5000' 
  : `http://${location.hostname}`);

const LoadDemo = () => {
  const navigate = useNavigate();

  // State variables
  const [demoCatalogue, setDemoCatalogue] = useState(null);
  const [progress, setProgress] = useState(0);
  const progressModalRef = useRef(null);
  const [showNfcModal, setShowNfcModal] = useState(false);
  const [nfcCode, setNfcCode] = useState("");
  const nfcModalRef = useRef(null);

  // Fetch demo catalogue on component mount
  useEffect(() => {
    const fetchCatalogue = async () => {
      try {
        const response = await fetch("/demo/files.json");
        if (!response.ok) throw new Error(response.statusText);
        const data = await response.json();
        setDemoCatalogue(data);
      } catch (error) {
        alert(`Error fetching demo catalogue: ${error.message}`);
      }
    };
    fetchCatalogue();
  }, []);

  // Function to download and process a demo file
  const handleDownload = async (filename) => {
    // Show progress modal
    const progressModal = new window.bootstrap.Modal(progressModalRef.current, { keyboard: false });
    progressModal.show();
    setProgress(0);

    try {
      // Download JSON file from the server
      const response = await fetch(`/demo/files/${filename}`);
      if (!response.ok) throw new Error(response.statusText);
      setProgress(60);

      // Extract messages from the JSON file
      const { messages } = await response.json();

      // Create a unique database filename and nickname for the demo
      const dbFilename = `DEMO-${filename.replaceAll("_", "-")}_${Date.now()}`;
      const nickname = `DEMO: ${filename}`;

      const dataManager = new DiscordDataManager();
      const messagesStr = JSON.stringify(messages);

      // Run the engine analysis to process messages
      const analysisResult = await engineAnalyseDriver(messagesStr, dbFilename);
      if (analysisResult.status) {
        await dataManager.setGlossary(dbFilename, analysisResult.glossary);
        await dataManager.setRelationships(dbFilename, analysisResult.tree);
        await dataManager.setConversationBlocks(dbFilename, analysisResult.blocks);
      } else {
        console.error(`Data analysis failed: ${analysisResult.message}`);
        alert(`Data analysis failed: ${analysisResult.message}`);
        progressModal.hide();
        navigate(0);
        return;
      }

      setProgress(100);

      // Update the list of demo databases
      const dbList = await dataManager.getDBServersObjList();
      dbList.push(dbFilename);
      await dataManager.setDBServersObjList(dbList);

      // Set additional database details
      await dataManager.setChannelNickname(dbFilename, nickname);
      await dataManager.setServerGameDisc(dbFilename, null);
      await dataManager.setActiveServerDisc(dbFilename);
      await dataManager.setMessages(dbFilename, messages);

      // Pause briefly to allow changes to propagate
      await new Promise((resolve) => setTimeout(resolve, 2000));

      progressModal.hide();
      window.location.href = "/";
    } catch (error) {
      alert(`Download error: ${error.message}`);
      const progressModalInstance = window.bootstrap.Modal.getInstance(progressModalRef.current);
      if (progressModalInstance) progressModalInstance.hide();
    }
  };

  // NFC Modal functions
  const openNfcModal = () => {
    setShowNfcModal(true);
    const nfcModal = new window.bootstrap.Modal(nfcModalRef.current, { keyboard: false });
    nfcModal.show();
  };



  useEffect(() =>
  {
  console.log("Run x times")
  socket.on("nfc_host_is_sharing_requested_data", (response) => {
    console.log("Run only once")
    alert("NFC communication installed successfully!");
    console.log(response)
    setShowNfcModal(false);
    setNfcCode("");
    const nfcModalInstance = window.bootstrap.Modal.getInstance(nfcModalRef.current);
    if (nfcModalInstance) nfcModalInstance.hide();

    const dataManager = new DiscordDataManager();
    (async () => {
      
      const dbFilename = `NFC-${response.id}`;

      const dbList = await dataManager.getDBServersObjList();
      if (dbList.includes(dbFilename))
      {
        alert("NFC Game Already exists")
        return
      }

      const nickname = `NFC: ${response.nickname}`;
      await dataManager.setChannelNickname(dbFilename, nickname);
      await dataManager.setGlossary(dbFilename, response.glossary);
      await dataManager.setRelationships(dbFilename, response.relationships);
      await dataManager.setConversationBlocks(dbFilename, response.conversation_blocks);
      await dataManager.setSummary(dbFilename, response.summary);
    
      //So it knows about it for display
      dbList.push(dbFilename);
      await dataManager.setDBServersObjList(dbList);

    })();
  });

  socket.on("nfc_request_dserver_from_host_device.error", (error) => {
    alert(error.error);
    setNfcCode("");
  });
  },[])
  const handleNfcSubmit = async (event) => {
    event.preventDefault();
    socket.emit("nfc_request_dserver_from_host_device", { nfc_code: nfcCode });
  };

  // Render a loading state if the catalogue is not yet fetched
  if (demoCatalogue === null) {
    return (
      <div id="content-body" className="container container-fluid">
        <h1>Load Demo Files</h1>
        <p>
          <i>Not sure where to begin? Try one of our demo files!</i>
        </p>
        <i>Loading...</i>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Load Demo Files</title>
        <script
          src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"
          integrity="sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz"
          crossOrigin="anonymous"
        ></script>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Helmet>

      {/* Floating ambient background */}
      <FloatingBackground />

      <div id="content-body" className="container container-fluid">
        <h1>Load Demo Files</h1>
        <p>
          <i>Not sure where to begin? Try one of our demo files!</i>
        </p>

        {/* Grid of demo file cards */}
        <div className="row">
          {demoCatalogue.map((file, index) => (
            <div key={file.filename} className="col-sm-12 col-md-4 mb-4">
              <div className={`${styles.card} card h-100`} style={{ animationDelay: `${index * 0.3}s` }}>
                <div className="card-body">
                  <h5 className="card-title">{file.name}</h5>
                  <p className="card-text">{file.description}</p>
                  <a href="#" className="card-link" onClick={() => handleDownload(file.filename)}>
                    Download
                  </a>
                </div>
              </div>
            </div>
          ))}

          {/* Render extra grid slots */}
          {(() => {
            const itemsPerRow = 3;
            const totalRows = 2;
            const totalSlots = itemsPerRow * totalRows;
            const extraSlots = totalSlots - demoCatalogue.length;
            return Array.from({ length: extraSlots }).map((_, idx) => {
              // First extra slot: NFC icon for entering a code
              if (idx === 0) {
                return (
                  <div key={`placeholder-${idx}`} className="col-sm-12 col-md-4 mb-4">
                    <div
                      className={`${styles.card} card ${styles.placeholderCard} h-100`}
                      style={{ cursor: "pointer", textDecoration: "none" }}
                      onClick={openNfcModal}
                    >
                      <div
                        className="card-body d-flex align-items-center justify-content-center"
                        style={{ fontSize: "2rem", color: "#aaa" }}
                      >
                        NFC
                      </div>
                    </div>
                  </div>
                );
              }
              // Remaining extra slots: placeholder card linking to download page
              return (
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
              );
            });
          })()}
        </div>

        {/* Progress Modal */}
        <div
          className="modal fade"
          id="progressModal"
          data-bs-backdrop="static"
          data-bs-keyboard="false"
          tabIndex="-1"
          aria-labelledby="progressModalLabel"
          ref={progressModalRef}
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
                  <div className="progress-bar" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* NFC Code Modal */}
        <div
          className="modal fade"
          id="nfcModal"
          data-bs-backdrop="static"
          data-bs-keyboard="false"
          tabIndex="-1"
          aria-labelledby="nfcModalLabel"
          ref={nfcModalRef}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <form onSubmit={handleNfcSubmit}>
                <div className="modal-header">
                  <h1 className="modal-title fs-5" id="nfcModalLabel">
                    Enter 4-Digit Code
                  </h1>
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Enter code"
                      value={nfcCode}
                      maxLength="4"
                      onChange={(e) => setNfcCode(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowNfcModal(false);
                      setNfcCode("");
                      const modalInstance = window.bootstrap.Modal.getInstance(nfcModalRef.current);
                      if (modalInstance) modalInstance.hide();
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Submit
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoadDemo;
