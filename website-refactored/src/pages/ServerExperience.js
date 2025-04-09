import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import { FaRegStickyNote } from "react-icons/fa";
import styles from "./ServerExperience.module.css";

const ServerExperience = () => {
  const { serverId } = useParams();
  const navigate = useNavigate();

  const handleExplorerClick = () => {
    navigate(`/explorer/${serverId}`);
  };

  const handlePreviewClick = () => {
    navigate(`/preview/${serverId}`);
  };

  const handleNotesClick = () => {
    navigate(`/notes/${serverId}`);
  };

  return (
    <>
      <Helmet>
        <title>Server Experience - {serverId}</title>
      </Helmet>
      <div className={styles.container}>
        <h1>Welcome to Server {serverId}</h1>
        <p>Customize and track various aspects of your experience.</p>
      </div>
      <div className={styles.buttonContainer}>
        <div className={styles.roundedButton} onClick={handleExplorerClick}>
          Explorer
        </div>
        <div className={styles.roundedButton} onClick={handlePreviewClick}>
          Preview
        </div>
        <div className={styles.roundedButton} onClick={handleNotesClick}>
          <FaRegStickyNote className={styles.noteIcon} />
          <span>Notes</span>
        </div>
      </div>
      <div className={styles.description}>
        <p>
          Each server is its own unique experience. Choose between an immersive interactive mode, a static preview that highlights the curated message summary, or review your summary notes.
        </p>
      </div>
    </>
  );
};

export default ServerExperience;
