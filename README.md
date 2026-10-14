# WinFab Billing Backend

Express + MongoDB API for purchases (PO) and sales invoices. Runs locally or on AWS Lambda.

## Multi-invoice per PO

1. Create a **Purchase Order** with supplier + line items (`qty`, `rate`, `amount`).
2. Create a **Sales Invoice** against that PO, selecting line items and billing qty ≤ remaining (`qty - billedQty`).
3. Repeat — each new invoice uses remaining qty until the PO is fully billed (`status: closed`).

## Local setup

```bash
nvm use 20
npm install
cp .env.example .env
npm run dev
```

Default login: `admin@winfab.com` / `admin123`

## Deploy to AWS Lambda

Requires AWS CLI + SAM CLI configured (`ap-south-1`).

```bash
nvm use 20
# ensure .env has MONGODB_URI, JWT_SECRET, FRONTEND_URL, etc.
npm run deploy
```

Stack name: `winfab-billing-api`  
Function: `winfab-billing-api`

In MongoDB Atlas Network Access, allow `0.0.0.0/0` (or Lambda egress IPs) so the function can reach the cluster.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | no | Login |
| GET | `/api/auth/me` | yes | Current user |
| CRUD | `/api/purchases` | yes | Purchase orders |
| CRUD | `/api/sales-invoices` | yes | Sales invoices |
