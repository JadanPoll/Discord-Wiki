import React, { useEffect, useState, useRef } from "react"
import { Link } from "react-router-dom"
import { Helmet } from "react-helmet"
import { NodeRendererProps, Tree } from 'react-arborist'
import { parse } from 'marked'
import { Tooltip } from 'react-tooltip'

import styles from './Analyse.module.css'

import { DiscordDataManager } from "./lib/DiscordDataManger"
import { initializeAPI } from './lib/ShubhanGPT'

const Analyse = () => {
  /* This page does not use any effects/states. Changing anything will require a refresh. */
  const [activedb, setActivedb] = useState(null)
  const [messages, setMessages] = useState([])
  const [glossary, setGlossary] = useState([])
  const [relationships, setRelationships] = useState([])
  const [treeviewData, setTreeviewData] = useState(null)
  const [independentGroups, setIndependentGroups] = useState([])
  const [conversationBlocks, setConverationBlocks] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [selectedItemText, setSelectedItemText] = useState("") // for GPT
  const [searchTerm, setSearchTerm] = useState("")
  const defaultSummary = "Summary will appear here."
  const [shubhanGPTDisplay, setShubhanGPTDisplay] = useState(defaultSummary)
  const [loading, setLoading] = useState(false)                // ← new loading state

  const treeviewContainerRef = useRef(null)
  const treeviewRef = useRef(null)

  useEffect(() => {
    const fetchFiles = async () => {
      const dmanager = new DiscordDataManager()
      const tactivedb = dmanager.getActiveDBSync()
      if (!tactivedb) return

      setActivedb(tactivedb)
      setMessages(await dmanager.getMessages(tactivedb))
      setGlossary(await dmanager.getGlossary(tactivedb))
      setRelationships(await dmanager.getRelationships(tactivedb))
      setConverationBlocks(await dmanager.getConversationBlocks(tactivedb))

      // Build treeviewData from relationships
      const treeData = []
      const groupMap = new Map()

      // (Assuming independentGroups is empty for now)
      independentGroups.forEach(group => {
        treeData.push({ id: group, name: group })
        groupMap.set(group, { id: group, name: group, children: [] })
      })

      for (const [grp, rel] of Object.entries(await dmanager.getRelationships(tactivedb))) {
        if (!groupMap.has(grp)) {
          const newGroup = { id: grp, name: grp, children: [] }
          treeData.push(newGroup)
          groupMap.set(grp, newGroup)
        }
        rel.subgroups.forEach(sub => {
          if (!groupMap.has(sub)) {
            groupMap.set(sub, { id: sub, name: sub, children: [] })
          } else {
            const idx = treeData.indexOf(groupMap.get(sub))
            if (idx > -1) treeData.splice(idx, 1)
          }
          groupMap.get(grp).children.push(groupMap.get(sub))
        })
      }

      // prune empty children
      const queue = [...treeData]
      while (queue.length) {
        const el = queue.pop()
        if (!el.children) continue
        if (el.children.length) queue.push(...el.children)
        else delete el.children
      }

      setIndependentGroups(independentGroups)
      setTreeviewData(treeData)

      // optional: auto-select via URL param
      const urlParams = new URLSearchParams(window.location.search)
      if (urlParams.has("keyword")) {
        setTimeout(() => {
          treeviewRef.current.select(urlParams.get("keyword"))
        }, 500)
      }
    }

    fetchFiles()
  }, [])

  // Initialize the summary WebSocket
  useEffect(() => {
    const keys = [
      "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",
      "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",
      "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"
    ]
    window.summaryAPI = initializeAPI(keys)
    window.summaryAPI.registerMessageHandler((message) => {
      message = message.replace(/DMessage ([0-9]+)/g, (_m, p1) => {
        try {
          const idx = parseInt(p1, 10)
          const msg = conversationBlocks[idx].replaceAll("'", "&quot;")
          //return `<abbr title='${msg}'>DMessage ${p1}</abbr>`

          return `<abbr 
          title='${msg}' 
          style="transition: background-color 0.2s ease; padding: 2px 4px; border-radius: 4px; cursor: help;"
          onmouseover="this.style.backgroundColor='#e6e0f8'" 
          onmouseout="this.style.backgroundColor='transparent'"
        >DMessage ${p1}</abbr>`
        } catch {
          return `DMessage ${p1}`
        }
      })
      setShubhanGPTDisplay(parse(message))
    })
  }, [conversationBlocks])

  // Generate summary with loading toggle
  const generateSummary = async () => {
    if (selectedItem === null) {
      alert("Please select content from the treeview to generate a summary.")
      return
    }

    const maxLength = 22000
    const truncated = selectedItemText.length > maxLength
      ? selectedItemText.slice(0, maxLength) + "..."
      : selectedItemText

    const prompt = `Don't include in summary information that doesn't relate to the topic specified in: Topic <Topic_Name>. Summarize this combining abstractive and high-quality extractive. Don't miss any details in it. Reference specific messages in your response Eg:(DMessage 10). If possible break it into subheadings: ${truncated}`

    setShubhanGPTDisplay("Please wait...")
    setLoading(true)
    try {
      await window.summaryAPI.sendMessage("senShubhan", prompt)
    } finally {
      setLoading(false)
    }
  }

  // Render content for selected item
  const renderContentDisplay = () => {
    if (!selectedItem) return <>Select an item from the treeview to see the content.</>
    const indices = glossary[selectedItem]?.[0] || []
    if (indices.length) {
      return indices.map(i => (
        <p key={i}>
          <strong>DMessage {i}:</strong> {conversationBlocks[i]}
        </p>
      ))
    }
    if (relationships[selectedItem]) {
      const subs = relationships[selectedItem].subgroups.join(", ")
      return <><strong>{selectedItem}</strong><br/>Subgroups: {subs}</>
    }
    if (independentGroups.includes(selectedItem)) {
      return <><strong>{selectedItem}</strong><br/>This is an independent group.</>
    }
    return <>No content available for this item.</>
  }

  // Custom node renderer
  function Node({ node, style, dragHandle }) {
    const custom = {}
    if (node.isSelected) {
      custom.backgroundColor = '#557DFE'
      custom.color = 'white'
      if (node.data.name !== selectedItem) {
        setShubhanGPTDisplay(defaultSummary)
      }
      setSelectedItem(node.data.name)

      const idxArr = glossary[node.data.name]?.[0] || []
      const text = idxArr.map(i => `DMessage ${i}: ${conversationBlocks[i]}`).join('\n')
      setSelectedItemText(text)
    }

    let icon = node.isLeaf ? '💬' : node.isOpen ? '📂' : '📁'
    return (
      <div onClick={() => node.toggle()} style={{ ...style, ...custom }} ref={dragHandle}>
        {icon} {node.data.name}
      </div>
    )
  }

  return (
    <>
      <Helmet><title>DWiki | Analyse Data</title></Helmet>
      <div className={styles.contentbody}>
        <div className={styles.treeviewContainer} ref={treeviewContainerRef}>
          <input
            className="form-control mb-2"
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value.trim())}
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
            <div className={styles.contentDisplay}>
              {renderContentDisplay()}
            </div>
          </div>
        </main>
      </div>
    </>
  )
}

export default Analyse
