import React, { useEffect, useState, useRef } from "react"
import { Link } from "react-router-dom"
import { Helmet } from "react-helmet"
import { DiscordDataManager } from "./lib/DiscordDataManger"
import { engineAnalyseDriver } from "./lib/EngineAnalyseDriver"
import { loadConversationEngine, processAllContextChains, calculateGlossary, calculateDisplayGlossary } from './lib/engine.js'
import styles from './LoadDemo.module.css'

import { useNavigate } from 'react-router-dom';

const moment = require('moment')

const LoadDemo = () => {

    const navigate = useNavigate()

    let [democatalogue, setDemoCatalogue] = useState(null)
    let [prgsbarValue, setprgsbarValue] = useState(0)
    let [prgsModal, setPrgsModal] = useState(null)
    const prgsModalRef = useRef(0)
    useEffect(() => {
        const fetchFiles = async () => {
            const url = '/demo/files.json'

            try {
                const res = await fetch(url)
                if (!res.ok) throw new Error(res.statusText)
                setDemoCatalogue(await res.json())
            }
            catch (err) {
                alert(`Cannot fetch demo file list: ${err}`)
            }
        }


        fetchFiles()

    }, [])


    let download = async (filename) => {
        let prg = new window.bootstrap.Modal(prgsModalRef.current, { keyboard: false })
        setPrgsModal(prg)
        prg.show()

        // DOWNLOAD

        const url = `/demo/files/${filename}`
        let res
        try {
            res = await fetch(url)
            if (!res.ok) throw new Error(res.statusText)
        }
        catch (err) {
            alert(`Cannot download the file: ${err}`)
            prg.hide()
            return
        }
        setprgsbarValue(60)

        // our JSON file includes some unnecessary info too...
        let messages = (await res.json()).messages


        let db_filename = `DEMO-${filename.replaceAll('_', '-')}_${Date.now()}`
        let nickname = `DEMO: ${filename}`
        console.log(`Saving as ${db_filename}`)

        let dataManager = new DiscordDataManager()
        let messagesStr = JSON.stringify(messages)
        console.log(messages)
        console.log(messagesStr)

        // analyse...
        let result = await engineAnalyseDriver(messagesStr, db_filename)


        if (result.status === true) {
            await dataManager.setGlossary(db_filename, result.glossary)
            await dataManager.setRelationships(db_filename, result.tree)
            console.log(result.blocks)
            await dataManager.setConversationBlocks(db_filename, result.blocks)
        }
        else {
            console.error(`CANNOT ANALYSE DATA: ${result.message}`)
            alert(`CANNOT ANALYSE DATA: ${result.message}`)
            prg.hide()

            navigate(0)
            return
        }

        setprgsbarValue(100)

        let dblist = await dataManager.getDBServersObjList()

        // Add the new filename to the list of DBs
        dblist.push(db_filename)

        // Update the DB list with the new filename
        await dataManager.setDBServersObjList(dblist)

        // Set the channel nickname
        await dataManager.setChannelNickname(db_filename, nickname)

        // We won't put any icon to demo ATP.
        // TODO??
        await dataManager.setServerGameDisc(db_filename, null)

        // Set the active DB to the new filename
        await dataManager.setActiveServerDisc(db_filename)

        // Set the messages for the new DB
        await dataManager.setMessages(db_filename, messages)

        // sleep to wait for changes to be pushed

        await new Promise(r => setTimeout(r, 2000))

        console.log("DONE!")

        prg.hide()

        window.location.href = '/'
    }


    if (democatalogue === null)
        return (
            <div id="content-body" className="container container-fluid">
                <h1>Load Demo Files</h1>
                <p><i>Do not know where to start? Test out our selection of demo files!</i></p>
                <i>Loading...</i>
            </div>)


    console.log(democatalogue)
    return (
        <>
            <Helmet>
                <title>Load Demo Files</title>
                {/* We are using modal here, so we need js (somehow ES6 import doesn't work??) */}
                <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" integrity="sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz" crossorigin="anonymous"></script>
            </Helmet>
            <div id="content-body" className="container container-fluid">
                <h1>Load Demo Files</h1>
                <p><i>Do not know where to start? Test out our selection of demo files!</i></p>

                {democatalogue.map((data) => (
                    <>
                        <div
                            className={`${styles.card} card`}
                            key={data.filename}>
                            <div className={"card-body"}>
                                <h5 className="card-title">{data.name}</h5>

                                <h6 className="card-subtitle mb-2 text-body-secondary">Filename: {data.filename}</h6>
                                <p className="card-text">{data.description}</p>
                                <a
                                    href="#"
                                    className="card-link"
                                    onClick={() => {
                                        download(data.filename)
                                    }}
                                >
                                    Download
                                </a>
                            </div>

                        </div>
                    </>
                ))}

                {/* prgsbar */}
                <div className="modal fade" id="prgsbarModal" data-bs-backdrop="static"
                    data-bs-keyboard="false" tabIndex="-1" aria-labelledby="prgsbarModalLabel"
                    ref={prgsModalRef}>
                    <div className="modal-dialog">
                        <div className="modal-content">
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
            </div>
        </>
    )
};

export default LoadDemo;
