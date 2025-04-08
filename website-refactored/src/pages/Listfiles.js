import React, { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Helmet } from "react-helmet"
import { DiscordDataManager } from "./lib/DiscordDataManger"
import styles from './Listfiles.module.css'

import { useNavigate } from 'react-router-dom';

const moment = require('moment')

const Listfiles = () => {

    const navigate = useNavigate();
    
    let [dbdata, setDbdata] = useState(null)
    let [activefile, setActiveFile] = useState(null);
    useEffect(() => {
        const fetchFiles = async () => {
            let ans = []
        
            let discorddata = new DiscordDataManager()
            let dblist = await discorddata.getDBServersObjList()
            setActiveFile( await discorddata.getActiveServerDisc())
        
            // Loop over the DB list
            for (let element of dblist) {
                let nickname = await discorddata.getChannelNickname(element)
                let gameDiscImageUrl = await discorddata.getServerGameDisc(element)
        
                // Check if the gameDiscImageUrl is valid, otherwise set it to null
                if (!gameDiscImageUrl) {
                    gameDiscImageUrl = null;  // Or you can set a default image if preferred
                }
        
                console.log('Testing disc', element, gameDiscImageUrl)
        
                // Extract and format the datetime for the element
                let epoch = element.split("_")[1] * 1 / 1000
                ans.push({
                    id: element,
                    nickname: nickname,
                    isActive: (element === activefile),
                    datetime: moment.unix(epoch).format("LLL"),
                    imageUrl: gameDiscImageUrl
                })
            }
        
            // Update the state with the fetched data
            setDbdata(ans)
        }
        

        fetchFiles()

    }, [activefile])

    let deleteFile = async (id) => {
        let discorddata = new DiscordDataManager()
        if (id === await discorddata.getActiveServerDisc()) {
            alert("You are about to delete the active file. The newest file will become the next active file.")
        }

        let confirmfirstres = window.confirm("You are about to delete this file. Continue?")
        if (confirmfirstres !== true) {
            alert("Aborted.")
            return
        }

        let res = await discorddata.removeChannel(id)
        console.log(res)
        setActiveFile(null);
    }

    const purge = async () => {
        let confirmfirstres = window.confirm("You are about to remove all saved data. THIS ACTION IS IRREVERSIBLE. Continue?")
        if (confirmfirstres !== true) {
            alert("Aborted.")
            return
        }

        let confirmsecondres = window.confirm("Again, this will remove ALL DATA. Are you really sure? THIS IS YOUR LAST CHANCE!")
        if (confirmsecondres !== true) {
            alert("Aborted.")
            return
        }

        let discorddata = new DiscordDataManager()
        await discorddata.purge()

        navigate('/')
    }

    if (dbdata === null) return <div>Loading...</div>

    return (
        <>
            <Helmet>
                <title>Files Available</title>
            </Helmet>
            <div id="content-body" className="container container-fluid">
                <h1>Files Available</h1>
                {dbdata.length === 0 &&
                    <p>No file is loaded. Get started by <Link to="/download">loading a file first</Link>!</p>}
                {dbdata.length > 0 &&
                    dbdata.map((data) => (
                            <div
                                className={`${styles.card} card`}
                                key={data.id}
                                style={{
                                    "--cd-img": `url(${data.imageUrl || 'path/to/default-image.webp'})`
                                }}
                            >
                            <div className={"card-body " + (data.isActive ? "shadow" : "")}>
                                <h5 className="card-title">{data.nickname}</h5>

                            {/* This container holds the circular arrow which appears on hover;
                                Its visibility is controlled via CSS (Download.module.css) */}
                            <div className={styles.previewIconContainer}>
                            <a
                                href="#"
                                onClick={(e) => {
                                e.preventDefault();
                                navigate(`/preview/${data.id}`);
                                }}
                                title="Preview messages"
                                className={styles.previewIcon}
                            >
                                &gt;
                            </a>
                            </div>


                                <h6 className="card-subtitle mb-2 text-body-secondary">ID: {data.id}</h6>
                                <p className="card-text">Created at {data.datetime}</p>
                                {data.isActive && <span className="card-link"><i>Active File</i></span>}
                                {!data.isActive && (
                                    <a
                                        href="#"
                                        className="card-link"
                                        onClick={() => {
                                            let dm = new DiscordDataManager();
                                            dm.setActiveServerDisc(data.id);
                                            navigate(0); //Reload on this current path (:) Actually reloading the page feels more powerful
                                        }}
                                    >
                                        Set as active file
                                    </a>
                                )}
                                <a
                                    href="#"
                                    className="card-link"
                                    onClick={() => {
                                        deleteFile(data.id);
                                    }}
                                >
                                    Delete
                                </a>
                            </div>
                        </div>
                    ))
                    
                    }
                <div>
                    <button type="button" className="btn btn-danger float-end mx-1" onClick={purge}>Delete All Files</button>
                    <Link to="/download" className="btn btn-primary mx-1 float-end" role="button">Load a file</Link>
                </div>
            </div>
        </>
    )
};

export default Listfiles;
