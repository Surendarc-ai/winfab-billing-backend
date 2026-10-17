const jwt = require("jsonwebtoken");

/** Trust JWT claims — no Mongo round-trip on every request */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload?.id) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    req.user = {
      _id: payload.id,
      id: payload.id,
      name: payload.name || "",
      email: payload.email || "",
      role: payload.role || "admin",
    };
    next();
  } catch (_err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

module.exports = { requireAuth };
