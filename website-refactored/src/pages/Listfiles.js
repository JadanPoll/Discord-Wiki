import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import moment from "moment";
import { DiscordDataManager } from "./lib/DiscordDataManger";
import styles from "./Listfiles.module.css";

const FileCard = ({ data, deleteFile, navigate }) => {
  // Local state for NFC label toggle per card.
  const [nfcActive, setNfcActive] = useState(false);

  // Debug: log on every render to help with tracking state changes.
  console.log(`FileCard rendered — ID: ${data.id}, NFC Active: ${nfcActive}`);

  return (
    <div
      className={`${styles.card} card nfc-card`}
      style={{
        "--cd-img": `url(${data.imageUrl || "path/to/default-image.webp"})`,
      }}
    >
      <div className={`card-body ${data.isActive ? "shadow" : ""}`}>
        <h5 className="card-title">{data.nickname}</h5>
        <h6 className="card-subtitle mb-2 text-body-secondary">
          ID: {data.id}
        </h6>
        <p className="card-text">Created at {data.datetime}</p>

        {data.isActive ? (
          <span className="card-link">
            <i>Active File</i>
          </span>
        ) : (
          <a
            href="#"
            className="card-link"
            onClick={(e) => {
              e.stopPropagation();
              const dm = new DiscordDataManager();
              dm.setActiveServerDisc(data.id);
              navigate(0); // Reload page to update active file status
            }}
          >
            Set as active file
          </a>
        )}

        <a
          href="#"
          className="card-link"
          onClick={(e) => deleteFile(data.id, e)}
        >
          Delete
        </a>

        {/* NFC label: toggles based on click */}
        <div
          className={`${styles["nfc-label"]} ${nfcActive ? styles.active : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            console.log(`NFC clicked — ID: ${data.id}`);
            setNfcActive((prev) => !prev);
          }}
        >
          NFC
        </div>

      </div>
    </div>
  );
};

const Listfiles = () => {
  const navigate = useNavigate();
  const [dbdata, setDbdata] = useState(null);
  const [activefile, setActiveFile] = useState(null);

  useEffect(() => {
    const fetchFiles = async () => {
      const ans = [];
      const discordData = new DiscordDataManager();
      const dblist = await discordData.getDBServersObjList();
      const active = await discordData.getActiveServerDisc();
      setActiveFile(active);

      // Process each file from the DB list.
      for (const element of dblist) {
        const nickname = await discordData.getChannelNickname(element);
        let gameDiscImageUrl = await discordData.getServerGameDisc(element);
        if (!gameDiscImageUrl) {
          gameDiscImageUrl = null;
        }
        // Extract epoch value from filename and format it.
        const epoch = (element.split("_")[1] * 1) / 1000;
        ans.push({
          id: element,
          nickname: nickname,
          isActive: element === active,
          datetime: moment.unix(epoch).format("LLL"),
          imageUrl: gameDiscImageUrl,
        });
      }

      setDbdata(ans);
    };

    fetchFiles();
  }, []);

  const deleteFile = async (id, e) => {
    e.stopPropagation();
    const discordData = new DiscordDataManager();

    if (id === (await discordData.getActiveServerDisc())) {
      alert(
        "You are about to delete the active file. The newest file will become the next active file."
      );
    }

    if (!window.confirm("You are about to delete this file. Continue?")) {
      alert("Aborted.");
      return;
    }

    await discordData.removeChannel(id);
    setActiveFile(null);
  };

  const purge = async () => {
    if (
      !window.confirm(
        "You are about to remove all saved data. THIS ACTION IS IRREVERSIBLE. Continue?"
      )
    ) {
      alert("Aborted.");
      return;
    }

    if (
      !window.confirm(
        "Again, this will remove ALL DATA. Are you really sure? THIS IS YOUR LAST CHANCE!"
      )
    ) {
      alert("Aborted.");
      return;
    }

    const discordData = new DiscordDataManager();
    await discordData.purge();
    navigate("/");
  };

  if (dbdata === null) return <div>Loading...</div>;

  return (
    <>
      <Helmet>
        <title>Files Available</title>
      </Helmet>
      <div id="content-body" className="container container-fluid">
        <h1>Files Available</h1>
        {dbdata.length === 0 ? (
          // When no files exist, display a unique card using the default image.
          <div
            className={`${styles.card} card`}
            style={{
              "--cd-img": `url(./blue-logo.png)`,
            }}
          >
            <div className="card-body">
              <h5 className="card-title">Load Demo Titles</h5>
              <p className="card-text">
                Let's get started! Check out some demo titles!
              </p>
              <Link to="/loaddemo" className="card-link">
                Load a file
              </Link>
            </div>
          </div>
        ) : (
          <>
            {dbdata.map((data) => (
              <FileCard
                key={data.id}
                data={data}
                deleteFile={deleteFile}
                navigate={navigate}
              />
            ))}
            {/* Extra card with a unique image that links to /loaddemo */}
            <div className={`${styles.card} card`}>
              <Link to="/loaddemo">
                <div
                  className="card-img-top"
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "200px", // Adjust height as needed
                  }}
                >
                  <img
                    src="/website-icon-transparent.jpg"
                    alt="Load Demo"
                    style={{
                      width: "80%",
                      objectFit: "contain", // Preserve aspect ratio
                      opacity: 0.1,
                    }}
                  />
                </div>
              </Link>
            </div>
          </>
        )}
        <div>
          <button
            type="button"
            className="btn btn-danger float-end mx-1"
            onClick={purge}
          >
            Delete All Files
          </button>
          <Link
            to="/download"
            className="btn btn-primary mx-1 float-end"
            role="button"
          >
            Load a file
          </Link>
        </div>
      </div>
    </>
  );
};

export default Listfiles;
