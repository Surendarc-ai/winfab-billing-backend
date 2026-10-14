require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");
const { ensureAdminUser } = require("./controllers/authController");

const PORT = process.env.PORT || 5001;

async function start() {
  try {
    await connectDB();
    await ensureAdminUser();
    app.listen(PORT, () => {
      console.log(`WinFab Billing API running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  }
}

start();
