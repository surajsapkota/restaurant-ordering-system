# Restaurant POS System (Bombay to Mumbai) — Backend API

## Overview
This project is a **Restaurant POS (Point of Sale) backend system** built for *Bombay to Mumbai Indian & Hakka Cuisine*.

The goal is to support a real restaurant workflow:
- Employees log in on a tablet using a **PIN**
- A shift is **opened** for a specific terminal/tablet (ex: `TABLET-1`)
- Orders are created and tracked during the shift
- Orders can be sent to kitchen, marked ready, paid, voided, and closed
- At the end, a manager closes the shift and gets totals (sales, tax, count, etc.)
- All records stay saved for future reporting (months/years later)

---

## Tech Stack
- **Node.js + Express** (API server)
- **TypeScript**
- **Prisma ORM**
- **PostgreSQL** (database)
- **JWT Authentication** (token-based login)
- **Jest + Supertest** (automated testing)

---

## Project Folder Structure (Backend)
Typical important folders/files:
- `src/server.ts` → starts the server on a port
- `src/app.ts` → Express app setup, middleware, routes
- `src/db/prisma.ts` → Prisma client connection (database access)
- `src/routes/` → all API endpoints split by feature
  - `auth.routes.ts`
  - `shifts.routes.ts`
  - `orders.routes.ts`
  - `menu.routes.ts`
- `src/middleware/requireAuth.ts` → protects routes (JWT required)
- `prisma/schema.prisma` → database models (tables)
- `prisma/seed.ts` → inserts demo data (users/menu items/categories)
- `src/__tests__/pos-flow.test.ts` → full flow automated test

---

## How Authentication Works (PIN → Token)
This POS uses JWT tokens:
1. Employee enters a PIN (example: `1234`)
2. Backend checks user in DB
3. Backend returns a **JWT token**
4. For protected routes, client must send:
   - `Authorization: Bearer <token>`

✅ Why we did this:
- Tablets should not store passwords repeatedly
- Token confirms “this employee is logged in”
- Backend can track who created orders / voids / shifts

---

## Core POS Flow (Real Restaurant Workflow)

### 1) Login (PIN)
Employee logs in and receives token.

### 2) Open Shift
A shift is opened for the day and for a specific terminal:
- Example terminal: `TABLET-1`

This shift stores:
- who opened it
- when it started
- opening cash amount

### 3) Create Orders (must be linked to OPEN shift)
Orders are created with:
- `shiftId` (must be OPEN)
- `terminalCode` (ex: `TABLET-1`)
- `type` (`DINE_IN`, `TAKEOUT`, `DELIVERY`)
- items from menu

✅ Why we link orders to shift:
- So reporting is accurate per day/shift
- So closing shift can calculate totals properly

### 4) Payment
Orders can be marked as paid:
- `CASH` or `CARD`
Stores payment method + payment status.

### 5) Void Order / Void Item
We added void support:
- Void whole order (cancel order)
- Void single item (remove item from order)

✅ Why void logs matter:
Even if something is removed, we still keep a record:
- what was voided
- why it was voided
- who voided it
This is important for restaurant auditing and manager review.

### 6) Close Shift (Totals)
Manager closes shift and system returns totals like:
- gross sales
- net sales
- order count
- cash/card totals
- closing cash amount
- timestamps (openedAt/closedAt)

---

## API Routes Summary (What Exists)

### Auth
- `POST /auth/pin` → login with PIN → returns JWT token

### Menu
- `GET /menu` → list menu items (active)

### Shifts
- `POST /shifts/open` → open a shift
- `POST /shifts/close` → close shift + return totals
- (optional) `GET /shifts` → view past shifts (if you created it)

### Orders
- `GET /orders` → list orders + filter by status/payment/type
- `POST /orders` → create new order (requires OPEN shift + terminalCode)
- `PATCH /orders/:id/status` → update order status (NEW → IN_KITCHEN → READY → CLOSED)
- `PATCH /orders/:id/payment` → mark paid (CASH/CARD)
- `POST /orders/:id/void` → void whole order
- `POST /orders/:id/items/:orderItemId/void` → void one item

---

## How Calculations Work (Totals)
All money values are stored in **cents** in the database.
Example:
- $2.50 → `250`

Tax uses a configurable rate:
- `TAX_RATE = 0.13` (Ontario HST default)

Order total:
- `subtotalCents + taxCents + tipCents`

✅ Why cents:
- prevents rounding issues in money
- more accurate and standard practice for POS apps

---

## Running the Project (Local Setup)

### 1) Install dependencies
```bash
cd apps/api
npm install

import fs from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";

const CASHIER_PRINTER_NAME = "Cashier";

export async function printCashierReceiptText(text: string): Promise<void> {
  const filePath = path.join(os.tmpdir(), `receipt-${Date.now()}.txt`);

  const rawText =
    "\x1B\x40" +
    "\x1B\x61\x00" +
    text +
    "\n\n\n\n" +
    "\x1D\x56\x00";

  fs.writeFileSync(filePath, rawText, "binary");

  const printerPath = "\\\\localhost\\" + CASHIER_PRINTER_NAME;
  const command = `copy /B "${filePath}" "${printerPath}"`;

  return new Promise((resolve, reject) => {
    execFile("cmd", ["/c", command], (error) => {
      try {
        fs.unlinkSync(filePath);
      } catch {}

      if (error) return reject(error);
      resolve();
    });
  });
}

...Pinter Worked