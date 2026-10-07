export interface PurchaseBillItem {
  _id?: string;
  material?: any;
  consumable?: any;
  materialName: string;
  description?: string;
  hsnCode?: string;
  quantity: number;
  unit: string;
  secondaryQuantity?: number;
  secondaryUnit?: string;
  selectedUnit?: string;
  rate: number;
  amount: number;
}

export interface PaymentHistoryRecord {
  _id?: string;
  paymentDate: string;
  amountPaid: number;
  paymentMode: 'Bank Transfer' | 'NEFT' | 'RTGS' | 'UPI' | 'Cheque' | 'Cash' | 'Other' | string;
  transactionRef?: string;
  notes?: string;
  recordedBy?: string;
  recordedByName?: string;
  recordedAt?: string;
}

export interface BillComment {
  _id?: string;
  comment: string;
  userName: string;
  userId?: string;
  createdAt: string;
}

export interface PurchaseBill {
  _id: string;
  billNumber: string;
  supplierInvoiceNumber?: string;
  date: string;
  vendor?: any;
  vendorName: string;
  vendorAddress?: string;
  vendorGst?: string;
  poReference?: string;
  poNumber?: string;
  grnReference?: string;
  grnNumber?: string;
  grn?: any;
  grnCategory?: 'rm' | 'bo' | 'consumable' | 'other' | string;
  billType?: 'material' | 'job-work-service';
  items: PurchaseBillItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalTax?: number;
  transportationCharges?: number;
  packingCharges?: number;
  grandTotal: number;
  paymentTerms?: string;
  creditDays?: number;
  dueDate?: string;
  paymentStatus: 'Unpaid' | 'Partially Paid' | 'Paid' | 'Overdue';
  paidAmount: number;
  balanceAmount: number;
  paymentHistory: PaymentHistoryRecord[];
  comments: BillComment[];
  status?: string;
  remarks?: string;
  createdBy?: any;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PurchaseBillMetrics {
  totalBillsCount: number;
  totalBillAmount: number;
  totalPaidAmount: number;
  totalOutstandingAmount: number;
  overdueCount: number;
  unpaidCount: number;
  paidCount: number;
}
