import { Outlet, Link } from "react-router-dom"
import { useNavbar } from "./NavbarStyle"
import { DiscordDataManager } from "./lib/DiscordDataManger";

import 'bootstrap/dist/css/bootstrap.css';
import 'bootstrap/dist/js/bootstrap.bundle.min';
import 'popper.js/dist/umd/popper.min.js';
import whitelogo from './static/logos/white-logo.png'

const Layout = () => {
    let { NavbarColor } = useNavbar() // this context is 'transparent' only when we are in the 'true' front page.

    let dmanager = new DiscordDataManager()
    let activeChannel = dmanager.getActiveDBSync()
    let channelname = dmanager.getChannelNicknameSync(activeChannel)
    return (
        <>
            <nav className="navbar navbar-expand-md navbar-dark bg-dark mb-4" ref={
                element => {
                    // https://stackoverflow.com/questions/67265740/why-important-is-not-working-in-react-js-with-inline-style
                    if (element) {
                        if (NavbarColor === "transparent") {
                            element.style.setProperty("background", "rgba(33, 37, 41, 0.3)", "important")
                        }
                        else {
                            element.style.setProperty("background", "")
                        }
                    }
                }}>
                <div className="container-fluid">
                    <Link className="navbar-brand" to="/"><img src={whitelogo} style={{ width: "40px" }} alt="DWiki Logo" /></Link>
                    <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarCollapse"
                        aria-controls="navbarCollapse" aria-expanded="false" aria-label="Toggle navigation">
                        <span className="navbar-toggler-icon"></span>
                    </button>
                    <div className="collapse navbar-collapse" id="navbarCollapse">
                        <ul className="navbar-nav me-auto mb-2 mb-md-0">
                            <li className="nav-item">
                                <span className="nav-link disabled" aria-disabled="true">{channelname}</span>
                            </li>
                            {channelname !== "" && <li className="nav-item">
                                <Link className="nav-link" to="/analyse">Analyse</Link>
                            </li>}
                            <li className="nav-item">
                                <Link className="nav-link" to="/listfiles">Manage files</Link>
                            </li>
                            <li className="nav-item">
                                <Link className="nav-link" to="/download">Add file</Link>
                            </li>
                        </ul>
                    </div>
                </div>
            </nav>

            <Outlet />
        </>
    )
};

export default Layout;
