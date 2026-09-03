"use client";

import React from "react";
import { X, Download, ExternalLink, FileText, Image as ImageIcon } from "lucide-react";

interface RoutingMediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaUrl: string;
  mediaTitle?: string;
  mediaType?: "image" | "pdf";
}

export default function RoutingMediaModal({
  isOpen,
  onClose,
  mediaUrl,
  mediaTitle = "Attachment Preview",
  mediaType = "image",
}: RoutingMediaModalProps) {
  if (!isOpen || !mediaUrl) return null;

  const isPdf =
    mediaType === "pdf" ||
    mediaUrl.toLowerCase().endsWith(".pdf") ||
    mediaTitle.toLowerCase().endsWith(".pdf");

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/80">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className={`p-2 rounded-xl ${isPdf ? "bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400" : "bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"}`}>
              {isPdf ? <FileText size={20} /> : <ImageIcon size={20} />}
            </div>
            <div className="truncate">
              <h3 className="font-semibold text-gray-900 dark:text-white truncate text-base">
                {mediaTitle}
              </h3>
              <span className="text-xs text-gray-500 uppercase tracking-wider font-mono">
                {isPdf ? "PDF Document / Drawing" : "Image / Setup Photo"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={mediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors shadow-sm"
              title="Open in new tab"
            >
              <ExternalLink size={14} />
              <span>Open Original</span>
            </a>
            <a
              href={mediaUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors shadow-sm"
              title="Download file"
            >
              <Download size={16} />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors ml-1"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Viewer */}
        <div className="flex-1 bg-gray-100 dark:bg-gray-950 p-4 overflow-auto flex items-center justify-center min-h-[400px]">
          {isPdf ? (
            <div className="w-full h-[68vh] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white shadow-inner">
              <iframe
                src={`${mediaUrl}#toolbar=1&navpanes=0`}
                className="w-full h-full border-none"
                title={mediaTitle}
              />
            </div>
          ) : (
            <div className="relative max-w-full max-h-[72vh] flex items-center justify-center">
              <img
                src={mediaUrl}
                alt={mediaTitle}
                className="max-w-full max-h-[72vh] object-contain rounded-xl shadow-lg border border-gray-200/50 dark:border-gray-800"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
