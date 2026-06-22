"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface HeaderContextType {
    title: string;
    subtitle: string;
    setHeader: (title: string, subtitle: string) => void;
    showBottomNav: boolean;
    setShowBottomNav: (show: boolean) => void;
}

const HeaderContext = createContext<HeaderContextType | undefined>(undefined);

export function HeaderProvider({ children }: { children: ReactNode }) {
    const [title, setTitle] = useState("BinsErp");
    const [subtitle, setSubtitle] = useState("");
    const [showBottomNav, setShowBottomNav] = useState(true);

    const setHeader = (newTitle: string, newSubtitle: string) => {
        // Only update if changed to avoid loops
        if (newTitle !== title || newSubtitle !== subtitle) {
            setTitle(newTitle);
            setSubtitle(newSubtitle);
        }
    };

    return (
        <HeaderContext.Provider value={{ title, subtitle, setHeader, showBottomNav, setShowBottomNav }}>
            {children}
        </HeaderContext.Provider>
    );
}

export function useHeader() {
    const context = useContext(HeaderContext);
    if (!context) {
        throw new Error("useHeader must be used within a HeaderProvider");
    }
    return context;
}
