import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import moment from "moment";
import { DiscordDataManager } from "./lib/DiscordDataManger";
import styles from "./Listfiles.module.css";
import whitelogo from './static/logos/white-logo.png';

const Listfiles = () => {
  const navigate = useNavigate();
  let [dbdata, setDbdata] = useState(null);
  let [activefile, setActiveFile] = useState(null);

  useEffect(() => {
    const fetchFiles = async () => {
      let ans = [];
      let discorddata = new DiscordDataManager();
      let dblist = await discorddata.getDBServersObjList();
      setActiveFile(await discorddata.getActiveServerDisc());

      // Loop over the DB list
      for (let element of dblist) {
        let nickname = await discorddata.getChannelNickname(element);
        let gameDiscImageUrl = await discorddata.getServerGameDisc(element);

        // If no gameDiscImageUrl, set to null (or a default value if preferred)
        if (!gameDiscImageUrl) {
          gameDiscImageUrl = null;
        }

        // Format the datetime for the element
        let epoch = (element.split("_")[1] * 1) / 1000;
        ans.push({
          id: element,
          nickname: nickname,
          isActive: element === activefile,
          datetime: moment.unix(epoch).format("LLL"),
          imageUrl: gameDiscImageUrl
        });
      }

      // Update the state with fetched data
      setDbdata(ans);
    };
    fetchFiles();
  }, []);

  const deleteFile = async (id, e) => {
    e.stopPropagation();
    const discordData = new DiscordDataManager();

    if (id === await discordData.getActiveServerDisc()) {
      alert("You are about to delete the active file. The newest file will become the next active file.");
    }

    if (!window.confirm("You are about to delete this file. Continue?")) {
      alert("Aborted.");
      return;
    }

    await discordData.removeChannel(id);
    setActiveFile(null);
  };

  const purge = async () => {
    if (!window.confirm("You are about to remove all saved data. THIS ACTION IS IRREVERSIBLE. Continue?")) {
      alert("Aborted.");
      return;
    }

    if (!window.confirm("Again, this will remove ALL DATA. Are you really sure? THIS IS YOUR LAST CHANCE!")) {
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
          // Display a unique card with default image and install title text if no files exist.
          <div
            className={`${styles.card} card`}
            style={{
              "--cd-img": `url(./blue-logo.png)`
            }}
          >
            <div className="card-body">
              <h5 className="card-title">Load Demo Titles</h5>
              <p className="card-text">
                Let's get started!\n Check out some demo titles!
              </p>
              <Link to="/loaddemo" className="card-link">
                Load a file
              </Link>
            </div>
          </div>
        ) : (
          dbdata.map((data) => (
            <div
              key={data.id}
              className={`${styles.card} card`}
              style={{
                "--cd-img": `url(${data.imageUrl || "path/to/default-image.webp"})`
              }}
              // Uncomment the next line if you want the card to navigate on click.
              // onClick={() => navigate(`/server-experience/${data.id}`)}
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
                      let dm = new DiscordDataManager();
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
              </div>
            </div>
          ))
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
