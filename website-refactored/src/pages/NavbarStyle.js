// This files determines what style for navbar should be used.

import React, { createContext, useState, useContext } from "react";

const NavbarContext = createContext();

export const NavbarStyle = ({ children }) => {
    //Possible values: "black", "transparent" ONLY
    const [NavbarColor, setNavbarColor] = useState("black");

    return (
        <NavbarContext.Provider value={{ NavbarColor, setNavbarColor }}>
        {children}
        </NavbarContext.Provider>
    );
};

export const useNavbar = () => useContext(NavbarContext);