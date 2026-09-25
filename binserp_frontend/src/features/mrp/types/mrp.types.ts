export type MRPStatus = 
  | 'Draft' 
  | 'Planned' 
  | 'In Procurement' 
  | 'In Production' 
  | 'Partially Completed' 
  | 'Completed';

export type MRPRequirementStatus =
  | 'Pending'
  | 'PO Raised'
  | 'Partially Received'
  | 'Received'
  | 'Issued'
  | 'Completed'
  | 'Cancelled';

export interface MRPRequirementItem {
  _id?: string;
  itemId?: string;
  itemType?: 'RawMaterial' | 'BoughtOut' | 'Component' | 'SubAssembly';
  itemCode?: string;
  name: string;
  descriptions?: string;
  description?: string;
  unit?: string;
  requiredQuantity: number;
  stockAvailable?: number;
  shortage?: number;
  orderedQuantity?: number;
  receivedQuantity?: number;
  status: MRPRequirementStatus;
  leadTimeDays?: number;
  estimatedRate?: number;
  preferredVendor?: string;
}

export interface MRPFinishedGoodItem {
  _id?: string;
  fgItem?: string;
  itemCode?: string;
  name: string;
  description?: string;
  quantity: number;
  bomId?: string;
  unit?: string;
  receivedQuantity?: number;
}

export interface MRPPlan {
  _id: string;
  mrpNumber: string;
  company?: string;
  customerPoNumber?: string;
  customerPo?: any;
  customerName?: string;
  isConsolidated?: boolean;
  customerPOs?: Array<{
    customerPo?: string;
    customerPoNumber?: string;
    customer?: any;
    customerName?: string;
    poDate?: string;
    targetDate?: string;
  }>;
  poDate?: string;
  targetDate?: string;
  remarks?: string;
  status: MRPStatus;
  ppcStatus?: 'Pending' | 'Sent' | 'In Production' | 'Completed';
  fgItems?: MRPFinishedGoodItem[];
  rmRequirements?: MRPRequirementItem[];
  boRequirements?: MRPRequirementItem[];
  componentRequirements?: MRPRequirementItem[];
  createdAt?: string;
  updatedAt?: string;
  hasTransactions?: boolean;
  linkedPOCount?: number;
}

export interface MRPWorkbenchShortageItem {
  materialId: string;
  materialName: string;
  materialCode: string;
  itemType: 'rm' | 'bo' | 'component';
  unit: string;
  totalRequired: number;
  currentStock: number;
  onOrderStock: number;
  netShortage: number;
  suggestedAction: 'PO' | 'JobWork' | 'Internal';
  mrpNumbers: string[];
}
