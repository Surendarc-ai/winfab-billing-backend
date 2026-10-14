# WinFab Billing Backend

Express + MongoDB API for purchases (PO) and sales invoices.

## Multi-invoice per PO

1. Create a **Purchase Order** with supplier + line items (`qty`, `rate`, `amount`).
2. Create a **Sales Invoice** against that PO, selecting line items and billing qty ≤ remaining (`qty - billedQty`).
3. Repeat — each new invoice uses remaining qty until the PO is fully billed (`status: closed`).

## Setup

```bash
nvm use 20
npm install
cp .env.example .env
npm run dev
```

Default login: `admin@winfab.com` / `admin123`

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | no | Login |
| GET | `/api/auth/me` | yes | Current user |
| CRUD | `/api/purchases` | yes | Purchase orders |
| CRUD | `/api/sales-invoices` | yes | Sales invoices |
