import React, { useEffect, useState, useRef, useLayoutEffect } from "react"
import { Link } from "react-router-dom"
import { Helmet } from "react-helmet"

import { DiscordDataManager } from "./lib/DiscordDataManger"
import styles from './Listfiles.module.css'

const moment = require('moment')

const Listfiles = () => {

    /* This page does not use any effects/states. Changing anything will require a refresh.
    */
    let [dbdata, setDbdata] = useState(null)

    useEffect(() => {
        const fetchFiles = async () => {
            let ans = []

            let discorddata = new DiscordDataManager()
            let dblist = await discorddata.getDBList()
            let activefile = await discorddata.getActiveDB()
            dblist.forEach(async element => {
                let nickname = await discorddata.getChannelNickname(element)
                let epoch = element.split("_")[1] * 1 / 1000
                console.log(moment.unix(epoch).format())
                ans.push({
                    id: element,
                    nickname: nickname,
                    isActive: (element === activefile),
                    datetime: moment.unix(epoch).format("LLL"),
                    createdAt: "abcd"
                })
            })
            setDbdata(ans)
        }

        fetchFiles()

        return () => { }
    }, [])

    let deleteFile = async (id) => {
        let discorddata = new DiscordDataManager()
        if (id === await discorddata.getActiveDB()) {
            alert("You are about to delete the active file. The newest file will become the next active file.")
        }

        let confirmfirstres = window.confirm("You are about to delete this file. Continue?")
        if (confirmfirstres !== true) {
            alert("Aborted.")
            return
        }

        let res = await discorddata.removeChannel(id)
        console.log(res)
        window.location.reload()
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

        window.location.href = '/'
    }

    if (dbdata === null) return <div>Loading...</div>

    return (
        <>
            <Helmet>
                <title>Files Available</title>
            </Helmet>
            <div id="content-body" className="container container-fluid">
                <h1>Files Available</h1>
                {dbdata.length == 0 &&
                    <p>No file is loaded. Get started by <Link to="/download">loading a file first</Link>!</p>}
                {dbdata.length > 0 &&
                    dbdata.map((data) => {
                        return <div className={styles.card + " card"}>
                            <div className={"card-body " + (data.isActive ? "shadow" : "")}>
                                <h5 className="card-title">{data.nickname}</h5>
                                <h6 className="card-subtitle mb-2 text-body-secondary">ID: {data.id}</h6>
                                <p className="card-text">Created at {data.datetime}</p>
                                {data.isActive && <span href="#" class="card-link"><i>Active File</i></span>}
                                {!data.isActive && <a href="#" class="card-link" onClick={() => {
                                    let dm = new DiscordDataManager()
                                    dm.setActiveDB(data.id)
                                    window.location.reload()
                                }
                                }>Set as active file</a>}
                                <a href="#" className="card-link" onClick={() => {deleteFile(data.id)}}>Delete</a>
                            </div>
                        </div>
                    })
                }
                <div>
                    <button type="button" className="btn btn-danger float-end mx-1" onClick={purge}>Delete All Files</button>
                    <Link to="/download" className="btn btn-primary mx-1 float-end" role="button">Load a file</Link>
                </div>
            </div>
        </>
    )
};

export default Listfiles
