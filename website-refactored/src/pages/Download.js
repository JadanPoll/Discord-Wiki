import React, { useEffect, useState, useRef, useLayoutEffect } from "react"

import styles from './Download.module.css'

import { Helmet } from "react-helmet"

import { useNavigate } from 'react-router-dom';


import { DiscordClient } from "./lib/DiscordClient"
import { DiscordAPI } from "./lib/DiscordAPI"

import { DiscordDataManager } from "./lib/DiscordDataManger"
import { engineAnalyseDriver } from "./lib/EngineAnalyseDriver"

// we should honestly make these shorter
import { loadConversationEngine, processAllContextChains, calculateGlossary, calculateDisplayGlossary } from './lib/engine2.js'

import tokenimg1 from "./static/discord-tut-images/discord-token-tut-img1.webp"
import tokenimg2 from "./static/discord-tut-images/discord-token-tut-img2.webp"
import tokenimg3 from "./static/discord-tut-images/discord-token-tut-img3.webp"
import tokenimg4 from "./static/discord-tut-images/discord-token-tut-img4.webp"

const Download = () => {

    const WS_URL = 'wss://gateway.discord.gg/?encoding=json&v=9&compress=zlib-stream' // Discord WS URL

    const navigate = useNavigate();
    // states
    const [token, setToken] = useState("")

    const [isLoadingServers, setIsLoadingServers] = useState(false);

    /* For POPUP ONLY, not necessarily the final server selected */

    // is a server selected?
    const [isServerSelected, setServerSelected] = useState(false)

    /* servers a map of servers loaded during the first stage of DL.
    it maps serverID to {serverName: string, channels: json}. */
    const [servers, setServers] = useState(Object.create(null))

    // currently selected server
    const [selectedServer, setSelectedServer] = useState(null)

    // ref's for server grids
    const gridButtonRef = useRef(Object.create(null))

    // position for popup
    const [popupVisible, setpopupVisible] = useState(false)
    const [popupleft, setPopupleft] = useState(0)
    const [popupTop, setPopupTop] = useState(0)
    const [popuptransform, setPopuptransform] = useState(0)

    /* END for POPUP*/

    // is a channel selected
    const [isChannelSelected, setChannelSelected] = useState(false)

    const [selectedChannelId, setSelectedChannelid] = useState(null)

    const [numMsg, setNumMsg] = useState(2000)

    const [message, setMessage] = useState("Waiting for token submission...")

    // progressbar
    const [prgsModal, setPrgsModal] = useState(null)
    const [prgsbarValue, setprgsbarValue] = useState(0)
    const prgsModalRef = useRef(0)

    // hide prgsbar before leaving page
    useLayoutEffect(() => {
        return () => {
            if (prgsModal !== null) {
                prgsModal.hide()
            }
        }
    }, [prgsModal])

    // Set styles
    useEffect(() => {
        let root = document.getElementById("root")
        root.style.backgroundColor = "#090d1e"
        root.style.margin = 0
        root.style.padding = 0
        root.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
        root.style.color = "white"

        return () => {
            // revert to fallback styling
            let root = document.getElementById("root")
            root.style.backgroundColor = null
            root.style.margin = null
            root.style.padding = null
            root.style.fontFamily = null
            root.style.color = null
        }
    })

    // Handle Token submissions (getting servers)
    const onTokenSubmit = async (e) => {
        e.preventDefault();
   
        setIsLoadingServers(true); // Set loading to true when the process starts.
   
        const discordToken = token.trim();
        if (discordToken) {
            console.log('Connecting with provided token...');
            const client = new DiscordClient(WS_URL, discordToken, (json) => {
                // callback for when all data is read
   
                console.log("Data received: ", json);
   
                // build list of objects, as described before channels
                let serverList = Object.create(null);
                for (const server of json.d.guilds) {
                    let serverName = server.properties.name;
                    let serverID = server.properties.id;
                    let channels = server.channels;
                    let permission_id = server.id;
                    let properties_icon = server.properties.icon;
   
                    serverList[serverID] = { serverName: serverName, channels: channels, permission_id: permission_id, properties_icon: properties_icon };
                }
   
                setServers(serverList);
                setServerSelected(true);
                setMessage("Please select a channel.");
                setIsLoadingServers(false); // Set loading to false when the process is done.
            });
            client.connect();
        }
        else {
            alert('Invalid token. Please enter a valid Discord token.');
            setIsLoadingServers(false); // Set loading to false if the token is invalid.
        }
    };
   
    // Handle popup open
    const showPopup = (id) => {
        setSelectedServer(id);
        setpopupVisible(true);
    
        // Retrieve the button using the gridButtonRef
        const button = gridButtonRef.current[id];
        if (!button) return;
    
        // Initialize variables for popup positioning
        let left = '';
        let top = '';
        let transform = '';
    
        // Get button's bounding rectangle relative to the viewport
        const serverItemRect = button.getBoundingClientRect();
        console.log(serverItemRect);
    
        // Define popup dimensions
        const popupWidth = 300; // Match the CSS defined width
        const popupHeight = 200; // Define or compute the popup's height if applicable
    
        // Calculate available space on the right, left, and below the button.
        // Note: getBoundingClientRect() values are relative to the viewport so we add scroll offsets.
        const spaceOnRight = window.innerWidth - serverItemRect.right;
        const spaceOnLeft = serverItemRect.left;
        const spaceBelow = window.innerHeight - serverItemRect.bottom;
    
        // Use scroll offsets to position the popup in relation to the full page
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;
    
        // Position the popup based on available space
        if (spaceOnRight >= popupWidth) {
            // Enough space on the right
            left = `${serverItemRect.right + 10 + scrollX}px`;
            top = `${serverItemRect.top + scrollY}px`;
            transform = 'translateX(0)';
        } else if (spaceOnLeft >= popupWidth) {
            // Enough space on the left
            left = `${serverItemRect.left - popupWidth - 10 + scrollX}px`;
            top = `${serverItemRect.top + scrollY}px`;
            transform = 'translateX(0)';
        } else if (spaceBelow >= popupHeight) {
            // If not enough horizontal space, place the popup below the button
            left = `${serverItemRect.left + scrollX}px`;
            top = `${serverItemRect.bottom + 10 + scrollY}px`;
            transform = 'translateY(0)';
        } else {
            // If space below is insufficient, try positioning the popup above the button
            left = `${serverItemRect.left + scrollX}px`;
            top = `${serverItemRect.top - popupHeight - 10 + scrollY}px`;
            transform = 'translateY(0)';
        }
    
        // Update popup state with the calculated values
        setPopupleft(left);
        setPopupTop(top);
        setPopuptransform(transform);
    
        // Log additional data if needed
        console.log('Yemen', servers[id].channels);
    };
    
    const closePopup = () => {
        setpopupVisible(false)
    }

    const selectChannel = (channelid, channelname, servername) => {
        setMessage(`Selected ${servername} > ${channelname} (${channelid})`)
        setChannelSelected(true)
        setSelectedChannelid({
            channelid: channelid,
            channelname: (servername + '_' + channelname).replace(/[^\w]/g, '_')
        });
        setpopupVisible(false)
    }

    const loadData = async (e) => {
        e.preventDefault()

        // Init'ise modal
        // create backup var, for setPrgsModal is async
        let prg = new window.bootstrap.Modal(prgsModalRef.current, { keyboard: false })
        setPrgsModal(prg)

        // Fetch and process values
        const authToken = token.trim();
        let numMsgProcessed = 0
        try {
            numMsgProcessed = numMsg * 1
        }
        catch (error) {
            alert("Invalid value of number of messages")
            console.log(error)
            return
        }

        const channelId = selectedChannelId.channelid
        const channelName = selectedChannelId.channelname
        prg.show()

        console.log(`Initiating download from ${channelId}: numMsg = ${numMsgProcessed}`)

        const discordAPI = new DiscordAPI(authToken)
        const searchOptions = {
            author_id: null,
            mentions: null,
            has: [],
            pinned: false,
            before: null,
            after: null,
            limit: numMsgProcessed
        };

        const messages = await discordAPI.fetchChannelMessages(channelId, searchOptions, (msglength, totalmsg) => {
            setprgsbarValue(msglength / totalmsg * 80)
        })

        if (!messages || messages.length < 0) {
            alert("Invalid messages received.")
            prg.hide()
            return
        }

        // save data
        let filename = `${channelId}_${Date.now()}`

        let dataManager = new DiscordDataManager()

        let nickname = ""
        
        const defaultName = channelName || "my_channel";
        for (;;) {

            nickname = prompt("What name would you like to give to this file? You may only use alphanumerics and underbars(_).",defaultName)

            let dbs = await dataManager.getDBServersObjList()
            if (/^\w*$/.test(nickname)) break;
            alert("You may only use alphanumerics and underbars(_).");
        }

        if (nickname === null) nickname = defaultName

        console.log(`saving as ${nickname}`)

        let messagesStr = JSON.stringify(messages)

        let result = await engineAnalyseDriver(messagesStr, filename)

        setprgsbarValue(100)

        if (result.status === true) {
            await dataManager.setGlossary(filename, result.glossary)
            await dataManager.setRelationships(filename, result.tree)

            await dataManager.setConversationBlocks(filename, result.blocks)
        }
        else {
            console.error(`CANNOT ANALYSE DATA: ${result.message}`)
            alert(`CANNOT ANALYSE DATA: ${result.message}`)

            navigate(0);
            return
        }

        let gameDiscImageUrl = null;

        // Check if `servers[selectedServer].properties_icon` is not null
        if (servers[selectedServer] && servers[selectedServer].properties_icon) {
            gameDiscImageUrl = `https://cdn.discordapp.com/icons/${selectedServer}/${servers[selectedServer].properties_icon}.webp?size=80&quality=lossless`;
        }
        

        let dblist = await dataManager.getDBServersObjList();
        
        // Add the new filename to the list of DBs
        dblist.push(filename);
        
        // Update the DB list with the new filename
        await dataManager.setDBServersObjList(dblist);
        
        // Set the channel nickname
        await dataManager.setChannelNickname(filename, nickname);
        
        // Set the server game disc URL or null if no icon
        await dataManager.setServerGameDisc(filename, gameDiscImageUrl || null);
        
        // Set the active DB to the new filename
        await dataManager.setActiveServerDisc(filename);
        
        // Set the messages for the new DB
        await dataManager.setMessages(filename, messages);
        
        
        console.log("DONE!")

        navigate('/')

    }

    return (
        <>
            <Helmet>
                <title>DWiki | Load Discord Data</title>
                <link href="https://fonts.cdnfonts.com/css/unbounded" rel="stylesheet"></link>
                {/* We are using modal here, so we need js (somehow ES6 import doesn't work??) */}
                <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" integrity="sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz" crossorigin="anonymous"></script>
            </Helmet>
            <div id="content-body" className="container container-fluid">
                {popupVisible && (
                    <div className={styles.popup} style={{
                        top: popupTop,
                        left: popupleft,
                        transform: popuptransform
                    }}>
                        <div className={styles.popupheader}>
                            <h4 className={styles.popuptitle}>{servers[selectedServer].serverName}</h4>
                            <button className="btn btn-danger" onClick={closePopup}>Close</button>
                        </div>
                        
                        <div className={styles.popupcontent}>
                            <ul className={styles.channelList}>
                                {
                                
                                servers[selectedServer].channels.map((channel) => {
                                // only text channels
                                if (channel.type !== 0) return null;
                                console.log("User Permission ID:",servers[selectedServer].permission_id)
                                // find @everyone overwrite (its ID === guild ID)
                                const everyoneOW = channel.permission_overwrites.find(
                                    (ow) => ow.id === servers[selectedServer].permission_id
                                );
                                // if deny mask explicitly has VIEW_CHANNEL (0x0400), skip
                                if (everyoneOW && (everyoneOW.deny & 0x0400) !== 0) return null;

                                // otherwise render
                                return (
                                    <li key={channel.id}>
                                    <a
                                        onClick={() =>
                                        selectChannel(
                                            channel.id,
                                            channel.name,
                                            servers[selectedServer].serverName
                                        )
                                        }
                                    >
                                        {channel.name}
                                    </a>
                                    </li>
                                );
                                })}
                            </ul>
                            </div>



                    </div>)}

                {/* DL progressbar */}
                <div className="modal fade" id="prgsbarModal" data-bs-backdrop="static"
                    data-bs-keyboard="false" tabIndex="-1" aria-labelledby="prgsbarModalLabel"
                    ref={prgsModalRef}>
                    <div className="modal-dialog">
                        <div className={styles.modalcontent}>
                            <div className="modal-header">
                                <h1 className="modal-title fs-5">Downloading...</h1>
                            </div>
                            <div className="modal-body">
                                <div className="progress" role="progressbar" aria-label="Download progress" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
                                    <div className="progress-bar" style={{ width: `${prgsbarValue}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <h1 className={styles.heading}>Load Discord Data</h1>
                <details className={styles.tokendetails}>
                    <summary className={styles.tokensummary}>
                        <h5>How to find your discord token</h5>
                    </summary>

                    <div className={styles.gridcontainer}>
                        <div className={styles.step}>
                            <p>1. Open a new browser window and go to <a href="https://www.discord.com">discord.com</a> and go to
                                any channel. Then open the console dev
                                tools with Option+Command+J on Mac or Control+Shift+J on Windows. The picture shows
                                what you should see.</p>
                            <img className={styles.tutimage} src={tokenimg1} alt="Dev tools example" />
                        </div>

                        <div className={styles.step}>
                            <p>2. Click the 2 arrows that are on the top bar (the same one as console, application, etc) and click
                                on
                                "network". The 2nd picture is what you should see after clicking on network.</p>
                            <img className={styles.tutimage} src={tokenimg2} alt="Network tab example" />
                        </div>

                        <div className={styles.step}>
                            <p>3. Scroll through the discord channel you're in until you see an element that has "messages" in its
                                name.
                                Click on this. If you don't see any, then go to another channel and try again.</p>
                            <img className={styles.tutimage} src={tokenimg3} alt="Messages example" />
                        </div>

                        <div className={styles.step}>
                            <p>4. Scroll down (on the right side) until you see where it says "authorization." It's covered in the
                                picture but those 2 lines are your authorization key. Copy this key.</p>

                            <img className={styles.tutimage} src={tokenimg4} alt="Example" />
                        </div>

                        <div className={styles.step}>
                            <p>5. Paste this key in the textbox below.</p>
                        </div>
                    </div>

                </details>

                <form id="tokenForm" onSubmit={onTokenSubmit}>
                    <div className="mb-3 row">
                        <label htmlFor="auth-token" className="col-sm-2">Discord token</label>
                        <div className="col-sm-10">
                            <input type="text" className="form-control" id="discordToken" name="discordToken"
                                value={token} onChange={(e) => { setToken(e.target.value) }}
                                placeholder="Enter your Discord Token" required />
                        </div>
                    </div>

                    <div className="mb-3">
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={isLoadingServers} // Disable the button when loading
                        >
                            {isLoadingServers ? 'Loading Servers...' : 'Load Servers'} {/* Change the button text */}
                        </button>

                    </div>
    
                </form>

                {isChannelSelected && (<>
                    <div className="mb-3 row">
                        <label htmlFor="num-messages" className="col-sm-2"># of messages to save</label>
                        <div className="col-sm-10">
                            <input type="number" className="form-control" min="3000" max="100000000" value={numMsg}
                                onChange={(e) => setNumMsg(e.target.value)} />
                        </div>
                    </div>
                    <button className="btn btn-success" onClick={loadData}>Load data</button>
                </>)}

                <div className={styles.output}>{message}</div>

                {isServerSelected && (<>
                    <div className={styles.gridcontainer}>
                        {Object.entries(servers).map(([id, serverdata]) => {
                            return <>
                                <div ref={(node) => (gridButtonRef.current[id] = node)}
                                    className={styles.griditem}
                                    onClick={() => showPopup(id)}>
                                    {serverdata.serverName}
                                </div>
                            </>
                        })}
                    </div>
                </>)}
            </div>
        </>
    )
};

export default Download
