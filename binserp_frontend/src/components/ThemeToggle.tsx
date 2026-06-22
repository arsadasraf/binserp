"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun, Laptop } from "lucide-react";

export default function ThemeToggle() {
    const [mounted, setMounted] = useState(false);
    const { theme, setTheme } = useTheme();

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse"></div>
        );
    }

    return (
        <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <button
                onClick={() => setTheme("light")}
                className={`p-1.5 rounded-md transition-all duration-200 flex items-center justify-center ${theme === "light"
                        ? "bg-white text-yellow-500 shadow-sm"
                        : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    }`}
                title="Light Mode"
            >
                <Sun size={16} />
            </button>
            <button
                onClick={() => setTheme("system")}
                className={`p-1.5 rounded-md transition-all duration-200 flex items-center justify-center ${theme === "system"
                        ? "bg-white dark:bg-gray-700 text-indigo-500 shadow-sm"
                        : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    }`}
                title="System Mode"
                aria-label="System Mode"
            >
                <Laptop size={16} />
            </button>
            <button
                onClick={() => setTheme("dark")}
                className={`p-1.5 rounded-md transition-all duration-200 flex items-center justify-center ${theme === "dark"
                        ? "bg-gray-700 text-blue-400 shadow-sm"
                        : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    }`}
                title="Dark Mode"
            >
                <Moon size={16} />
            </button>
        </div>
    );
}
