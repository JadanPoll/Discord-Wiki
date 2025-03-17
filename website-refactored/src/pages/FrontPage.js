import React, { useEffect } from "react"
import styles from './FrontPage.module.css'
import { useNavbar } from "./NavbarStyle"

import { Link } from "react-router-dom"
import { Helmet } from "react-helmet"

const FrontPage = () => {

    // Navbar
    const { setNavbarColor } = useNavbar()
    useEffect(() => {
        setNavbarColor("transparent")
        return () => setNavbarColor("black")
    }, [setNavbarColor])

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
    })

    return (
        <>
            <Helmet>
                <title>Discord Wiki</title>
                <link href="https://fonts.cdnfonts.com/css/unbounded" rel="stylesheet" />
            </Helmet>
            <div className={styles.nonnavbody}>
                <div>
                    <h1 className={styles.welcomeh1}>Discord Conversations</h1>
                    <h1 className={styles.welcomeh1}>Made <span className={styles.highlight}>Searchable</span>.</h1>

                    <p className={styles.subtitle}>Create your own personalized Wikipedia page for any Discord channel, for any topic.</p>

                    <Link to="/download" className={styles.btn}>Start here</Link>
                </div>
            </div>
        </>
    )
};

export default FrontPage;
