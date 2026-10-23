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

