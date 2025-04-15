import React, { useEffect, useState } from "react"


import { Link } from "react-router-dom"
import { Helmet } from "react-helmet"

import { DiscordDataManager } from "./lib/DiscordDataManger"

import styles from './FrontpageWithData.module.css'

import { useNavigate } from 'react-router-dom';


const FrontPageWithData = () => {

    let dmanager = new DiscordDataManager()
    let activeChannel = dmanager.getActiveServerDiscSync()
    let channelname = dmanager.getChannelNicknameSync(activeChannel)

    const navigate = useNavigate();
    // Navbar
    useEffect(() => {
        let root = document.getElementById("root")
        root.style.backgroundColor = "#090d1e"
        root.style.backgroundImage = "linear-gradient(160deg, #151f4a 0%, #7289da 100%)"
        root.style.margin = 0
        root.style.padding = 0
        root.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"

        return () => {
            // revert to fallback styling
            let root = document.getElementById("root")
            root.style.backgroundColor = null
            root.style.backgroundImage = null
            root.style.margin = null
            root.style.padding = null
            root.style.fontFamily = null
        }
    }, [])

    let [terms, setTerms] = useState([])
    let [suggestions, setSuggestions] = useState([])


    useEffect(() => {
        const fetchData = async () => {
            let tglossary = await dmanager.getGlossary(activeChannel)
            setTerms(Object.keys(tglossary))
        }

        fetchData()
    }, [])

    let handleSearchInput = (e) => {
        const searchTerm = e.target.value.trim().toLowerCase()
        if (!searchTerm) return
        let results = []
        terms.forEach(keyword => {
            if (keyword.toLowerCase().includes(searchTerm)) {
                results.push(keyword)
            }
        })
        setSuggestions(results)
    }

    return (
        <>
            <Helmet>
                <title>Discord Wiki</title>
                <link href="https://fonts.cdnfonts.com/css/unbounded" rel="stylesheet" />
            </Helmet>
            <div id="content-body" className="container container-fluid">
                <div className={styles.searchContainer}>
                    <h2 className={styles.heading}>Search from Channel: <span className={styles.highlight}>{channelname}</span></h2>
                    <form className="d-flex position-relative">
                        <input className="form-control me-2" type="search" placeholder="Start typing to search keyword..." aria-label="Search" id="searchInput" autocomplete="off" onChange={handleSearchInput} />
                        <ul className={"list-group position-absolute w-100 " + styles.searchSuggestions}
                            style={{ top: "100%", zIndex: 1000, maxHeight: 200 + "px", overflowY: "auto" }}>
                            {suggestions.map((keyword) => {
                                return <>
                                    <li className={"list-group-item " + styles.suggestable} onClick={() => {
                                        navigate(`/explore?keyword=${keyword}`);
                                    }}>
                                        {keyword}
                                    </li>
                                </>
                            })}
                        </ul>
                    </form>
                    <div class="mt-2">
                        <Link to="/download" className={styles.link}>Add another file</Link> | <Link to="/titles" className={styles.link}>Manage files</Link> | <a href="#" className={styles.link}>I'm bored</a>
                    </div>
                </div>
            </div>
        </>
    )
};

export default FrontPageWithData;
