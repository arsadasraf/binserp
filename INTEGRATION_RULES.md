# BinsERP Cross-Module Feature Integration & Regression Rules

> **STRICT MANDATE FOR AI AGENTS & DEVELOPERS**:
> BinsERP is a tightly integrated, multi-tenant manufacturing ERP. A change in one module (e.g., Store Masters, BOM, Dual-UOM, MRP, Purchase, WIP, Job Work, Quality, or Sales) directly affects downstream and upstream modules.
> **Before writing or modifying any code, you MUST check this document, preserve all cross-module contracts listed below, run the integration test suites, and add/update integration tests for any new or modified feature.**

---

## 1. Cross-Module Integration Dependency Matrix

Whenever you touch a file in the **Source Module**, you MUST verify and preserve its contract with all **Linked Upstream/Downstream Modules**:

| Source Module | Linked Modules Affected | Critical Integration Contract to Preserve | Automated Test Suite |
| :--- | :--- | :--- | :--- |
| **Auth, Users & Roles** (`auth.middleware.js`, `role.model.js`) | Every `/api/*` endpoint & `ResponsiveDashboardLayout` | 1. Every route requires `verifyJWT` + `requirePermission(module, tab, action)`.<br>2. Custom roles (`isDefault: false`) must NEVER bypass RBAC even if named `"GM"` or `"Admin Default Role"`.<br>3. Tenant DB isolation via `req.getModel(modelName, schema)`. | `01-auth-rbac-tenant.test.js` & `architecture.contract.test.js` |
| **Store Masters** (`RawMaterial`, `BoughtOut`, `ConsumableItem`, `FGItem`, `Vendor`, `Customer`) | BOM, Vendor/Sales Price Lists, MRP, PO, GRN, WIP, Job Work, Sales | 1. **Descriptions Always Populated**: `descriptions` (RM/BO/Consumable) and `description` (FG/MRP). Never show raw item codes in primary UI labels.<br>2. **Dual-UOM Sync**: `hasSecondaryUnit`, `secondaryUnit`, `conversionFactor`, `primaryRatio`, `secondaryRatio` must propagate to `Inventory`, `RmBoItem`, and BOM lines.<br>3. **Lifecycle Guard**: Items/Vendors with active transactions or stock cannot be hard-deleted. | `02-masters-bom-pricelist.test.js` |
| **FG Item Multi-Level BOM** (`FGItemForm.tsx`, `fgItem.controller.js`, `bomHierarchyHelper.ts`, `bomCostingHelper.ts`) | FG Master Preview, MRP Demand Plan Explosion, WIP Assemble FG, PPC | 1. BOM line items support `RawMaterial`, `BoughtOut`, and nested `FGItem` (Sub-Assembly / Component).<br>2. Editing/filtering BOM lines in UI must preserve true array indices (`formData.bom[idx]`).<br>3. Updating an FG BOM flags or syncs active MRP Plans (`isBOMOutdated` / `recalculateMRPWithLatestBOM`).<br>4. 3-Mode BOM Costing (`L2_ONLY`, `COMPONENT_AND_BO`, `RM_AND_BO`) must never double-count child parts. | `02-masters-bom-pricelist.test.js` & `bomAndCosting.integration.test.ts` |
| **Purchase & Sales Price Lists** (`vendorPriceList.controller.js`, `priceList.controller.js`) | FG BOM Costing, PO Creation, Quotation & Sales Order Pricing | 1. Preferred vendor (`isPreferred: true`) takes priority in BOM costing.<br>2. Saving a Sales Price List syncs `sellingPrice`, `taxRate`, and `currency` onto the `FGItem` master.<br>3. Both price lists support Dual-UOM (`pricingUnit`, `isSecondaryUnit`). | `02-masters-bom-pricelist.test.js` & `bomAndCosting.integration.test.ts` |
| **MRP Demand Plan** (`mrpPlan.controller.js`, `MRPDetailsModal.tsx`) | Customer PO, FG BOM, Purchase Bucket, Material PO, Job Work Outward PO, GRN, WIP | 1. Explodes multi-level FG BOM into `rmRequirements` and `boRequirements` considering current stock.<br>2. **Linked Outward POs**: Both Standard Material POs (`poType: "standard"`) and Job Work Outward POs (`poType: "jobwork"`) linked via `mrpPlanId` or `mrpNumber` must be returned in `linkedPOs` / `linkedPOCount` and displayed in MRP Details & GRN.<br>3. Creating/updating a linked PO calls `syncMRPPlanFinancials`. | `03-mrp-purchase-grn-inventory.test.js` |
| **Purchase Order & GRN** (`purchaseOrder.controller.js`, `createGRN.controller.js`) | MRP Plan, Incoming QC, Store Inventory, Stock Ledger, Purchase Bill | 1. GRN creation increments `Inventory.currentStock` (or `qcPendingStock` if `qcRequired: true`), updates PO `receivedQuantity`/`pendingQuantity`, records `StockTransaction`, and syncs with `PurchaseBill` (`syncGRNToPurchaseBill`).<br>2. Dual-UOM quantities (`quantity` + `secondaryQuantity`) must be tracked in both PO and GRN. | `03-mrp-purchase-grn-inventory.test.js` |
| **WIP Material Request & Issue** (`createMaterialRequest`, `updateMaterialRequest`, `createMaterialIssue`, `wipTransactions`) | Store Inventory, WIP Inventory, MRP Plan, FG Assembly | 1. **Dual-UOM Display & Storage**: Material Request and Material Issue must store and display both Primary UOM (`quantity`, `unit`) and Secondary UOM (`secondaryQuantity`, `secondaryUnit`) when `hasSecondaryUnit` is true.<br>2. **Time-Lock Governance Rule**: The 24-hour edit time-lock policy (`checkTimeLockGovernance`) applies **ONLY to manual user edits** of request specifications (items/department/priority). It must **NEVER block operational fulfillment or status transitions** (`Issued`, `Partially Issued`, `Approved`, `Rejected`, `skipInventoryUpdate`, `bypassTimeLock`) when issuing material against older requests.<br>3. Issuing material deducts Store `Inventory` and increments WIP Inventory. | `04-wip-request-issue-assembly.test.js` |
| **Job Work Outward PO & Challan** (`createJobWorkChallan.controller.js`, `purchaseOrder.controller.js`) | Store/WIP Stock, Outward PO, Job Work QC, Job Work Bill | 1. **Bidirectional PO <-> Challan Sync (`syncJobWorkChallanPO`)**: Linking a Job Work PO (`poType: "jobwork"`) to a `JobWorkChallan` (by `jobWorkChallan` ID or `challanNumber`) automatically syncs `poNumber` and item `processRate` / `selectedUnit` onto the Challan, and populates `jobWorkChallan` & `challanNumber` on the PO.<br>2. Unlinking or changing the Challan on a PO clears the stale `poNumber` from the previous Challan. | `05-jobwork-po-challan-qc-bill.test.js` |
| **Sales Workflow** (`incomingRFQ`, `quotation`, `incomingPO`, `salesOrder`, `dc`, `invoice`) | Customer Master, FG Master, MRP Plan, FG Inventory & Dispatch | 1. Customer PO / Sales Order items reference `FGItem` with `name` and `description`.<br>2. Moving a Sales Order or Customer PO to MRP links `customerPo` / `salesOrder` and locks duplicate MRP generation unless unlocked on MRP deletion. | `06-sales-and-modules-smoke.test.js` |
| **HR Payroll, Salaries & Statements** (`getSalaries`, `createSalarySlip`, `updateSalary`, `companySalaryExcelHelper.ts`, `companySalaryPdfHelper.ts`, `SalariesTab.tsx`) | Employee Master (`employee.salary`), Attendance Validation, Saved Salaries Excel & PDF | 1. **Strict Employee Master Payment Structure**: Fetch `Basic`, `DA` (`specialAllowance`), `HRA`, `Conveyance`, and `Food` (`medical`) strictly from `employee.salary`—never auto-calculate `60/30/5/5` splits.<br>2. **Per-Day Rate & Week-Off Rule**: `Per Day = Fixed Salary / daysInMonth`. If `activeWorkingDays > 20`, all week-offs are paid; if `<= 20`, `floor(activeWorkingDays / 6)` week-offs are paid.<br>3. **OT Rate & Absent Shift**: Only when `isOTApplicable === true`. `Base OT Rate = Basic / daysInMonth / standardWorkingHours`. Absent working hours (`actualAbsentDays * standardWorkingHours`) shift from Main OT Multiplier to Absent OT Multiplier. | `06-sales-and-modules-smoke.test.js` |

---

## 2. Universal Data & UI Integration Invariants

### 2.1 Dynamic Space-Free & Multi-Keyword Search Invariant
- Across **all search inputs, table toolbars, BOM filters, Price List search bars, and Excel-style `ColumnFilter` popovers**, keyword search MUST use `isSpaceFreeMatch` / `matchesAnyField` from [`@/src/utils/spaceFreeSearchHelper`](file:///e:/Binserp/binserp_frontend/src/utils/spaceFreeSearchHelper.ts).
- **Never** strip spaces from controlled search input values on `onChange` (e.g., never do `e.target.value.trim()` inside `onChange`), so users can naturally type space-separated multi-word queries (e.g., `"ms plate 10mm"`).

### 2.2 Dual-UOM Precision & Rounding Invariant
- Whenever an item has `hasSecondaryUnit: true` and `conversionFactor > 0`:
  - Primary and Secondary quantities must stay synchronized using `conversionFactor` (or `primaryRatio` / `secondaryRatio`).
  - Floating-point arithmetic artifacts (such as `19.999999999999996`) must be normalized cleanly (up to 4 decimal places) in both backend helpers (`dualUomHelper.js`) and frontend forms/tables.

### 2.3 Sticky Table Header & Scroll Container Invariant
- In operational table views (such as Job Work Challan, WIP Inventory, Price Lists, and Store Ledgers), the page/tab header and filter toolbar must remain fixed (`shrink-0`), while **only the table body/container scrolls** (`flex-1 min-h-0 overflow-auto` with `sticky top-0 z-20` on `<thead>`).

---

## 3. Mandatory Protocol for Every Future Feature or Code Change

Whenever an AI Agent or developer adds a new feature, modifies an existing workflow, or fixes a bug, they **MUST** execute the following 4-step workflow before completing the task:

### Step 1: Impact Check
- Identify which row(s) of the **Cross-Module Integration Dependency Matrix** (Section 1) are touched by the change.
- Verify that all upstream and downstream fields (such as `descriptions`, `hasSecondaryUnit`, `linkedPOs`, `mrpPlanId`, `challanNumber`, `bypassTimeLock`) remain backward-compatible.

### Step 2: Static & Syntax Verification
- **Backend**: Run `node -c <modified_file.js>` on every modified backend file.
- **Frontend**: Run `npx tsc --noEmit` in `e:\Binserp\binserp_frontend` to ensure zero TypeScript errors.

### Step 3: Execute Automated Integration Test Suites (On-Demand Only)
- **Strict Rule**: **ONLY run the integration test commands below when the user explicitly asks to run integration tests.** Do NOT run `npm run test` / `npx vitest run` automatically unless requested by the user.
- **Frontend Integration Suite**:
  ```powershell
  cd e:\Binserp\binserp_frontend; npm run test
  ```
- **Backend Contract & Workflow Integration Suite**:
  ```powershell
  cd e:\Binserp\binserp_backend; npm run test
  ```

### Step 4: Evolve Integration Tests with Every Change
- **If a new feature or endpoint is added**: Add a corresponding integration test case in `binserp_backend/tests/integration/` or `binserp_frontend/tests/` verifying the new feature works end-to-end with its linked modules.
- **If an existing business rule or payload intentionally changes**: Update the corresponding integration test in the same commit/task so the test suite remains the single source of truth for BinsERP's live behavior.
- **If an existing integration test fails unexpectedly**: Do NOT delete or skip the test—fix the regression in the code so the existing workflow remains unbroken.

