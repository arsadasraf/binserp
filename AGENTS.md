# Binserp Workspace Rules & Coding Standards

## 1. Item Display Standard (Strict Rule: Descriptions, Never Item Codes)
Across all modules and views in the entire application (Store, WIP, Sales, Purchase, MRP, Inventory, Masters, QA/QC, Documents, and PDFs):

- **Strict Rule**:
  Whenever displaying an item (Raw Material, Bought-Out, Consumable, Sub-assembly, or Finished Good), **ALWAYS display the Item Name and Technical Description**.
  **NEVER display raw item codes** (e.g. `RM-1024`, `BO-992`, `FG-001`) in primary user-facing UI labels.

- **In Tables & Cards**:
  - Render the **Item Name** prominently on the primary line (e.g. `font-bold text-xs sm:text-sm`).
  - Render the **Technical Description** in subtle italic styling directly below the name:
    ```tsx
    <ItemNameAndDescription name={item.name} description={getItemDescription(item)} />
    ```
    or:
    ```tsx
    <div>
      <div className="font-bold text-xs sm:text-sm">{item.name || "N/A"}</div>
      {desc && <div className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-2">{desc}</div>}
    </div>
    ```

- **In Selectors & Dropdowns (SearchableSelect / Dropdown Menus)**:
  - Format option labels using `formatItemSelectLabel(item)` from `@/src/utils/itemDisplayHelper`:
    `${item.name} — ${item.description || item.descriptions}` (or simply `${item.name}` if no description exists).
  - Do NOT format labels as `${item.name} (${item.code})`.

- **In Document & PDF Generators**:
  - In tables and item summary sections, show `Item Name & Description`.
  - Replace "Item Code" column/label with "Description" or "Item Name & Description".

## 2. Backend Query & Population Standard
- Whenever fetching or populating inventory items, materials, or components from MongoDB, **ALWAYS ensure description fields are selected and populated**:
  - Raw Materials, Bought-Outs, Consumables: `descriptions`
  - Finished Goods, Sub-assemblies, MRP items: `description`
  - Populate syntax example: `.populate('material', 'name code unit category descriptions description specification')`
