import React, { useEffect, useState, useRef } from "react";
import { Helmet } from "react-helmet";
import { useParams, useNavigate } from "react-router-dom";
import { DiscordDataManager } from "./lib/DiscordDataManger";
import styles from "./Preview.module.css";

// Helper: Lighten a given color by a percentage.
function lightenColor(color, percent) {
  if (!color || color === "transparent") return "rgba(255,255,255,0.1)";

  if (color.startsWith("rgb")) {
    const match = color.match(/\d+(\.\d+)?/g);
    if (!match) return color;
    let [r, g, b, a] = match.map(Number);
    a = a !== undefined ? Math.min(1, a + percent) : Math.min(1, percent + 1);
    return `rgba(${r},${g},${b},${a})`;
  }

  if (color.startsWith("#")) {
    let num = parseInt(color.slice(1), 16);
    let amt = Math.round(255 * percent);
    let r = Math.min(255, (num >> 16) + amt);
    let g = Math.min(255, ((num >> 8) & 0x00ff) + amt);
    let b = Math.min(255, (num & 0x0000ff) + amt);
    return `rgb(${r},${g},${b})`;
  }
  return color;
}

// A component to render an individual message.
const MessageItem = ({ msg }) => {
  const [isHovered, setIsHovered] = useState(false);
  const baseBackground = "#40444b";
  const backgroundColor = isHovered
    ? lightenColor(baseBackground, 0.1)
    : baseBackground;

  const itemStyle = {
    ...widgetStyles.messageItem,
    backgroundColor,
  };

  return (
    <div
      style={itemStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <p style={{ margin: 0 }}>
        <strong>{(msg.author && msg.author.username) || "Unknown"}:</strong>{" "}
        {msg.content}
      </p>
      <div style={widgetStyles.timestamp}>
        {new Date(msg.timestamp).toLocaleString()}
      </div>
    </div>
  );
};

const widgetStyles = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "80vh",
    width: "100%",
    maxWidth: "600px",
    margin: "20px auto",
    border: "1px solid #40444b",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
    backgroundColor: "#36393f",
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    color: "#dcddde",
    borderRadius: "6px",
    position: "relative",
  },
  header: {
    backgroundColor: "#2f3136",
    padding: "10px",
    textAlign: "center",
    fontSize: "1.25em",
    fontWeight: "bold",
    borderBottom: "1px solid #40444b",
    borderRadius: "6px 6px 0 0",
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "16px",
    backgroundColor: "#2f3136",
    wordWrap: "break-word",
    position: "relative", // So absolute children are relative to this container
  },
  messageItem: {
    marginBottom: "12px",
    padding: "8px",
    borderRadius: "4px",
    transition: "background-color 0.3s ease",
  },
  timestamp: {
    fontSize: "0.8em",
    color: "#72767d",
    marginTop: "4px",
  },
  backButton: {
    margin: "10px",
    alignSelf: "flex-start",
  }
};

const Preview = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAtTop, setIsAtTop] = useState(true);
  const messagesContainerRef = useRef(null);

  useEffect(() => {
    const fetchMessages = async () => {
      const ddm = new DiscordDataManager();
      const msgs = await ddm.getMessages(id);
      setMessages(msgs || []);
      setLoading(false);
    };
    fetchMessages();
  }, [id]);

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (container) {
      setIsAtTop(container.scrollTop === 0);
    }
  };

  const handlePlusClick = () => {
    if (messages.length > 0) {
      alert(`Earliest message ID: ${messages[0].id}`);
    }
  };

  return (
    <>
      <Helmet>
        <title>Preview Messages - {id}</title>
      </Helmet>
      <div style={widgetStyles.container}>
        <button
          style={widgetStyles.backButton}
          className="btn btn-secondary"
          onClick={() => navigate(-1)}
        >
          Back
        </button>
        <div style={widgetStyles.header}>Preview for File ID: {id}</div>
        {loading ? (
          <div style={{ padding: "16px" }}>Loading preview...</div>
        ) : (
          <div
            style={widgetStyles.messages}
            ref={messagesContainerRef}
            onScroll={handleScroll}
          >
            {/* Plus button is now inside the messages container */}
            {isAtTop && messages.length > 0 && (
            <button
                className={`${styles.plusButton} ${isAtTop ? styles.plusButtonVisible : ""}`}
                onClick={handlePlusClick}
                >
                +
            </button>
            )}
            {messages.length === 0 ? (
              <div>No messages found for this file.</div>
            ) : (
              messages.map((msg, index) => (
                <MessageItem key={index} msg={msg} />
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default Preview;
