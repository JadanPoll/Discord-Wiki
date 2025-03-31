import React, { useEffect, useState, useRef, useLayoutEffect } from "react"
import { Link } from "react-router-dom"
import { Helmet } from "react-helmet"
import { NodeRendererProps, Tree } from 'react-arborist'
import { parse } from 'marked'
import { Tooltip } from 'react-tooltip'

import styles from './Analyse.module.css'

import { DiscordDataManager } from "./lib/DiscordDataManger"
import { initializeAPI } from './lib/ShubhanGPT'

const Analyse = () => {

    /* This page does not use any effects/states. Changing anything will require a refresh.
    */
    let [activedb, setActivedb] = useState(null)

    let [messages, setMessages] = useState([])
    let [glossary, setGlossary] = useState([])
    let [relationships, setRelationships] = useState([])

    let [treeviewData, setTreeviewData] = useState(null)
    let [independentGroups, setIndependentGroups] = useState([])

    let [conversationBlocks, setConverationBlocks] = useState([])

    let [selectedItem, setSelectedItem] = useState(null)
    let [selectedItemText, setSelectedItemText] = useState(null) // for GPT

    let [searchTerm, setSearchTerm] = useState("")

    const defaultSummary = "Summary will appear here."
    let [shubhanGPTDisplay, setShubhanGPTDisplay] = useState(defaultSummary)

    let treeviewContainerRef = useRef(null)
    let treeviewRef = useRef(null)

    useEffect(() => {
        const fetchFiles = async () => {
            let dmanager = new DiscordDataManager()

            // prefix t- denotes copy of respective effects available immediately
            // since effects are added async'ly.
            let tactivedb = dmanager.getActiveDBSync()

            if (tactivedb === "") {
                return <h2>Analyse: No data found!</h2>
            }

            setActivedb(tactivedb)
            let tmessages = await dmanager.getMessages(tactivedb)
            setMessages(tmessages)
            let tglossary = await dmanager.getGlossary(tactivedb)
            setGlossary(tglossary)
            let trelationships = await dmanager.getRelationships(tactivedb)
            setRelationships(trelationships)
            let tconvgroups = await dmanager.getConversationBlocks(tactivedb)
            setConverationBlocks(tconvgroups)

            let independentGroups = []

            let treeData = []
            let groupMap = new Map()

            // Add independent groups
            independentGroups.forEach(group => {
                treeData.push({ id: group, name: group })
                groupMap.set(group, { id: group, name: group, children: [] })
            })

            // Add hierarchical relationships
            for (const [grp, rel] of Object.entries(trelationships)) {
                if (!groupMap.has(grp)) {
                    const newGroup = { id: grp, name: grp, children: [] };
                    treeData.push(newGroup);
                    groupMap.set(grp, newGroup);
                }

                rel.subgroups.forEach(subgroup => {
                    if (!groupMap.has(subgroup)) {
                        groupMap.set(subgroup, { id: subgroup, name: subgroup, children: [] });
                    }
                    else {
                        const indexToRemove = treeData.indexOf(groupMap.get(subgroup));
                        if (indexToRemove > -1) {
                            treeData.splice(indexToRemove, 1);
                        }
                    }
                    groupMap.get(grp).children.push(groupMap.get(subgroup));
                });
            }

            // remove empty children by performing traversal. Needed for Node.isLeaf.
            let queue = [...treeData]

            while (queue.length > 0) {
                let element = queue.pop()
                if (!('children' in element)) continue
                if (element.children.length > 0) {
                    queue.push(...element.children)
                }
                else {
                    delete element.children
                }
            }

            setIndependentGroups(independentGroups)
            setTreeviewData(treeData)

            // load predefined keyword
            let urlParams = new URLSearchParams(window.location.search);
            if (!urlParams.has("keyword")) return; //abort
            let keyword = urlParams.get('keyword')

            setTimeout(function () {
                treeviewRef.current.select(keyword)
            }, 1000);
        }

        fetchFiles()

        return () => { }
    }, [])

    // Start the WebSocket and register handler for incoming AI messages
    let startSummaryFeature = () => {

        //Security ISSUE!!!
        const keys = ["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", "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", "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"]
        window.summaryAPI = initializeAPI(keys)

        window.summaryAPI.registerMessageHandler((message) => {
            // attempt to replace DMessage n with tooltip
            message = message.replace(/DMessage ([0-9]+)/g, (_match, p1, _offset, _string, _groups) => {
                try {
                    let n = p1 * 1
                    let msg = conversationBlocks[n].replaceAll("'", "&quot;")
                    return `<abbr title='${msg}'>DMessage ${p1}</abbr>`
                } catch (error) {
                    // pass
                    return `DMessage ${p1}`
                }
            })
            setShubhanGPTDisplay(parse(message)) // Display the incoming AI-generated summary
        })
    }

    startSummaryFeature()

    let renderContentDisplay = () => {
        if (selectedItem === null) return <>Select an item from the treeview to see the content.</>

        const contentIndexArray = glossary[selectedItem]?.[0] || []

        if (contentIndexArray.length > 0) {
            return contentIndexArray.map((ind) => {
                return <p><strong> DMessage {ind}:</strong> {conversationBlocks[ind]}</p>
            })
        } else if (relationships[selectedItem]) {
            const subgroups = relationships[selectedItem].subgroups.join(", ");
            return <><strong>{selectedItem}</strong><br />Subgroups: {subgroups}</>
        } else if (independentGroups.includes(selectedItem)) {
            return <><strong>{selectedItem}</strong><br />This is an independent group.</>
        } else {
            return <>No content available for this item.</>
        }
    }

    let generateSummary = () => {
        if (selectedItem === null) {
            alert("Please select content from the treeview to generate a summary.")
            return
        }
        const maxLength = 22000
        const truncatedContent = selectedItemText.length > maxLength
            ? selectedItemText.substring(0, maxLength) + "..."
            : selectedItemText
        const prompt = `Don't include in summary information that doesn't relate to the topic specified in: Topic <Topic_Name>. Summarize this combining abstractive and high-quality extractive. Don't miss any details in it. Reference specific messages in your response Eg:(DMessage 10). If possible break it into subheadings: ${truncatedContent}`
        console.log(prompt)
        setShubhanGPTDisplay("Please wait...")
        window.summaryAPI.sendMessage("senShubhan", prompt)
    }


    // https://github.com/brimdata/react-arborist
    function Node({ node, style, dragHandle }) {
        /* This node instance can do many things. See the API reference. */
        let customstyle = Object.create(null)
        if (node.isSelected) {
            customstyle.backgroundColor = '#557DFE'
            customstyle.color = 'white'
            if (node.data.name !== selectedItem) {
                setShubhanGPTDisplay(defaultSummary)
            }
            setSelectedItem(node.data.name)

            const contentIndexArray = glossary[selectedItem]?.[0] || []
            let itemtext = contentIndexArray.map((ind) => {
                return `DMessage ${ind}: ${conversationBlocks[ind]}`
            }).join('\n')
            setSelectedItemText(itemtext)
        }
        let icon = ''
        if (node.isLeaf) icon = '💬'
        else if (node.isOpen) icon = '📂'
        else icon = '📁'

        return (
            <div onClick={() => node.toggle()}
                style={{ ...style, ...customstyle }}
                ref={dragHandle}>
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
                    <div>
                        <input className="form-control" type="text" placeholder="Search..." value={searchTerm} onChange={(e) => {
                            setSearchTerm(e.target.value.trim())
                        }} />
                    </div>
                    <Tree initialData={treeviewData}
                        disableDrag={true}
                        disableDrop={true}
                        disableEdit={true}
                        disableMultiSelection={true}
                        indent={12}
                        width={treeviewContainerRef.current ? treeviewContainerRef.current.clientWidth - 40 : 100}
                        height={treeviewContainerRef.current ? treeviewContainerRef.current.clientHeight - 78 : 500}
                        openByDefault={false}
                        searchTerm={searchTerm}
                        ref={treeviewRef}>

                        {Node}
                    </Tree>
                </div>
                <main className={styles.main}>
                    <div className={styles.contentContainer}>
                        <button id="summaryButton" className="btn btn-secondary" onClick={() => { generateSummary() }}>Generate Summary</button>
                        <div id="summary-container" className="mt-2">
                            <h2 className={styles.heading}>AI Summary</h2>
                            <div className={styles.summaryDisplay} dangerouslySetInnerHTML={{ __html: shubhanGPTDisplay }}>
                            </div>
                        </div>
                        <h2 className="mt-2">Selected Item Content</h2>
                        <div class={styles.contentDisplay}>
                            {renderContentDisplay()}
                        </div>
                    </div>
                </main>
            </div>

        </>
    )
};

export default Analyse
