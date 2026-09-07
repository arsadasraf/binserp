import React from "react";

/**
 * Standard utility to extract technical description from any inventory/material item.
 * Supports RM, BO, Consumable, Sub-assembly, and FG item schemas.
 */
export function getItemDescription(item: any): string {
  if (!item) return "";
  if (typeof item === "string") return "";

  const desc =
    item.description ||
    item.descriptions ||
    item.specification ||
    item.technicalSpecification ||
    item.spec ||
    item.materialDescription ||
    item.fgDescription ||
    "";

  return typeof desc === "string" ? desc.trim() : "";
}

/**
 * Formats an item for select/dropdown components (e.g. SearchableSelect, react-select, HTML select).
 * Enforces the rule: Name with Description, omitting raw item codes.
 * Format: "Item Name — Description" or simply "Item Name" if description is absent.
 */
export function formatItemSelectLabel(item: any, fallbackName: string = "Unnamed Item"): string {
  if (!item) return fallbackName;
  const name = item.name || item.materialName || item.fgItemName || item.componentName || fallbackName;
  const desc = getItemDescription(item);

  return desc ? `${name} — ${desc}` : name;
}

/**
 * Reusable React component for tables, cards, and list views.
 * Renders the Item Name prominently on line 1, and its technical description
 * in subtle italic styling on line 2 without showing raw item codes.
 */
interface ItemNameAndDescriptionProps {
  name?: string;
  description?: string;
  className?: string;
  nameClassName?: string;
  descClassName?: string;
  fallbackName?: string;
}

export const ItemNameAndDescription: React.FC<ItemNameAndDescriptionProps> = ({
  name,
  description,
  className = "",
  nameClassName = "font-bold text-xs sm:text-sm text-gray-900 dark:text-white",
  descClassName = "text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 italic mt-0.5 line-clamp-2",
  fallbackName = "N/A"
}) => {
  const displayName = name?.trim() || fallbackName;
  const cleanDesc = description?.trim() || "";

  return (
    <div className={`min-w-0 ${className}`}>
      <div className={displayName ? nameClassName : ""}>{displayName}</div>
      {cleanDesc && <div className={descClassName}>{cleanDesc}</div>}
    </div>
  );
};

export default ItemNameAndDescription;
