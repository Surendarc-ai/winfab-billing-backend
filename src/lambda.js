require("dotenv").config();

const serverless = require("serverless-http");
const app = require("./app");
const connectDB = require("./config/db");
const { ensureAdminUser } = require("./controllers/authController");

let ready;

async function bootstrap() {
  await connectDB();
  await ensureAdminUser();
}

// API Gateway HTTP API stage is "/prod" in the request path
const httpHandler = serverless(app, {
  binary: false,
  basePath: process.env.API_BASE_PATH || "/prod",
});

exports.handler = async (event, context) => {
  // Reuse DB connections across warm Lambda invocations
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    if (!ready) {
      ready = bootstrap();
    }
    await ready;
  } catch (err) {
    ready = null;
    throw err;
  }

  return httpHandler(event, context);
};
