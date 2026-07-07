import { BillingType, GstType, InvoiceItem } from '../models';

/** Round to 2 decimal places for currency (INR). */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface InvoiceLineAmounts {
  base: number;
  cgst: number;
  sgst: number;
  igst: number;
  amount: number;
}

export interface InvoiceAmounts {
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  taxTotal: number;
  total: number;
}

/** GST applies to parts/spares only — not labour or services. */
export function isPartForGst(itemType?: InvoiceItem['itemType']): boolean {
  return itemType !== 'service';
}

export function calculateLineAmounts(
  quantity: number,
  unitPrice: number,
  billingType: BillingType,
  gstType: GstType | undefined,
  gstPercent: number,
  itemType?: InvoiceItem['itemType'],
): InvoiceLineAmounts {
  const base = roundMoney(quantity * unitPrice);
  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  const taxable = billingType === 'gst' && isPartForGst(itemType) && gstPercent > 0;

  if (taxable && gstType === 'cgst_sgst') {
    const halfRate = gstPercent / 2;
    cgst = roundMoney((base * halfRate) / 100);
    sgst = cgst;
  } else if (taxable && gstType === 'igst') {
    igst = roundMoney((base * gstPercent) / 100);
  }

  return {
    base,
    cgst,
    sgst,
    igst,
    amount: roundMoney(base + cgst + sgst + igst),
  };
}

export function calculateInvoiceAmounts(
  items: InvoiceItem[],
  billingType: BillingType,
  gstType: GstType | undefined,
  gstPercent: number,
): InvoiceAmounts {
  let subtotal = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  for (const item of items) {
    const line = calculateLineAmounts(
      item.quantity,
      item.unitPrice,
      billingType,
      gstType,
      gstPercent,
      item.itemType,
    );
    subtotal += line.base;
    cgst += line.cgst;
    sgst += line.sgst;
    igst += line.igst;
  }

  subtotal = roundMoney(subtotal);
  cgst = roundMoney(cgst);
  sgst = roundMoney(sgst);
  igst = roundMoney(igst);
  const taxTotal = roundMoney(cgst + sgst + igst);
  const total = roundMoney(subtotal + taxTotal);

  return { subtotal, cgst, sgst, igst, taxTotal, total };
}

export function normalizeInvoiceItem(item: InvoiceItem): InvoiceItem {
  return {
    ...item,
    quantity: Number(item.quantity) || 0,
    unitPrice: roundMoney(Number(item.unitPrice) || 0),
  };
}
