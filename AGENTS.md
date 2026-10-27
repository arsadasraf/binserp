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

## 3. Application Stability & Non-Breaking Guarantee
- **Strict Rule: Never Break Existing Features**: Any new feature development, refactoring, or bugfix must NEVER break existing workflows, routes, or APIs.
- When adding validation, filters, or mandatory fields, always maintain backward compatibility with existing database records and current user sessions.
- Always verify TypeScript compilation (`npx tsc --noEmit` on frontend) and Node syntax (`node -c` on backend) before completing any modification.

## 4. API Security & RBAC Standard
- **Route Protection**: Every newly created or modified API route must be secured with `verifyJWT` unless it is explicitly designed as a public endpoint.
- **Granular RBAC**: Every authenticated endpoint must declare appropriate RBAC guards using `requirePermission(module, tab, action)`.
- **System Role Bypass**: Never allow user-created custom roles to bypass RBAC checks based on role name strings alone. Full-access bypass is restricted strictly to built-in system default roles (`r?.isDefault !== false`).
- **Public & Webhook Endpoints**: For public endpoints (e.g. inbound webhooks, public callbacks) where `verifyJWT` is not executed, dynamically resolve the tenant database and never call `req.getModel` or access `req.company` assuming it is already populated.
- **Frontend Navigation Safety**: In `ResponsiveDashboardLayout`, users without assigned roles or matching departments must fallback to `fallbackNav` (Dashboard only) rather than granting access to all operational modules.

## 5. File Upload & Static Asset Security
- **MIME & Extension Whitelisting**: Always enforce strict MIME and file extension filtering on all file uploads. Only allow approved file types (e.g. photos/images, PDFs, audio recordings, or standard document spreadsheets).
- **Prohibit Script & Executable Uploads**: Never allow `.html`, `.svg`, `.js`, `.exe`, `.php`, `.sh`, or other script/executable files to be uploaded or executed.
- **Static Assets**: Always serve user-uploaded static assets with `X-Content-Type-Options: nosniff` and appropriate security headers.

## 6. Input Sanitization & Anti-Injection
- **MongoDB Regex Queries**: Never pass unescaped user input into MongoDB `$regex` expressions. Always escape special regex characters (`.*+?^${}()|[\]\\`) to prevent wildcard probing and ReDoS attacks.
- **SSRF Prevention**: Any endpoint fetching external URLs (such as base64 image converters or third-party webhooks) must validate protocols (`http:`, `https:`), enforce content length and content type limits, and strictly block loopback (`127.0.0.1`), metadata services (`169.254.169.254`), and private RFC 1918 subnets (`10.x`, `172.16-31.x`, `192.168.x`).
- **PDF Generation**: Always ensure browser rendering engines (such as Puppeteer) launch with flags disabling local file access (`--disable-local-file-access`).

## 7. Global Tab & Sub-Tab Uniformity Standard
Across all modules and views in the entire application (Store, WIP, Job Work, Sales, Purchase, Inventory, Masters, CRM, Quality, Gate Entry, HR, Accounts):

- **Strict Uniformity Rule**:
  All top-level navigation tabs and module sub-tabs must adhere strictly to the **Segmented Floating Pill** design system. Custom, one-off styles (such as flat text links, underlines, mismatched heights, or pastel borders) are strictly prohibited.

- **Tab Container Specification**:
  ```tsx
  <div className="flex overflow-x-auto max-w-full no-scrollbar bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs gap-1.5 scroll-smooth shrink-0 w-fit">
  ```
  - Responsive Horizontal Scrolling: Always include `overflow-x-auto max-w-full no-scrollbar scroll-smooth touch-pan-x`.

- **Active Tab Styling**:
  - Gradient Background: `bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm shadow-indigo-500/25`
  - Typography: `text-xs sm:text-sm font-bold`
  - Padding & Geometry: `px-3.5 sm:px-4 py-2 rounded-xl whitespace-nowrap shrink-0`
  - Icon: Sized at `15px` (`sm:size={16}`), rendered with `text-white`.

- **Inactive Tab Styling**:
  - Base State: `text-slate-600 dark:text-slate-400`
  - Hover State: `hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60`
  - Typography: `text-xs sm:text-sm font-bold` (or `font-semibold`)
  - Padding & Geometry: `px-3.5 sm:px-4 py-2 rounded-xl whitespace-nowrap shrink-0 active:scale-95 transition-all duration-150`
  - Icon: Sized at `15px` (`sm:size={16}`), rendered with `text-slate-500 dark:text-slate-400`.

- **Standard Tab Item Implementation Pattern**:
  ```tsx
  <Link
    key={tab.href}
    href={tab.href}
    className={`flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 whitespace-nowrap shrink-0 active:scale-95 ${
      isActive
        ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm shadow-indigo-500/25'
        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
    }`}
  >
    <Icon size={15} className={isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'} />
    <span>{tab.name}</span>
  </Link>
  ```

## 8. Global Form & Modal Uniformity Standard
Across all operational modules and popup dialogues:

- **Strict Uniformity Rule**:
  All modals and creation/editing forms must adhere strictly to the established **Modern Card Glassmorphism** pattern with consistent typography, input heights, focus states, and action buttons.

- **Modal Backdrop & Card Container**:
  - Overlay: `fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 lg:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200`
  - Modal Window: `relative w-full max-w-5xl (or 6xl/7xl) max-h-[94vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden`

- **Header Specification**:
  - Container: `flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-indigo-50/70 to-blue-50/70 dark:from-slate-800/80 dark:to-slate-800/40 shrink-0`
  - Icon Badge: `p-2.5 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-500/25 shrink-0`
  - Title: `text-lg font-black text-slate-900 dark:text-white flex items-center gap-2`
  - Subtitle: `text-xs text-slate-500 dark:text-slate-400 mt-0.5`
  - Close Button: `p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer active:scale-95`

- **Section Grouping Cards**:
  - Container: `bg-slate-50/60 dark:bg-slate-800/40 rounded-2xl p-4 sm:p-5 border border-slate-200/70 dark:border-slate-750 shadow-2xs space-y-3.5`
  - Section Title: Accent pill `<div className="w-1.5 h-4 bg-indigo-600 rounded-full shrink-0" />` with `<span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">{title}</span>`.

- **Field Labels**:
  - Style: `block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5`
  - Required Asterisk: `<span className="text-rose-500 ml-0.5">*</span>`

- **Form Controls (Text, Number, Date, Select)**:
  - Standard Input: `w-full px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-2xs`
  - Textarea: `w-full px-3 py-2 text-xs sm:text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-2xs resize-none`

- **Line Item Tables inside Forms**:
  - Standard Column Width for Items: Fixed minimum width `min-w-[280px] sm:min-w-[340px]`.
  - Item Text Display: Single-line truncated item name, 2-line clamped technical description (`line-clamp-2`), and native hover tooltip (`title={item.name}`) so long descriptions never push action buttons off-screen.

- **Footer Action Buttons**:
  - Footer Container: `flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 shrink-0`
  - Cancel Button: `px-4.5 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer active:scale-95`
  - Submit Button: `px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 rounded-xl shadow-md shadow-indigo-500/25 hover:shadow-lg hover:shadow-indigo-500/35 transition-all cursor-pointer flex items-center gap-2 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed`


