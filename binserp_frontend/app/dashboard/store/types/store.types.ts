/**
 * Type definitions for Store Dashboard
 * Contains all TypeScript interfaces and types used across store components
 */

// Tab type for main navigation
export type TabType = "home" | "material-issue" | "grn" | "dc" | "billing" | "po" | "masters" | "bills-dc" | "bills-billing" | "bills-po" | "job-work" | "order-entry" | "quotation" | "mrp";

// Master data type for master tab navigation
export type MasterType = "vendor" | "customer" | "location" | "category" | "rm-bo-item" | "inhouse-items" | "fg-items" | "pending-products" | "ppc-products" | "grn-history" | "fg-grn-history" | "po-history" | "company-info" | "prefix-settings" | "job-work-supplier" | "print-settings";

// Bank Details interface for vendors and customers
export interface BankDetails {
    accountNumber?: string;
    ifscCode?: string;
    bankName?: string;
    branch?: string;
    branchName?: string;
    accountName?: string;
    swiftCode?: string;
}

// Item interface for transaction items (GRN, DC, PO, Billing)
export interface Item {
    materialName: string;
    quantity: string | number;
    unit: string;
    rate?: string | number;
}

// Form data interface - flexible to accommodate all form types
export interface StoreFormData {
    _id?: string;
    items?: Item[];

    // Master fields
    name?: string;
    code?: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    gst?: string;
    address?: string;
    city?: string;
    pincode?: string;
    state?: string;
    country?: string;
    district?: string;
    customerType?: 'Manufacturing Sales' | 'Labor-Job Sales';
    website?: string;
    billingAddress?: string;  // For customer
    billingCity?: string;
    billingPincode?: string;
    billingState?: string;
    billingDistrict?: string;
    billingCountry?: string;
    shippingAddress?: string;  // For customer
    shippingCity?: string;
    shippingPincode?: string;
    shippingState?: string;
    shippingDistrict?: string;
    shippingCountry?: string;
    description?: string;
    descriptions?: string; // For RM/BO item
    minimumStock?: number; // For RM/BO item
    photos?: any[]; // For RM/BO item and FG item
    unit?: string;
    hsnCode?: string;
    categoryId?: string;  // For material master

    locationId?: string;  // For material master
    type?: 'Component' | 'SubAssembly' | 'Assembly'; // For PPC Master Products
    revisionNumber?: string; // For FG items
    bom?: Array<{
        itemType?: string;
        item?: string;
        itemName?: string;
        quantity?: number | string;
        unit?: string;
        [key: string]: any;
    }>; // For FG items
    bankDetails?: BankDetails;  // For vendor and customer
    vendorType?: string;

    // Transaction fields
    grnNumber?: string;
    dcNumber?: string;
    poNumber?: string;
    invoiceNumber?: string;
    issueNumber?: string;
    vendorId?: string;

    customerId?: string;
    date?: string;

    // Job Work Supplier fields
    serviceTypes?: string[];
    processList?: string[];
    totalAmount?: string | number;
}

// Master data interfaces
export interface Vendor {
    _id: string;
    name: string;
    code?: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    gst?: string;
    address?: string;
    city?: string;
    pincode?: string;
    state?: string;
    country?: string;
    district?: string;
    bankDetails?: BankDetails;
    vendorType?: string;
    billingAddress?: string;
    billingCity?: string;
    billingPincode?: string;
    billingState?: string;
    billingDistrict?: string;
    billingCountry?: string;
    shippingAddress?: string;
    shippingCity?: string;
    shippingPincode?: string;
    shippingState?: string;
    shippingDistrict?: string;
    shippingCountry?: string;

}

export interface JobWorkSupplier {
    _id: string;
    name: string;
    code?: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    gst?: string;
    address?: string;

    city?: string;
    pincode?: string;
    state?: string;
    country?: string;
    district?: string;
    bankDetails?: BankDetails;
    processList?: string[] | Process[]; // Can be IDs or objects
}



export interface Customer {
    _id: string;
    name: string;
    code?: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    customerType?: 'Manufacturing Sales' | 'Labor-Job Sales';
    gst?: string;
    pan?: string;
    website?: string;
    paymentTerms?: string;
    creditLimit?: number;
    currency?: string;
    notes?: string;
    address?: string;
    city?: string;
    pincode?: string;
    state?: string;
    country?: string;
    billingAddress?: string;
    billingCity?: string;
    billingPincode?: string;
    billingState?: string;
    billingDistrict?: string;
    billingCountry?: string;
    shippingAddress?: string;
    shippingCity?: string;
    shippingPincode?: string;
    shippingState?: string;
    shippingDistrict?: string;
    shippingCountry?: string;
    bankDetails?: BankDetails;
    locationId?: string; // For Material form
}

export interface Location {
    _id: string;
    name: string;
    code?: string;
    description?: string;
}

export interface Category {
    _id: string;
    name: string;
    code?: string;
    unit?: string;
    hsnCode?: string;
}

export interface RmBoItem {
    _id: string;
    name: string;
    descriptions?: string;
    minimumStock?: number;
    photos?: string[];
    categoryId: string | Category;  // Can be ID or populated Category object
    locationId?: string | Location; // Can be ID or populated Location object
    category?: Category;  // Populated category data (alternative field)
    location?: Location;  // Populated location data
}

export interface Process {
    _id: string;
    processName: string;
    processCode: string;
    description?: string;
}

export interface CompanyInfo {
    _id?: string;
    companyName: string;
    contactPerson: string;
    contactNumber: string;
    email?: string;
    logo?: string; // URL to Cloudinary image
    gstNumber?: string;
    billingAddress: string;
    shippingAddress: string;
    qualitySpecs?: string;
    commercialTerms?: string;
    bankDetails?: BankDetails;
    printSettings?: {
        po: PrintConfig;
        dc: PrintConfig;
        invoice: PrintConfig;
    };
}

export interface PrintConfig {
    headerAlignment: 'left' | 'center' | 'right';
    headerText: string;
    showCompanyDetails: boolean;
    footerText: string;
    termsAndConditions: string;
}

// Inventory item interface
export interface InventoryItem {
    _id: string;
    materialName: string;
    materialCode: string;
    currentStock: number;
    reorderLevel: number;
    unit: string;
    locationId?: string | Location;  // Can be ID or populated Location object
    categoryId?: string | Category;  // Can be ID or populated Category object
    location?: Location;  // Populated location data (alternative field)
    category?: Category;  // Populated category data (alternative field)
    qcPendingStock?: number; // Added
}

// Transaction interfaces
export interface Transaction {
    _id: string;
    grnNumber?: string;
    dcNumber?: string;
    poNumber?: string;
    invoiceNumber?: string;
    issueNumber?: string;
    date: string;
    items?: Item[];
    vendorId?: string;
    customerId?: string;
    totalAmount?: number;
}

// GRN Form Data for new workflow
export interface GRNFormData {
    _id?: string; // Added for edit mode
    grnNumber?: string;  // Auto-generated
    date: string;
    type?: 'bo' | 'inhouse'; // Added type
    supplier?: string; // Made optional
    customerId?: string; // Added for InHouse
    poReference?: string;  // Optional PO reference number
    pdf?: string;  // URL to uploaded PDF (invoice/document)
    photos?: string[];  // Array of photo URLs
    qcRequired?: boolean; // New field for QC Workflow
    // Single material fields (backward compatibility)
    material?: string;  // Material ID from master
    component?: string; // Component ID (not inventory)
    materialName?: string;
    quantity: number;
    unit?: string;  // Auto-filled from material's category
    locationId: string;
    category?: string;  // Auto-filled from material's category
    rate?: number;  // Price per unit for backward compatibility
    // Multiple materials support
    items?: Array<{
        material: string;
        materialName: string;
        quantity: number;
        unit: string;
        locationId: string;
        rate?: number;  // Price per unit
    }>;
}

// PO Form Data for new workflow
export interface POFormData {
    _id?: string; // For edit mode
    poNumber?: string;  // Auto-generated
    date: string;
    vendor: string;  // Vendor ID
    // Single material fields (backward compatibility)
    material?: string;  // Material ID from master
    component?: string; // Component ID
    materialName?: string;
    quantity?: number;
    unit?: string;  // Auto-filled from material's category
    rate?: number;  // Price per unit
    amount?: number;  // Auto-calculated: quantity * rate
    category?: string;  // Auto-filled from material's category
    // Multiple materials support
    items?: Array<{
        itemType?: 'bo' | 'custom';
        material?: string;
        component?: string;
        materialName: string;
        quantity: number;
        unit: string;
        rate: number;
        amount: number;
        category?: string;
    }>;
    totalAmount?: number;  // Total of all items
}

// DC Form Data
export interface DCFormData {
    _id?: string;
    dcNumber?: string;  // Auto-generated
    date: string;
    customerName: string;
    customer?: string; // ID
    customerAddress?: string;
    items: Array<{
        material?: string; // ID
        component?: string;
        materialName: string;
        hsnCode?: string;
        quantity: number;
        unit: string;
        description?: string;
    }>;
    discount?: number;
    otherDetails?: string;
    status?: "Draft" | "Issued" | "Delivered";
}

// Billing/Invoice Form Data  
export interface BillingFormData {
    _id?: string;
    invoiceNumber?: string;  // Auto-generated
    date: string;
    customerName: string;
    customer?: string; // ID
    customerAddress?: string;
    customerGST?: string;
    items: Array<{
        material?: string; // ID
        component?: string;
        materialName: string;
        hsnCode?: string;
        quantity: number;
        unit: string;
        rate: number;
        amount: number;
        taxRate?: number;
        taxAmount?: number;
    }>;
    subtotal: number;
    discount?: number;
    taxAmount?: number;
    totalAmount: number;
    otherDetails?: string;
    status?: "Draft" | "Sent" | "Paid";
}

// Quotation Form Data
export interface QuotationFormData {
    _id?: string;
    quotationNumber?: string;
    date: string;
    customerName: string;
    customerAddress?: string;
    items: Array<{
        component?: string; // ID
        material?: string;
        productName: string;
        quantity: number;
        unit: string;
        rate: number;
        amount: number;
        taxRate?: number;
        taxAmount?: number;
        description?: string;
    }>;
    subtotal: number;
    discount?: number;
    taxAmount?: number;
    totalAmount: number;
    otherDetails?: string;
    status?: "Draft" | "Sent" | "Accepted" | "Rejected";
}

export interface JobWorkItem {
    _id?: string;
    item: string; // ID of Material or Component
    itemName: string;
    itemType: 'bo' | 'inhouse' | 'custom';
    processType: string;
    quantitySent: number;
    quantityReceived: number;
    unit: string;
    unitPrice?: number;
    description?: string;
    status: 'Sent' | 'Partial' | 'Completed';
}

export interface JobWorkChallan {
    _id: string;
    challanNumber: string;
    vendor: Vendor; // Populated
    date: string; // ISO Date
    expectedReturnDate?: string;
    status: 'Open' | 'Partial' | 'Closed' | 'Overdue';
    items: JobWorkItem[];
    createdAt: string;
}

export interface JobWorkFormData {
    challanNumber: string;
    vendor: string; // Vendor ID
    date: string;
    expectedReturnDate?: string;
    poNumber?: string;
    vehicleNo?: string;
    estimatedWeight?: number;
    estimatedPrice?: number;
    freightType?: 'To pay' | 'Paid' | 'LR/NR';
    lrNr?: string;
    eSugamNo?: string;
    eSugamDate?: string;
    items: {
        item: string;
        itemName?: string;
        itemToBeReceived?: string;
        itemType: 'bo' | 'inhouse' | 'custom';
        processType: string;
        quantitySent: number;
        unit: string;
        unitPrice?: number;
        description?: string;
    }[];
}

// Props interfaces for components
export interface StoreHeaderProps {
    // No props needed - static content
}

export interface MasterTabsProps {
    masterTab: MasterType;
    setMasterTab: (tab: MasterType) => void;
}

export interface SearchBarProps {
    searchTerm: string;
    setSearchTerm: (term: string) => void;
}

export interface StoreFormProps {
    activeTab: TabType;
    masterTab: MasterType;
    showForm: boolean;
    formData: FormData;
    setFormData: (data: FormData) => void;
    editingId: string | null;
    loading: boolean;
    vendors: Vendor[];

    customers: Customer[];
    locations: Location[];
    categories: Category[];
    processes?: Process[]; // Added processes prop
    onSubmit: (e: React.FormEvent) => void;
    onCancel: () => void;
    addItem: () => void;
    updateItem: (idx: number, field: string, value: any) => void;
    removeItem: (idx: number) => void;
}

export interface FormFieldsProps {
    formData: FormData;
    setFormData: (data: FormData) => void;
    masterTab?: MasterType;
    vendors?: Vendor[];
    customers?: Customer[];
}

export interface ItemsListProps {
    items: Item[];
    activeTab: TabType;
    updateItem: (idx: number, field: string, value: any) => void;
    removeItem: (idx: number) => void;
    addItem: () => void;
}

export interface StoreTableProps {
    activeTab: TabType;
    masterTab: MasterType;
    data: any[];
    loading: boolean;
    onEdit: (item: any) => void;
    onDelete: (id: string) => void;
    inHouseData?: any[];
    activeSubTab?: 'bo' | 'inhouse';
    onSubTabChange?: (tab: 'bo' | 'inhouse') => void;
}

export interface TableRowActionsProps {
    item: any;
    onEdit: (item: any) => void;
    onDelete: (id: string) => void;
}

// GRN Modal Props
export interface GRNModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: GRNFormData) => void;
    materials?: RmBoItem[];
    vendors?: Vendor[];
    locations?: Location[];
    categories?: Category[];
    loading?: boolean;
    initialData?: GRNFormData;
    isEditing?: boolean;
    type?: 'bo' | 'inhouse';
    customers?: Customer[];
}

// PO Modal Props
export interface POModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: POFormData) => void;
    materials: RmBoItem[];
    vendors: Vendor[];
    inHouseItems?: any[];
    loading: boolean;
    initialData?: POFormData;
    isEditing?: boolean;
}

// DC Modal Props
export interface DCModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: DCFormData) => void;
    customers: Customer[];
    loading: boolean;
    initialData?: DCFormData;
    isEditing?: boolean;
}

// Billing Modal Props
export interface BillingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: BillingFormData) => void;
    customers: Customer[];
    loading: boolean;
    initialData?: BillingFormData;
    isEditing?: boolean;
}

// Quotation Modal Props
export interface QuotationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: QuotationFormData) => void;
    components: any[];
    materials?: any[];
    loading: boolean;
    initialData?: QuotationFormData;
    isEditing?: boolean;
}

// Bills Tab Type
export type BillsTabType = "dc" | "billing" | "po" | "quotation";
