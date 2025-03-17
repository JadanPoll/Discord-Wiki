import React, { useEffect, useState, useRef } from "react"
import styles from './Download.module.css'

import { Helmet } from "react-helmet"

import { DiscordClient } from "./lib/DiscordClient"

// we should honestly make these shorter
import { loadConversationEngine, generateAndDisplayAllRandomContextChain,calculateGlossary, calculateDisplayGlossary } from '/engine.js'

import tokenimg1 from "./static/discord-tut-images/discord-token-tut-img1.webp"
import tokenimg2 from "./static/discord-tut-images/discord-token-tut-img2.webp"
import tokenimg3 from "./static/discord-tut-images/discord-token-tut-img3.webp"
import tokenimg4 from "./static/discord-tut-images/discord-token-tut-img4.webp"

const Download = () => {

    const WS_URL = 'wss://gateway.discord.gg/?encoding=json&v=9&compress=zlib-stream' // Discord WS URL

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

    // states
    const [token, setToken] = useState("")

    /* For POPUP ONLY, not necessarily the final server selected */

    // is a server selected?
    const [isServerSelected, setServerSelected] = useState(false)

    /* servers a map of servers loaded during the first stage of DL.
    it maps serverID to {serverName: string, channels: json}. */
    const [servers, setServers] = useState({})

    // currently selected server
    const [selectedServer, setSelectedServer] = useState(null)

    // ref's for server grids
    const gridButtonRef = useRef({})

    // position for popup
    const [popupVisible, setpopupVisible] = useState(false)
    const [popupleft, setPopupleft] = useState(0)
    const [popupTop, setPopupTop] = useState(0)
    const [popuptransform, setPopuptransform] = useState(0)

    /* END for POPUP*/

    // is a channel selected
    const [isChannelSelected, setChannelSelected] = useState(false)

    const [selectedChannelId, setSelectedChannelid] = useState(null)

    const [numMsg, setNumMsg] = useState(5000)

    const [message, setMessage] = useState("Waiting for token submission...")

    // Handle Token submissions (getting servers)
    const onTokenSubmit = async (e) => {
        e.preventDefault()

        const discordToken = token.trim()
        if (discordToken) {
            console.log('Connecting with provided token...');
            const client = new DiscordClient(WS_URL, discordToken, (json) => {
                // callback for when all data is read

                console.log("Data received: ", json)

                // build list of objects, as described before channels

                let serverList = {}
                for (const server of json.d.guilds) {
                    let serverName = server.properties.name
                    let serverID = server.properties.id
                    let channels = server.channels

                    serverList[serverID] = { serverName: serverName, channels: channels }
                }

                setServers(serverList)
                setServerSelected(true)
                setMessage("Please select a channel.")
            });
            client.connect();
        }
        else {
            alert('Invalid token. Please enter a valid Discord token.')
        }
    }

    // Handle popup open
    const showPopup = (id) => {
        setSelectedServer(id)
        setpopupVisible(true)

        const button = gridButtonRef.current[id]
        if (!button) return

        let left = 0
        let top = 0
        let transform = ""

        const serverItemRect = button.getBoundingClientRect();
        const popupWidth = 300; // Popup width defined in CSS
        const spaceOnRight = window.innerWidth - serverItemRect.right;
        const spaceOnLeft = serverItemRect.left;

        // Position the popup based on available space
        if (spaceOnRight >= popupWidth) {
            left = `${serverItemRect.right + 10}px`;
            top = `${serverItemRect.top}px`;
            transform = 'translateX(0)';
        } else if (spaceOnLeft >= popupWidth) {
            left = `${serverItemRect.left - popupWidth - 10}px`;
            top = `${serverItemRect.top}px`;
            transform = 'translateX(0)';
        } else {
            // Default to expanding downwards if not enough space
            left = `${serverItemRect.left}px`;
            top = `${serverItemRect.bottom + 10}px`;
            transform = 'translateY(0)';
        }

        setPopupleft(left)
        setPopupTop(top)
        setPopuptransform(transform)

        console.log(servers[id].channels)
    }

    const closePopup = () => {
        setpopupVisible(false)
    }

    const selectChannel = (channelid, channelname, servername) => {
        setMessage(`Selected ${servername} > ${channelname} (${channelid})`)
        setChannelSelected(true)
        setSelectedChannelid(channelid)
        setpopupVisible(false)
    }

    return (
        <>
            <Helmet>
                <title>Load Discord Data</title>
                <link href="https://fonts.cdnfonts.com/css/unbounded" rel="stylesheet"></link>

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
                            {servers[selectedServer].channels.map((channel) =>
                            {
                                if (channel.type !== 0) return
                                return <li><a onClick={() => selectChannel(channel.id, channel.name, servers[selectedServer].serverName)}>{channel.name}</a></li>
                            })}
                            </ul>
                        </div>
                    </div>)}

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
                        <button type="submit" className="btn btn-primary">Load Servers</button>
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
                    <button className="btn btn-success">Load data</button>
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
