const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth");
const purchaseRoutes = require("./routes/purchases");
const salesInvoiceRoutes = require("./routes/salesInvoices");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  })
);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "winfab-billing-backend" });
});

app.use("/api/auth", authRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/sales-invoices", salesInvoiceRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
