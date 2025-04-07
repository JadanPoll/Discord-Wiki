
import React, { useEffect, useState, useRef } from "react";
import ReactDOM from "react-dom/client";
import { Helmet } from "react-helmet";
import { Tree } from "react-arborist";
import { parse } from "marked";

import styles from "./Analyse.module.css";
import { DiscordDataManager } from "./lib/DiscordDataManger";
import { initializeAPI } from "./lib/ShubhanGPT";

// ---------------------------
// Message component for the chat widget
const Message = ({ message }) => {
    const { user, time, text, avatar, backgroundColor } = message;
    const [isHovered, setIsHovered] = useState(false);
  
    const messageStyle = {
      display: "flex",
      marginBottom: "16px",
      backgroundColor: isHovered
        ? lightenColor(backgroundColor, 0.1) // Lighten on hover
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
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            marginRight: 12,
          }}
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
  
  function lightenColor(color, percent) {
    if (!color || color === "transparent") return "rgba(255,255,255,0.1)";
  
    if (color.startsWith("rgb")) {
        // Extract RGB(A) values
        const match = color.match(/\d+(\.\d+)?/g);
        if (!match) return color;
      
        let [r, g, b, a] = match.map(Number);
        a = a !== undefined ? Math.min(1, a + percent) : Math.min(1, percent + 1); // Deepen opacity
      
        return `rgba(${r},${g},${b},${a})`;
      }
      
  
    // Handle hex color
    if (color.startsWith("#")) {
      let num = parseInt(color.slice(1), 16);
      let amt = Math.round(255 * percent);
  
      let r = Math.min(255, (num >> 16) + amt);
      let g = Math.min(255, ((num >> 8) & 0x00ff) + amt);
      let b = Math.min(255, (num & 0x0000ff) + amt);
  
      return `rgb(${r},${g},${b})`;
    }
  
    return color; // Fallback for unknown formats
  }
    
  
// ---------------------------
// Styles for the DiscordChatWidget tooltip
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
  
  // Inject custom scrollbar styles for the widget's messages container
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
  
  // ---------------------------
  // Main widget component using your provided definition
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
  
// ---------------------------
// Main Analyse component
const Analyse = () => {
  const [activedb, setActivedb] = useState(null);
  const [messages, setMessages] = useState([]);
  const [glossary, setGlossary] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [treeviewData, setTreeviewData] = useState(null);
  const [independentGroups, setIndependentGroups] = useState([]);
  const [conversationBlocks, setConverationBlocks] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedItemText, setSelectedItemText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const defaultSummary = "Summary will appear here.";
  const [shubhanGPTDisplay, setShubhanGPTDisplay] = useState(defaultSummary);
  const [loading, setLoading] = useState(false);

  const treeviewContainerRef = useRef(null);
  const treeviewRef = useRef(null);
  const tooltipContainerRef = useRef(null);
  let hideTimeout = useRef(null);

  // ---------------------------
  // Tooltip logic (show/hide) with hover persistence
  useEffect(() => {
    window.showTooltipForRange = (event, centerIdx) => {
      const start = Math.max(0, centerIdx - 2);
      const end = Math.min(conversationBlocks.length - 1, centerIdx + 2);
      const msgs = [];

      for (let i = start; i <= end; i++) {
        if (conversationBlocks[i]) {
          const text = conversationBlocks[i];
          msgs.push({
            user: `User${i}`,
            time: `10:${i < 10 ? "0" + i : i}`,
            text,
            avatar: `https://i.pravatar.cc/40?u=${i}`,
            backgroundColor: i === centerIdx ? "rgba(255, 215, 0, 0.2)" : undefined // Light peach background only for centerIdx
          });
        }
      }
      window.showWidgetTooltip(event, msgs, centerIdx);
    };

    window.showWidgetTooltip = (event, msgs, refIdx) => {
      clearTimeout(hideTimeout.current);
      if (!tooltipContainerRef.current) return;
    
      // Get the target element's bounding rectangle
      const rect = event.target.getBoundingClientRect();
    
      // Define tooltip dimensions
      const tooltipWidth = 300;  // Set or calculate the width of your tooltip
      const tooltipHeight = 200; // Set or calculate the height of your tooltip
    
      // Calculate available space around the target element
      const spaceOnRight = window.innerWidth - rect.right;
      const spaceOnLeft = rect.left;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
    
      // Use scroll offsets for accurate positioning relative to the whole page
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
    
      // Initialize variables for tooltip positioning
      let left = '';
      let top = '';
      let transform = '';
    
      // Position the tooltip based on available space
      if (spaceOnRight >= tooltipWidth) {
        // Enough space on the right side of the target
        left = `${rect.right + 10 + scrollX}px`;
        top = `${rect.top + scrollY}px`;
        transform = 'translateX(0)';
      } else if (spaceOnLeft >= tooltipWidth) {
        // Enough space on the left side of the target
        left = `${rect.left - tooltipWidth - 10 + scrollX}px`;
        top = `${rect.top + scrollY}px`;
        transform = 'translateX(0)';
      } else if (spaceBelow >= tooltipHeight) {
        // Enough space below the target
        left = `${rect.left + scrollX}px`;
        top = `${rect.bottom + 10 + scrollY}px`;
        transform = 'translateY(0)';
      } else if (spaceAbove >= tooltipHeight) {
        // Enough space above the target
        left = `${rect.left + scrollX}px`;
        top = `${rect.top - tooltipHeight - 10 + scrollY}px`;
        transform = 'translateY(0)';
      }
    
      // Apply the calculated position to the tooltip container
      tooltipContainerRef.current.style.left = left;
      tooltipContainerRef.current.style.top = top;
      tooltipContainerRef.current.style.opacity = 1;
    
      // Render the tooltip component (ensure React root is properly managed)
      if (tooltipContainerRef.current._reactRoot) {
        tooltipContainerRef.current._reactRoot.unmount();
        delete tooltipContainerRef.current._reactRoot;
      }
    
      tooltipContainerRef.current._reactRoot = ReactDOM.createRoot(
        tooltipContainerRef.current
      );
      tooltipContainerRef.current._reactRoot.render(
        <DiscordChatWidget messages={msgs} channelName={`DMessage ${refIdx}`} />
      );
    };
    

    window.hideWidgetTooltip = () => {
      clearTimeout(hideTimeout.current);
      hideTimeout.current = setTimeout(() => {
        if (
          tooltipContainerRef.current &&
          tooltipContainerRef.current._reactRoot
        ) {
          tooltipContainerRef.current.style.opacity = 0;
          tooltipContainerRef.current._reactRoot.unmount();
          delete tooltipContainerRef.current._reactRoot;
        }
      }, 200);
    };

    return () => clearTimeout(hideTimeout.current);
  }, [conversationBlocks]);

  // ---------------------------
  // Fetch files and prepare data
  useEffect(() => {
    const fetchFiles = async () => {
      const dmanager = new DiscordDataManager();
      const tactivedb = dmanager.getActiveDBSync();
      if (!tactivedb) return;

      setActivedb(tactivedb);
      setMessages(await dmanager.getMessages(tactivedb));
      setGlossary(await dmanager.getGlossary(tactivedb));
      setRelationships(await dmanager.getRelationships(tactivedb));
      setConverationBlocks(await dmanager.getConversationBlocks(tactivedb));

      const groups = Object.keys(await dmanager.getRelationships(tactivedb));
      setIndependentGroups(groups);

      const treeData = [];
      const groupMap = new Map();
      groups.forEach((grp) => {
        const node = { id: grp, name: grp, children: [] };
        treeData.push(node);
        groupMap.set(grp, node);
      });

      const allRels = await dmanager.getRelationships(tactivedb);
      for (const [grp, rel] of Object.entries(allRels)) {
        rel.subgroups.forEach((sub) => {
          if (!groupMap.has(sub)) {
            groupMap.set(sub, { id: sub, name: sub, children: [] });
          }
          groupMap.get(grp).children.push(groupMap.get(sub));
        });
      }

      const queue = [...treeData];
      while (queue.length) {
        const el = queue.pop();
        if (el.children?.length) queue.push(...el.children);
        else delete el.children;
      }

      setTreeviewData(treeData);

      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has("keyword")) {
        setTimeout(() => {
          treeviewRef.current.select(urlParams.get("keyword"));
        }, 500);
      }
    };

    fetchFiles();
  }, []);

  // ---------------------------
  // Initialize summary API and handler
  useEffect(() => {
    const keys = [
        "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",
        "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",
        "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",
      ];
    window.summaryAPI = initializeAPI(keys);

    window.summaryAPI.registerMessageHandler((message) => {

      //activedb.setSummary(activedb, selectedItem, message);

      message = message.replace(/DMessage ([0-9]+)/g, (_m, p1) => {
        const idx = parseInt(p1, 10);
        return `<span
          style="transition: all 0.3s ease; padding: 2px 4px; border-radius: 4px; cursor: help;"
          onmouseover="window.showTooltipForRange(event, ${idx})"
          onmouseout="window.hideWidgetTooltip()">
            DMessage ${p1}
        </span>`;
      });
      setShubhanGPTDisplay(parse(message));
    });
  }, [conversationBlocks]);

  // ---------------------------
  // Generate summary
  const generateSummary = async () => {
    if (selectedItem === null) {
      alert("Please select content from the treeview to generate a summary.");
      return;
    }
    const maxLength = 22000;
    const truncated =
      selectedItemText.length > maxLength
        ? selectedItemText.slice(0, maxLength) + "..."
        : selectedItemText;
    //const prompt = `Don't include in summary information that doesn't relate to the topic specified in: Topic <Topic_Name>. Summarize this combining abstractive and high-quality extractive. Don't miss any details in it. Reference specific messages in your response Eg:(DMessage 10). If possible break it into subheadings: ${truncated}`;
    let topic_name = selectedItem
    const prompt = `
    “You are an expert summarizer. Given the following chat transcript excerpt about ${topic_name}, produce a concise summary that:
    1. Only includes content directly relevant to ${topic_name}.
    2. Combines high‑quality extractive quotes (with message IDs) and an abstractive overview.
    3. Organizes into clear subheadings if multiple themes appear.
    4. References messages as (DMessage 10) style.
    5. Use the <code> tag to highlight important words, phrases, or central ideas.
    
    Transcript:
    ${truncated}
    
    Summary:”
    `
    
    setShubhanGPTDisplay("Please wait...");
    setLoading(true);
    try {
      await window.summaryAPI.sendMessage("senShubhan", prompt);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------
  // Render selected item content
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
    if (relationships[selectedItem]) {
      const subs = relationships[selectedItem].subgroups.join(", ");
      return (
        <>
          <strong>{selectedItem}</strong>
          <br />
          Subgroups: {subs}
        </>
      );
    }
    if (independentGroups.includes(selectedItem)) {
      return (
        <>
          <strong>{selectedItem}</strong>
          <br />
          This is an independent group.
        </>
      );
    }
    return <>No content available for this item.</>;
  };

  // ---------------------------
  // Custom node renderer
  function Node({ node, style, dragHandle }) {
    const isSelected = node.isSelected;
    useEffect(() => {
      if (isSelected) {
        setSelectedItem(node.data.name);
        const idxArr = glossary[node.data.name]?.[0] || [];
        const text = idxArr
          .map((i) => `DMessage ${i}: ${conversationBlocks[i]}`)
          .join("\n");
        setSelectedItemText(text);
      }
    }, [isSelected, node.data.name]);

    let icon = node.isLeaf ? "💬" : node.isOpen ? "📂" : "📁";
    return (
      <div onClick={() => node.toggle()} style={style} ref={dragHandle}>
        {icon} {node.data.name}
      </div>
    );
  }

  // ---------------------------
  // Main render
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
            {Node}
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
              <h2 className={styles.heading}>AI Summary</h2>
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

      {/* Tooltip container */}
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
        onMouseOver={() => {
          console.log("Tooltip mouse enter");
          clearTimeout(hideTimeout.current);
        }}
        onMouseLeave={() => {
          console.log("Tooltip mouse leave");
          window.hideWidgetTooltip();
        }}
      />
    </>
  );
};

export default Analyse;
