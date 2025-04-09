import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import moment from "moment";
import { DiscordDataManager } from "./lib/DiscordDataManger";
import styles from "./Listfiles.module.css";

const Listfiles = () => {
  const navigate = useNavigate();

  let [dbdata, setDbdata] = useState(null)
  let [activefile, setActiveFile] = useState(null);
  useEffect(() => {
    const fetchFiles = async () => {
      let ans = []

      let discorddata = new DiscordDataManager()
      let dblist = await discorddata.getDBServersObjList()
      setActiveFile(await discorddata.getActiveServerDisc())

      // Loop over the DB list
      for (let element of dblist) {
        let nickname = await discorddata.getChannelNickname(element)
        let gameDiscImageUrl = await discorddata.getServerGameDisc(element)

        // Check if the gameDiscImageUrl is valid, otherwise set it to null
        if (!gameDiscImageUrl) {
          gameDiscImageUrl = null;  // Or you can set a default image if preferred
        }

        // Extract and format the datetime for the element
        let epoch = element.split("_")[1] * 1 / 1000
        ans.push({
          id: element,
          nickname: nickname,
          isActive: (element === activefile),
          datetime: moment.unix(epoch).format("LLL"),
          imageUrl: gameDiscImageUrl
        })
      }

      // Update the state with the fetched data
      setDbdata(ans)
    }
    fetchFiles();
  });

  const deleteFile = async (id, e) => {
    // Prevent card click event from triggering navigation
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

    if (
      !window.confirm("Again, this will remove ALL DATA. Are you really sure? THIS IS YOUR LAST CHANCE!")
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
          <p>
            No file is loaded. Get started by{" "}
            <Link to="/download">loading a file first</Link>!
          </p>
        ) : (
          dbdata.map((data) => (
            <div
              key={data.id}
              className={`${styles.card} card`}
              style={{
                "--cd-img": `url(${data.imageUrl || "path/to/default-image.webp"})`,
              }}
            // Navigate to the ServerExperience page when the card is clicked.
            //onClick={() => navigate(`/server-experience/${data.id}`)}
            >
              <div className={`card-body ${data.isActive ? "shadow" : ""}`}>
                <h5 className="card-title">{data.nickname}</h5>



                <h6 className="card-subtitle mb-2 text-body-secondary">
                  ID: {data.id}
                </h6>
                <p className="card-text">Created at {data.datetime}</p>
                {data.isActive && (
                  <span className="card-link">
                    <i>Active File</i>
                  </span>
                )}
                {!data.isActive && (
                  <a
                    href="#"
                    className="card-link"
                    onClick={(e) => {
                      e.stopPropagation();
                      let dm = new DiscordDataManager();
                      dm.setActiveServerDisc(data.id);
                      navigate(0); // Reloads the page to update active file status
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
