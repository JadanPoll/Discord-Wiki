import React, { useEffect, useState, useRef } from "react";
import ReactDOM from "react-dom/client";
import { Helmet } from "react-helmet";
import { Tree } from "react-arborist";
import { parse } from "marked";
import { FaRegStickyNote } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import styles from "./Analyse.module.css";
import { DiscordDataManager } from "../lib/DiscordDataManger";
import { initializeAPI } from "../lib/ShubhanGPT";

/* ============================================================
   Helper Functions
============================================================ */

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

/* ============================================================
   Message & Chat Widget Components
============================================================ */

const Message = ({ message }) => {
  const { user, time, text, avatar, backgroundColor } = message;
  const [isHovered, setIsHovered] = useState(false);

  const messageStyle = {
    display: "flex",
    marginBottom: "16px",
    backgroundColor: isHovered
      ? lightenColor(backgroundColor, 0.1)
      : backgroundColor || "transparent",
    padding: "8px",
    borderRadius: "4px",
    transition: "background-color 0.3s ease",
  };

  return (
    <div
      style={messageStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <img
        src={avatar}
        alt={`${user} Avatar`}
        style={{ width: 40, height: 40, borderRadius: "50%", marginRight: 12 }}
      />
      <div>
        <div style={{ fontSize: "0.85em", color: "#72767d", marginBottom: 4 }}>
          {user} {time && `• ${time}`}
        </div>
        <div style={{ lineHeight: 1.4 }}>{text}</div>
      </div>
    </div>
  );
};

const widgetStyles = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "280px",
    width: "380px",
    border: "1px solid #40444b",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
    backgroundColor: "#36393f",
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    color: "#dcddde",
    pointerEvents: "auto",
    overflowX: "hidden",
  },
  header: {
    backgroundColor: "#2f3136",
    padding: "7px",
    textAlign: "center",
    fontSize: "1.25em",
    fontWeight: "bold",
    borderBottom: "1px solid #40444b",
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
    backgroundColor: "#2f3136",
    padding: "16px",
    wordWrap: "break-word",
    whiteSpace: "pre-wrap",
  },
  inputContainer: {
    backgroundColor: "#2f3136",
    padding: "12px",
    borderTop: "1px solid #40444b",
  },
  input: {
    width: "100%",
    padding: "10px",
    border: "none",
    borderRadius: "5px",
    backgroundColor: "#40444b",
    color: "#dcddde",
    fontSize: "1em",
  },
};

const DiscordChatWidget = ({ messages, channelName }) => (
  <div style={widgetStyles.container}>
    <div style={widgetStyles.header}>{channelName}</div>
    <div className="discord-chat-messages" style={widgetStyles.messages}>
      {messages.map((msg, index) => (
        <Message key={index} message={msg} />
      ))}
    </div>
    <div style={widgetStyles.inputContainer}>
      <input
        type="text"
        style={widgetStyles.input}
        placeholder={`Message ${channelName}`}
      />
    </div>
  </div>
);

/* ============================================================
   Main Analyse Component
============================================================ */

const Analyse = () => {
  const navigate = useNavigate();
  const [activeServerDisc, setActiveServerDisc] = useState(null);
  const [dManager, setDmanager] = useState(null);
  const [messages, setMessages] = useState([]);
  const [generatedSummaryMsg, setGeneratedSummaryMsg] = useState(null);
  const [glossary, setGlossary] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [treeviewData, setTreeviewData] = useState(null);
  const [independentGroups, setIndependentGroups] = useState([]);
  const [conversationBlocks, setConversationBlocks] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedItemText, setSelectedItemText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [shubhanGPTDisplay, setShubhanGPTDisplay] = useState("Summary will appear here.");
  const [loading, setLoading] = useState(false);

  const treeviewContainerRef = useRef(null);
  const treeviewRef = useRef(null);
  const tooltipContainerRef = useRef(null);
  const hideTimeout = useRef(null);

  useEffect(() => {
    const scrollbarStyles = `
      .discord-chat-messages::-webkit-scrollbar {
        width: 12px;
      }
      .discord-chat-messages::-webkit-scrollbar-track {
        background: #2e3338;
        border-radius: 4px;
      }
      .discord-chat-messages::-webkit-scrollbar-thumb {
        background-color: #B0B0B0;
        border-radius: 8px;
        border: 2px solid #2e3338;
      }
      .discord-chat-messages::-webkit-scrollbar-thumb:hover {
        background-color: #A0A0A0;
      }
    `;
    const styleTag = document.createElement("style");
    styleTag.innerHTML = scrollbarStyles;
    document.head.appendChild(styleTag);
    return () => {
      document.head.removeChild(styleTag);
    };
  }, []);

  useEffect(() => {
    window.showTooltipForRange = (event, centerIdx) => {
      const start = Math.max(0, centerIdx - 2);
      const end = Math.min(conversationBlocks.length - 1, centerIdx + 2);
      const msgs = [];

      for (let i = start; i <= end; i++) {
        if (conversationBlocks[i]) {
          msgs.push({
            user: `User${i}`,
            time: `10:${i < 10 ? "0" + i : i}`,
            text: conversationBlocks[i],
            avatar: `https://i.pravatar.cc/40?u=${i}`,
            backgroundColor: i === centerIdx ? "rgba(255, 215, 0, 0.2)" : undefined,
          });
        }
      }
      window.showWidgetTooltip(event, msgs, centerIdx);
    };

    window.showWidgetTooltip = (event, msgs, refIdx) => {
      clearTimeout(hideTimeout.current);
      if (!tooltipContainerRef.current) return;
      const rect = event.target.getBoundingClientRect();
      const tooltipWidth = 300;
      const tooltipHeight = 200;
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      let left = "";
      let top = "";

      if (window.innerWidth - rect.right >= tooltipWidth) {
        left = `${rect.right + 10 + scrollX}px`;
        top = `${rect.top + scrollY}px`;
      } else if (rect.left >= tooltipWidth) {
        left = `${rect.left - tooltipWidth - 10 + scrollX}px`;
        top = `${rect.top + scrollY}px`;
      } else if (window.innerHeight - rect.bottom >= tooltipHeight) {
        left = `${rect.left + scrollX}px`;
        top = `${rect.bottom + 10 + scrollY}px`;
      } else if (rect.top >= tooltipHeight) {
        left = `${rect.left + scrollX}px`;
        top = `${rect.top - tooltipHeight - 10 + scrollY}px`;
      }
      tooltipContainerRef.current.style.left = left;
      tooltipContainerRef.current.style.top = top;
      tooltipContainerRef.current.style.opacity = 1;
      if (tooltipContainerRef.current._reactRoot) {
        tooltipContainerRef.current._reactRoot.unmount();
        delete tooltipContainerRef.current._reactRoot;
      }
      tooltipContainerRef.current._reactRoot = ReactDOM.createRoot(tooltipContainerRef.current);
      tooltipContainerRef.current._reactRoot.render(
        <DiscordChatWidget messages={msgs} channelName={`DMessage ${refIdx}`} />
      );
    };

    window.hideWidgetTooltip = () => {
      clearTimeout(hideTimeout.current);
      hideTimeout.current = setTimeout(() => {
        if (tooltipContainerRef.current && tooltipContainerRef.current._reactRoot) {
          tooltipContainerRef.current.style.opacity = 0;
          tooltipContainerRef.current._reactRoot.unmount();
          delete tooltipContainerRef.current._reactRoot;
        }
      }, 200);
    };

    return () => clearTimeout(hideTimeout.current);
  }, [conversationBlocks]);


  useEffect(() => {
    const fetchFiles = async () => {
      const dmanager = new DiscordDataManager();
      setDmanager(dmanager);
      const tactiveServerDisc = dmanager.getActiveServerDiscSync();
      if (!tactiveServerDisc) return;
      
      setActiveServerDisc(tactiveServerDisc);
      setMessages(await dmanager.getMessages(tactiveServerDisc));
      setGlossary(await dmanager.getGlossary(tactiveServerDisc));
      console.log("Glossary")
      
      // Receive hierarchical relationships directly from dmanager.getRelationships.
      // Assumed format:
      // {
      //   independentGroups: [...],
      //   hierarchicalRelationships: {
      //       topicA: { parent: null, children: ['topicB', 'topicC'] },
      //       topicB: { parent: 'topicA', children: [...] },
      //       ...
      //   }
      // }
      const relationshipsData = await dmanager.getRelationships(tactiveServerDisc);
      setRelationships(relationshipsData);
  
      // Conversation blocks remain unchanged.
      setConversationBlocks(await dmanager.getConversationBlocks(tactiveServerDisc));
      
      // For independent groups (if needed)
      console.log(relationshipsData)
      const groups = Object.keys(relationshipsData);

      // Build treeview data structure from hierarchicalRelationships
      const hierarchicalRelationships  = relationshipsData;
      
      // Recursive helper to build nested tree nodes,
      // and sort children such that nodes with children come first.
      const buildNode = (topicName) => {
        const rel = hierarchicalRelationships[topicName];
        // Create the basic node.
        const node = { id: topicName, name: topicName };

        if (rel.children && rel.children.length > 0) {
          // Build the children recursively.
          let children = rel.children.map(childName => buildNode(childName));
          // Sort: nodes with children come before leaves.
          children.sort((a, b) => {
            const aHasChildren = a.children && a.children.length > 0;
            const bHasChildren = b.children && b.children.length > 0;
            if (aHasChildren && !bHasChildren) return -1;
            if (!aHasChildren && bHasChildren) return 1;
            // If both are similar in having children (or not), sort alphabetically.
            return a.name.localeCompare(b.name);
          });
          node.children = children;
        }
        return node;
      };

  
      // Build treeData: All topics with no parent become tree roots.
      const treeData = [];
      Object.entries(hierarchicalRelationships).forEach(([topicName, rel]) => {
        if (rel.parent === null) {
          treeData.push(buildNode(topicName));
        }
      });
      
      setTreeviewData(treeData);
  
      // Auto-select tree node if URL has a "keyword" parameter.
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has("keyword")) {
        setTimeout(() => {
          treeviewRef.current.select(urlParams.get("keyword"));
        }, 500);
      }
    };
    fetchFiles();
  }, []);
  
  useEffect(() => {
    const keys = [
      "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",
      "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",
      "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",
      "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"
    ];
    window.summaryAPI = initializeAPI(keys);
    window.summaryAPI.registerMessageHandler((message) => {
      console.log("Summary API received message:", message);
      setGeneratedSummaryMsg(message);
      setDisplay(message);
    });
  }, []);

  useEffect(() => {
    if (dManager && activeServerDisc && selectedItem) {
      dManager.setSummary(activeServerDisc, selectedItem, generatedSummaryMsg);
    }
  }, [generatedSummaryMsg]);

  useEffect(() => {
    console.log("This is activating:", selectedItem);
  }, [selectedItem]);

  useEffect(() => {
    const fetchSummary = async () => {
      if (dManager && activeServerDisc && selectedItem) {
        const trySummary = await dManager.getSummary(activeServerDisc, selectedItem);
        if (trySummary) {
          console.log("Summary found for", selectedItem);
          setDisplay(trySummary);
        } else {
          console.log("No summary found for", selectedItem);
          setDisplay("Summary will appear here.");
        }
      }
    };
    fetchSummary();
  }, [selectedItem]);

  const setDisplay = async (message) => {
    console.log("Setting display message:", message);
    const formattedMessage = message.replace(/DMessage ([0-9]+)/g, (_match, p1) => {
      const idx = parseInt(p1, 10);
      return `<span
        style="transition: all 0.3s ease; padding: 2px 4px; border-radius: 4px; cursor: help;"
        onmouseover="window.showTooltipForRange(event, ${idx})"
        onmouseout="window.hideWidgetTooltip()">
          DMessage ${p1}
      </span>`;
    });
    setShubhanGPTDisplay(parse(formattedMessage));
  };

  const generateSummary = async () => {
    if (!selectedItem) {
      alert("Please select content from the treeview to generate a summary.");
      return;
    }
    const maxLength = 22000;
    const truncated =
      selectedItemText.length > maxLength
        ? selectedItemText.slice(0, maxLength) + "..."
        : selectedItemText;
    const prompt = `
“You are an expert summarizer. Given the following chat transcript excerpt about ${selectedItem}, produce a concise summary that:
1. Only includes content directly relevant to ${selectedItem}.
2. Combines high‑quality extractive quotes (with message IDs) and an abstractive overview.
3. Organizes into clear subheadings if multiple themes appear.
4. References messages as (DMessage 10) style.
5. Use the <code> tag to highlight important words, phrases, or central ideas.

Transcript:
${truncated}

Summary:”`;

    setShubhanGPTDisplay("Please wait...");
    setLoading(true);
    try {
      await window.summaryAPI.sendMessage("senShubhan", prompt);
    } finally {
      setLoading(false);
    }
  };

  const renderContentDisplay = () => {
    if (!selectedItem)
      return <>Select an item from the treeview to see the content.</>;
    const indices = glossary[selectedItem]?.[0] || [];
    if (indices.length) {
      return indices.map((i) => (
        <p key={i}>
          <strong>DMessage {i}:</strong> {conversationBlocks[i]}
        </p>
      ));
    }
    return <>No content available for this item.</>;
  };

  function Node({
    node,
    style,
    dragHandle,
    setSelectedItem,
    setSelectedItemText,
    glossary,
    conversationBlocks,
  }) {
    const icon = node.isLeaf ? "💬" : node.isOpen ? "📂" : "📁";

    const handleClick = () => {
      node.toggle();
      console.log("Setting clicked it");
      setSelectedItem(node.data.name);
      const idxArr = glossary[node.data.name]?.[0] || [];
      const text = idxArr
        .map((i) => `DMessage ${i}: ${conversationBlocks[i]}`)
        .join("\n");
      setSelectedItemText(text);
    };

    return (
      <div onClick={handleClick} style={style} ref={dragHandle}>
        {icon} {node.data.name}
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>DWiki | Analyse Data</title>
      </Helmet>
      <div className={styles.contentbody}>
        <div className={styles.treeviewContainer} ref={treeviewContainerRef}>
          <input
            className="form-control mb-2"
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value.trim())}
          />
          <Tree
            initialData={treeviewData}
            disableDrag
            disableDrop
            disableEdit
            disableMultiSelection
            indent={12}
            width={treeviewContainerRef.current?.clientWidth - 40 || 100}
            height={treeviewContainerRef.current?.clientHeight - 78 || 500}
            openByDefault={false}
            searchTerm={searchTerm}
            ref={treeviewRef}
          >
            {({ node, style, dragHandle }) => (
              <Node
                node={node}
                style={style}
                dragHandle={dragHandle}
                setSelectedItem={setSelectedItem}
                setSelectedItemText={setSelectedItemText}
                glossary={glossary}
                conversationBlocks={conversationBlocks}
              />
            )}
          </Tree>
        </div>
        <main className={styles.main}>
          <div className={styles.contentContainer}>
            <button
              id="summaryButton"
              className={`btn ${loading ? "btn-secondary" : "btn-success"}`}
              onClick={generateSummary}
              disabled={loading}
            >
              {loading ? "Generating…" : "Generate Summary"}
            </button>
            <div id="summary-container" className="mt-2">
              <div className={styles.summaryHeader}>
                <h2 className={styles.heading}>Discord Notes</h2>
                <div className={styles.iconWrapper}>
                  <FaRegStickyNote
                    className={styles.notesIcon}
                    onClick={() => navigate(`/notes/${activeServerDisc}`)}
                  />
                </div>
              </div>
              <div
                className={styles.summaryDisplay}
                dangerouslySetInnerHTML={{ __html: shubhanGPTDisplay }}
              />
            </div>
            <h2 className="mt-2">Selected Item Content</h2>
            <div className={styles.contentDisplay}>{renderContentDisplay()}</div>
          </div>
        </main>
      </div>
      <div
        id="tooltip-container"
        ref={tooltipContainerRef}
        style={{
          position: "absolute",
          zIndex: 1000,
          opacity: 0,
          transition: "opacity 0.3s ease",
          pointerEvents: "auto",
        }}
        onMouseOver={() => clearTimeout(hideTimeout.current)}
        onMouseLeave={() => window.hideWidgetTooltip()}
      />
    </>
  );
};

export default Analyse;
