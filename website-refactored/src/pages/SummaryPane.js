import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { keys } from "idb-keyval";
import { DiscordDataManager } from "./lib/DiscordDataManger";
import styles from "./SummaryPane.module.css";
import { parse } from "marked";

const SummaryPane = () => {
  const { topicId } = useParams();
  const [summary_name, setSummaryName] = useState("");
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  console.log("With prejudice")
  useEffect(() => {
    const loadSummaries = async () => {
      setLoading(true);
      // Get all keys stored in IndexedDB via idb-keyval
      const allKeys = await keys();
      console.log(topicId,allKeys);
      // Filter keys that start with "summary/<topicId>/"
      const summaryKeys = allKeys.filter(
        (k) => typeof k === "string" && k.startsWith(`summary/${topicId}/`)
      );
      console.log(summaryKeys);

      const manager = new DiscordDataManager();
      // Map each key to an object with topic and its summary content.
      setSummaryName(manager.getChannelNicknameSync(manager.getActiveServerDiscSync()))
      
      const summariesArr = await Promise.all(
        summaryKeys.map(async (key) => {
          // Expected key format: "summary_<topicId>_<topic>"
          const parts = key.split("/");
          const topic = parts.slice(2).join("/"); // In case topic names have underscores
          const summaryContent = await manager.getSummary(topicId, topic);

          return { topic, summary: parse(summaryContent) };
        })
      );
      setSummaries(summariesArr);
      setLoading(false);
    };

    loadSummaries();
  }, [topicId]);

  if (loading) {
    return <div className={styles.loading}>Loading summaries...</div>;
  }

  return (
    <div className={styles.summaryPane}>
      <h1>Summary Topics for Channel {summary_name}</h1>
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
