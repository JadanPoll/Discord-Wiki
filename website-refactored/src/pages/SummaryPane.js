import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { keys } from "idb-keyval";
import { DiscordDataManager } from "./lib/DiscordDataManger";
import styles from "./SummaryPane.module.css";

const SummaryPane = () => {
  const { channelId } = useParams();
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSummaries = async () => {
      setLoading(true);
      // Get all keys stored in IndexedDB via idb-keyval
      const allKeys = await keys();
      // Filter keys that start with "summary_<channelId>_"
      const summaryKeys = allKeys.filter(
        (k) => typeof k === "string" && k.startsWith(`summary_${channelId}_`)
      );
      const manager = new DiscordDataManager();
      // Map each key to an object with topic and its summary content.
      const summariesArr = await Promise.all(
        summaryKeys.map(async (key) => {
          // Expected key format: "summary_<channelId>_<topic>"
          const parts = key.split("_");
          const topic = parts.slice(2).join("_"); // In case topic names have underscores
          const summaryContent = await manager.getSummary(channelId, topic);
          return { topic, summary: summaryContent };
        })
      );
      setSummaries(summariesArr);
      setLoading(false);
    };

    loadSummaries();
  }, [channelId]);

  if (loading) {
    return <div className={styles.loading}>Loading summaries...</div>;
  }

  return (
    <div className={styles.summaryPane}>
      <h1>Summary Topics for Channel {channelId}</h1>
      {summaries.length === 0 ? (
        <p>No summaries found for this channel.</p>
      ) : (
        <div className={styles.summaryGrid}>
          {summaries.map(({ topic, summary }, idx) => (
            <div key={idx} className={styles.summaryCard}>
              <div className={styles.summaryHeader}>
                <h2>{topic}</h2>
              </div>
              <div
                className={styles.summaryContent}
                dangerouslySetInnerHTML={{ __html: summary }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SummaryPane;
