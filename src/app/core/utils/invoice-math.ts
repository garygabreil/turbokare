import { BillingType, DiscountType, GstType, InvoiceItem, InvoiceStatus } from '../models';

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
  discountTotal: number;
  total: number;
}

export interface InvoiceDiscount {
  type: DiscountType;
  value: number;
}

export interface InvoiceAdvanceAmounts {
  advanceAmount: number;
  balanceDue: number;
  status: InvoiceStatus;
}

/** Cap advance to total and derive balance + payment status. */
export function calculateAdvanceAmounts(total: number, advanceRaw: number): InvoiceAdvanceAmounts {
  const totalAmt = roundMoney(Math.max(0, Number(total) || 0));
  const advanceAmount = roundMoney(Math.min(Math.max(0, Number(advanceRaw) || 0), totalAmt));
  const balanceDue = roundMoney(Math.max(0, totalAmt - advanceAmount));
  let status: InvoiceStatus = 'unpaid';
  if (totalAmt > 0 && balanceDue <= 0) {
    status = 'paid';
  } else if (advanceAmount > 0) {
    status = 'partial';
  }
  return { advanceAmount, balanceDue, status };
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

export function unitPriceFromLineAmount(
  lineAmount: number,
  quantity: number,
  billingType: BillingType,
  gstType: GstType | undefined,
  gstPercent: number,
  itemType?: InvoiceItem['itemType'],
): number {
  const qty = Number(quantity) || 0;
  if (qty <= 0) {
    return 0;
  }

  const amount = roundMoney(Number(lineAmount) || 0);
  if (amount <= 0) {
    return 0;
  }

  const taxable = billingType === 'gst' && isPartForGst(itemType) && gstPercent > 0;
  if (!taxable) {
    return roundMoney(amount / qty);
  }

  // Initial guess from inclusive amount; refine so CGST/SGST split rounding
  // matches the entered figure (plain /1.18 can be off by ₹0.01).
  const taxMultiplier = 1 + gstPercent / 100;
  let unitPrice = roundMoney(amount / (qty * taxMultiplier));

  for (let i = 0; i < 20; i++) {
    const line = calculateLineAmounts(qty, unitPrice, billingType, gstType, gstPercent, itemType);
    const diff = roundMoney(amount - line.amount);
    if (diff === 0) {
      return unitPrice;
    }
    unitPrice = roundMoney(unitPrice + diff / qty);
  }

  return unitPrice;
}

export function calculateDiscountTotal(gross: number, discount?: InvoiceDiscount): number {
  if (!discount || discount.type === 'none') {
    return 0;
  }

  const value = Number(discount.value) || 0;
  if (value <= 0 || gross <= 0) {
    return 0;
  }

  if (discount.type === 'fixed') {
    return roundMoney(Math.min(value, gross));
  }

  if (discount.type === 'percent') {
    return roundMoney(Math.min(gross, (gross * value) / 100));
  }

  return 0;
}

export function calculateInvoiceAmounts(
  items: InvoiceItem[],
  billingType: BillingType,
  gstType: GstType | undefined,
  gstPercent: number,
  discount?: InvoiceDiscount,
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
  const gross = roundMoney(subtotal + taxTotal);
  const discountTotal = calculateDiscountTotal(gross, discount);
  const total = roundMoney(Math.max(0, gross - discountTotal));

  return { subtotal, cgst, sgst, igst, taxTotal, discountTotal, total };
}

export function normalizeInvoiceItem(item: InvoiceItem): InvoiceItem {
  return {
    ...item,
    quantity: Number(item.quantity) || 0,
    unitPrice: roundMoney(Number(item.unitPrice) || 0),
  };
}
