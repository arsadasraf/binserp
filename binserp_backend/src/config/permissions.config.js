// Central Registry of Actual System Modules, Main Tabs, and Entry Routes for RBAC
export const SYSTEM_PERMISSIONS = [
  {
    module: "Store",
    label: "Store & Inventory",
    tabs: [
      { id: "inventory", label: "Inventory", description: "RM & BO Stock, In-House Stock, GRN & FG GRN History", route: "/dashboard/store/inventory/rm-bo-stock" },
      { id: "wip", label: "WIP", description: "WIP Material Requests & Issue History", route: "/dashboard/store/wip/requests" },
      { id: "sales", label: "Sales", description: "Sales Orders, Quotations, Invoices, Delivery Challans, Price List, RFQ", route: "/dashboard/store/sales/orders" },
      { id: "purchase", label: "Purchase", description: "Purchase Orders (PO), MRP Planning, Vendor Quotes, Purchase Bills", route: "/dashboard/store/purchase/po" },
      { id: "masters", label: "Masters", description: "Materials, Vendors, Customers, Categories, Locations, Finished Goods", route: "/dashboard/store/masters/vendors" }
    ]
  },
  {
    module: "HR",
    label: "Human Resources",
    tabs: [
      { id: "overview", label: "Overview", description: "HR Dashboard & Analytics", route: "/dashboard/hr?tab=home" },
      { id: "kiosk", label: "Attendance Kiosk", description: "Live Camera & Manual Check-in Kiosk", route: "/dashboard/hr?tab=attendance" },
      { id: "present", label: "Present Log", description: "Live Attendance & Presence Records", route: "/dashboard/hr?tab=present" },
      { id: "salaries", label: "Salaries & Payroll", description: "Salaries, Overtime & Payout Slips", route: "/dashboard/hr?tab=salaries" },
      { id: "masters", label: "HR Masters", description: "Employees, Departments, Designations, Holidays, Settings", route: "/dashboard/hr?tab=master" }
    ]
  },
  {
    module: "PPC",
    label: "PPC (Production Planning)",
    tabs: [
      { id: "overview", label: "Overview", description: "Production Analytics & KPIs", route: "/dashboard/ppc/overview" },
      { id: "orders", label: "Orders List", description: "PPC Production Orders & Batches", route: "/dashboard/ppc/orders" },
      { id: "planning", label: "Planning", description: "Machine & Material Scheduling", route: "/dashboard/ppc/planning" },
      { id: "tracing", label: "Traceability", description: "Route Cards & Work-in-Progress Tracking", route: "/dashboard/ppc/tracing" },
      { id: "masters", label: "PPC Masters", description: "Work Centers, Machines & Routing Masters", route: "/dashboard/ppc/master" }
    ]
  },
  {
    module: "Security",
    label: "Gate Security & Entry",
    tabs: [
      { id: "overview", label: "Overview", description: "Gate Entry Real-Time Overview", route: "/dashboard/gate-entry?tab=overview" },
      { id: "kiosk", label: "Kiosk Mode", description: "Gate Face & Manual Attendance Kiosks", route: "/dashboard/gate-entry?tab=kiosk" },
      { id: "visitor", label: "Visitor Log", description: "Active Visitor Passes & History", route: "/dashboard/gate-entry?tab=visitor" },
      { id: "vehicle", label: "Vehicle Log", description: "Loading & Unloading Gate Vehicle Movement", route: "/dashboard/gate-entry?tab=vehicle" },
      { id: "employee-movement", label: "Employee Movement", description: "Gate In/Out Activity Log", route: "/dashboard/gate-entry?tab=employee-movement" }
    ]
  },
  {
    module: "Quality",
    label: "Quality Control",
    tabs: [
      { id: "overview", label: "Overview", description: "Quality KPIs, Inspection Analytics & Rejection Rates", route: "/dashboard/quality/overview" },
      { id: "incoming", label: "Incoming QC", description: "RM & BO Purchase GRN Quality Inspections & SCN Reports", route: "/dashboard/quality/incoming" },
      { id: "process", label: "Process QC", description: "In-Process Quality Checks & Production Line Inspections", route: "/dashboard/quality/process" },
      { id: "jobwork-qc", label: "Job Work QC", description: "Subcontractor Inward Quality Inspection & Approvals", route: "/dashboard/quality/jobwork-qc" },
      { id: "fg-qc", label: "FG QC & PDI", description: "Finished Goods PDI & Final Product Quality Certifications", route: "/dashboard/quality/fg-qc" },
      { id: "master", label: "Quality Masters", description: "Inspection Parameters, Instruments & Tolerance Standards", route: "/dashboard/quality/master" }
    ]
  },
  {
    module: "Admin",
    label: "Admin & User Management",
    tabs: [
      { id: "overview", label: "Overview", description: "Company Profile & Overview", route: "/dashboard/admin/overview" },
      { id: "users", label: "User Management", description: "User Accounts & Credentials", route: "/dashboard/admin" },
      { id: "roles", label: "Role Management", description: "Roles & RBAC Access Control", route: "/dashboard/admin/roles" }
    ]
  },
  {
    module: "CRM",
    label: "CRM & Sales",
    tabs: [
      { id: "overview", label: "CRM Overview", description: "Lead Pipeline, Customers & Deals", route: "/dashboard/crm" }
    ]
  },
  {
    module: "Accounts",
    label: "Accounts & Finance",
    tabs: [
      { id: "overview", label: "Accounts Overview", description: "Ledgers, Receivables & Payables", route: "/dashboard/accounts" }
    ]
  },
  {
    module: "Maintenance",
    label: "Maintenance",
    tabs: [
      { id: "overview", label: "Maintenance Overview", description: "Equipment Status & Preventive Schedules", route: "/dashboard/maintenance" }
    ]
  },
  {
    module: "Reports",
    label: "Reports & Analytics",
    tabs: [
      { id: "overview", label: "Reports Overview", description: "Cross-departmental BI & Export Reports", route: "/dashboard/reports" }
    ]
  }
];

