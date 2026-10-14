const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const authRoutes = require("./routes/auth");
const purchaseRoutes = require("./routes/purchases");
const salesInvoiceRoutes = require("./routes/salesInvoices");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "winfab-billing-backend" });
});

app.use("/api/auth", authRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/sales-invoices", salesInvoiceRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
