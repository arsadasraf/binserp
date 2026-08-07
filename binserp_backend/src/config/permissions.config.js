// Central Registry of Actual System Modules, Real Tabs, and URL Sub-Routes for RBAC
export const SYSTEM_PERMISSIONS = [
  {
    module: "Admin",
    label: "Admin & User Management",
    tabs: [
      { id: "overview", label: "Overview", route: "/dashboard/admin/overview" },
      { id: "users", label: "User Management", route: "/dashboard/admin" },
      { id: "roles", label: "Role Management", route: "/dashboard/admin/roles" }
    ]
  },
  {
    module: "Store",
    label: "Store & Inventory",
    tabs: [
      { id: "inventory/rm-bo-stock", label: "Inventory RM & BO Stock", route: "/dashboard/store/inventory/rm-bo-stock" },
      { id: "inventory/inhouse-stock", label: "Inventory InHouse Stock", route: "/dashboard/store/inventory/inhouse-stock" },
      { id: "inventory/grn-history", label: "Inventory GRN History", route: "/dashboard/store/inventory/grn-history" },
      { id: "inventory/fg-grn-history", label: "Inventory FG GRN History", route: "/dashboard/store/inventory/fg-grn-history" },
      { id: "wip/requests", label: "WIP Material Requests", route: "/dashboard/store/wip/requests" },
      { id: "wip/history", label: "WIP Material Issue History", route: "/dashboard/store/wip/history" },
      { id: "sales/orders", label: "Sales Orders", route: "/dashboard/store/sales/orders" },
      { id: "sales/quotations", label: "Sales Quotations", route: "/dashboard/store/sales/quotations" },
      { id: "sales/billing", label: "Sales Billing / Invoices", route: "/dashboard/store/sales/billing" },
      { id: "sales/dc", label: "Sales Delivery Challans (DC)", route: "/dashboard/store/sales/dc" },
      { id: "sales/price-list", label: "Sales Price List", route: "/dashboard/store/sales/price-list" },
      { id: "sales/rfq", label: "Sales Incoming RFQ", route: "/dashboard/store/sales/rfq" },
      { id: "purchase/po", label: "Purchase Orders (PO)", route: "/dashboard/store/purchase/po" },
      { id: "purchase/mrp", label: "Purchase MRP & Planning", route: "/dashboard/store/purchase/mrp" },
      { id: "purchase/vendor-quotation", label: "Purchase Vendor Quotations", route: "/dashboard/store/purchase/vendor-quotation" },
      { id: "purchase/purchase-bill", label: "Purchase Bills & Invoices", route: "/dashboard/store/purchase/purchase-bill" },
      { id: "purchase/vendor-price-list", label: "Purchase Vendor Price List", route: "/dashboard/store/purchase/vendor-price-list" },
      { id: "masters/materials", label: "Materials Master", route: "/dashboard/store/masters/materials" },
      { id: "masters/vendors", label: "Vendors Master", route: "/dashboard/store/masters/vendors" },
      { id: "masters/customers", label: "Customers Master", route: "/dashboard/store/masters/customers" },
      { id: "masters/categories", label: "Categories Master", route: "/dashboard/store/masters/categories" },
      { id: "masters/locations", label: "Locations Master", route: "/dashboard/store/masters/locations" },
      { id: "masters/finished-goods", label: "Finished Goods Master", route: "/dashboard/store/masters/finished-goods" }
    ]
  },
  {
    module: "HR",
    label: "Human Resources",
    tabs: [
      { id: "home", label: "Overview", route: "/dashboard/hr?tab=home" },
      { id: "attendance", label: "Attendance Kiosk", route: "/dashboard/hr?tab=attendance" },
      { id: "present", label: "Present Log", route: "/dashboard/hr?tab=present" },
      { id: "salaries", label: "Salaries & Payroll", route: "/dashboard/hr?tab=salaries" },
      { id: "master", label: "HR Masters", route: "/dashboard/hr?tab=master" }
    ]
  },
  {
    module: "PPC",
    label: "PPC (Production Planning)",
    tabs: [
      { id: "overview", label: "Overview", route: "/dashboard/ppc?tab=overview" },
      { id: "orders", label: "Orders List", route: "/dashboard/ppc?tab=orders" },
      { id: "planning", label: "Planning", route: "/dashboard/ppc?tab=planning" },
      { id: "master", label: "PPC Masters", route: "/dashboard/ppc?tab=master" }
    ]
  },
  {
    module: "Security",
    label: "Gate Security & Entry",
    tabs: [
      { id: "security/overview", label: "Overview", route: "/dashboard/gate-entry/overview" },
      { id: "security/kiosk/manual", label: "Manual Attendance Kiosk", route: "/dashboard/gate-entry/kiosk/manual" },
      { id: "security/kiosk/face", label: "Face Kiosk", route: "/dashboard/gate-entry/kiosk/face" },
      { id: "security/visitor/active", label: "Active Visitor Log", route: "/dashboard/gate-entry/visitor/active" },
      { id: "security/visitor/history", label: "Visitor History Log", route: "/dashboard/gate-entry/visitor/history" },
      { id: "security/vehicle/active/unloading", label: "Vehicle Log (Unloading)", route: "/dashboard/gate-entry/vehicle/active/unloading" },
      { id: "security/vehicle/active/loading", label: "Vehicle Log (Loading)", route: "/dashboard/gate-entry/vehicle/active/loading" },
      { id: "security/vehicle/history/unloading", label: "Vehicle History (Unloading)", route: "/dashboard/gate-entry/vehicle/history/unloading" },
      { id: "security/vehicle/history/loading", label: "Vehicle History (Loading)", route: "/dashboard/gate-entry/vehicle/history/loading" },
      { id: "security/employee-movement/active", label: "Active Employee Movement", route: "/dashboard/gate-entry/employee-movement/active" },
      { id: "security/employee-movement/history", label: "Employee Movement History", route: "/dashboard/gate-entry/employee-movement/history" }
    ]
  },
  {
    module: "CRM",
    label: "CRM & Sales",
    tabs: [
      { id: "overview", label: "Overview", route: "/dashboard/crm" }
    ]
  },
  {
    module: "Accounts",
    label: "Accounts & Finance",
    tabs: [
      { id: "overview", label: "Overview", route: "/dashboard/accounts" }
    ]
  },
  {
    module: "Maintenance",
    label: "Maintenance",
    tabs: [
      { id: "overview", label: "Overview", route: "/dashboard/maintenance" }
    ]
  },
  {
    module: "Quality",
    label: "Quality Control",
    tabs: [
      { id: "overview", label: "Overview", route: "/dashboard/quality" }
    ]
  },
  {
    module: "Reports",
    label: "Reports & Analytics",
    tabs: [
      { id: "overview", label: "Overview", route: "/dashboard/reports" }
    ]
  }
];
