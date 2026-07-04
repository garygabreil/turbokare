export interface AppUser {
  id?: string;
  name: string;
  email: string;
  // NOTE: This project uses simple, plain-text password auth by request.
  // Do not use this pattern for anything that handles real, sensitive data.
  password: string;
  role: 'admin' | 'staff';
  createdAt?: number;
}

export interface Customer {
  id?: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  createdAt?: number;
}

export interface Vehicle {
  id?: string;
  customerId: string;
  customerName?: string;
  make: string;
  model: string;
  year?: number | null;
  registrationNo: string;
  color?: string;
  odometer?: number | null;
  createdAt?: number;
}

export type JobStatus = 'pending' | 'in-progress' | 'completed' | 'delivered';

export interface JobCard {
  id?: string;
  vehicleId: string;
  vehicleLabel?: string;
  customerId: string;
  customerName?: string;
  complaint: string;
  assignedTo?: string;
  status: JobStatus;
  estimatedCost?: number | null;
  notes?: string;
  createdAt?: number;
}

export interface Part {
  id?: string;
  name: string;
  sku: string;
  category?: string;
  quantity: number;
  reorderLevel: number;
  unitPrice: number;
  createdAt?: number;
}

export type StockMovementType = 'in' | 'out' | 'adjust';

export interface StockMovement {
  id?: string;
  partId: string;
  partName: string;
  sku?: string;
  type: StockMovementType;
  quantity: number;
  balanceBefore: number;
  balanceAfter: number;
  reason?: string;
  performedBy?: string;
  createdAt?: number;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export type InvoiceStatus = 'unpaid' | 'paid' | 'partial';
export type BillingType = 'gst' | 'non-gst';
export type GstType = 'cgst_sgst' | 'igst';

export interface Invoice {
  id?: string;
  invoiceNo: string;
  customerId: string;
  customerName?: string;
  jobCardId?: string;
  items: InvoiceItem[];
  billingType: BillingType;
  gstType?: GstType;
  gstPercent: number;
  customerGstin?: string;
  status: InvoiceStatus;
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  taxTotal: number;
  total: number;
  createdAt?: number;
}
