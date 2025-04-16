// FloatingBackground.jsx
import React from "react";
import styles from "./FloatingBackground.module.css";

const FloatingBackground = () => {
  return (
    <div className={styles.floatingContainer}>
      <div
        className={styles.floatingBlob}
        style={{ top: "10%", left: "5%", animationDelay: "0s" }}
      />
      <div
        className={styles.floatingBlob}
        style={{ top: "50%", left: "80%", animationDelay: "3s" }}
      />
      <div
        className={styles.floatingBlob}
        style={{ top: "70%", left: "20%", animationDelay: "6s" }}
      />
      <div
        className={styles.floatingBlob}
        style={{ top: "30%", left: "50%", animationDelay: "1s" }}
      />
    </div>
  );
};

export default FloatingBackground;
