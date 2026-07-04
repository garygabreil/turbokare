# Garage Management System

A full-stack, responsive Garage Management System built with **Angular 20 (standalone components)**, **Bootstrap 5**, and **Cloud Firestore** as the backend.

It manages the day-to-day operations of an auto repair shop: customers, vehicles, job cards / repair orders, spare-parts inventory, and invoices — all with live data, form validation, and toast notifications.

## Features

- **Simple authentication** — register / login with email + password stored in Firestore. Session is kept in `localStorage`. Route guards protect the app and redirect unauthenticated users to the login page.
- **Dashboard** — live summary cards (customers, vehicles, active jobs, low-stock parts, unpaid invoices, revenue), recent job cards, and low-stock alerts.
- **Customers** — full CRUD with search.
- **Vehicles** — full CRUD, linked to a customer, with search.
- **Job Cards / Repairs** — create repair orders against a vehicle, assign a mechanic, track status (pending → in-progress → completed → delivered) with inline status updates and filtering.
- **Inventory / Parts (real-time)** — track SKU, quantity, reorder level, and price with automatic low-stock highlighting, a live stock-value total, and one-click **Stock In / Stock Out** adjustments. Every adjustment updates the balance instantly (Firestore live sync) and is written to an audit trail.
- **Invoices / Billing (GST & Non-GST)** — choose **GST** or **Non-GST** per invoice. GST invoices support **CGST+SGST** (intra-state) or **IGST** (inter-state) at standard 0/5/12/18/28% rates, an optional customer GSTIN (validated), and automatic tax breakdown. Non-GST invoices apply no tax. Dynamic line items with live subtotal / tax / total.
- **Reports & Audit** — a dedicated reports section with date-range filters and CSV export for:
  - **Sales** — invoices billed / collected / outstanding for a period.
  - **GST** — taxable value plus CGST / SGST / IGST totals for return filing.
  - **Inventory** — stock valuation and low-stock status.
  - **Stock Audit Log** — full history of every stock movement (who, what, when, before/after balances).
- **Notifications** — non-blocking toast messages for every action (success / error / info).
- **Form validation** — reactive forms with inline validation messages across every form.
- **Responsive** — Bootstrap grid + an offcanvas sidebar make it work on phones, tablets, and desktops.

## Tech stack

| Layer      | Technology                          |
| ---------- | ----------------------------------- |
| Frontend   | Angular 20 (standalone components)  |
| Styling    | Bootstrap 5 + Bootstrap Icons       |
| Backend    | Cloud Firestore (`@angular/fire`)   |
| State      | Angular Signals                     |

> ⚠️ **Security note:** By request, this project uses **plain-text passwords** and client-side auth. This is fine for a demo/learning project, but **do not** use this pattern for anything handling real user data. For production, use Firebase Authentication and hashed credentials.

## Prerequisites

- Node.js `^20.19` or `^22.12` or `>=24`
- npm 10+
- A Firebase project with **Firestore** enabled

## Getting started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Add your Firebase config**

   Create a Firebase project at <https://console.firebase.google.com>, enable **Cloud Firestore** (start in *test mode* for development), then copy your web-app config into:

   - `src/environments/environment.ts`
   - `src/environments/environment.prod.ts`

   Replace the placeholder values:

   ```ts
   export const environment = {
     production: false,
     firebase: {
       apiKey: 'AIza...',
       authDomain: 'your-project.firebaseapp.com',
       projectId: 'your-project',
       storageBucket: 'your-project.appspot.com',
       messagingSenderId: '1234567890',
       appId: '1:1234567890:web:abcdef',
     },
   };
   ```

3. **Run the dev server**

   ```bash
   npm start
   ```

   Open <http://localhost:4200>. Register an account, then start using the app.

4. **Build for production**

   ```bash
   npm run build
   ```

   Output is written to `dist/garage-management-system`.

## Firestore data model

Collections created automatically as you use the app:

- `users` — `{ name, email, password, role, createdAt }`
- `customers` — `{ name, phone, email, address, createdAt }`
- `vehicles` — `{ customerId, customerName, make, model, year, registrationNo, color, odometer, createdAt }`
- `jobCards` — `{ vehicleId, vehicleLabel, customerId, customerName, complaint, assignedTo, status, estimatedCost, notes, createdAt }`
- `parts` — `{ name, sku, category, quantity, reorderLevel, unitPrice, createdAt }`
- `stockMovements` — `{ partId, partName, sku, type (in|out|adjust), quantity, balanceBefore, balanceAfter, reason, performedBy, createdAt }`
- `invoices` — `{ invoiceNo, customerId, customerName, items[], billingType (gst|non-gst), gstType (cgst_sgst|igst), gstPercent, customerGstin, status, subtotal, cgst, sgst, igst, taxTotal, total, createdAt }`

### Suggested Firestore security rules (development)

While building, you can start in test mode. A slightly safer starting point:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // demo only — tighten before production
    }
  }
}
```

## Project structure

```
src/app/
├── core/
│   ├── guards/            # auth + guest route guards
│   ├── models/            # TypeScript interfaces
│   └── services/          # Firestore CRUD, auth, notifications
├── features/
│   ├── auth/              # login, register
│   ├── dashboard/
│   ├── customers/         # list + form
│   ├── vehicles/          # list + form
│   ├── job-cards/         # list + form
│   ├── inventory/         # list (real-time stock adjust) + form
│   ├── invoices/          # list + GST / Non-GST form
│   └── reports/           # sales, GST, inventory & audit reports
├── layout/shell/          # responsive navbar + sidebar shell
└── shared/toast-container/ # global toast notifications
```

## License

MIT — use it however you like.
