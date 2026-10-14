const jwt = require("jsonwebtoken");
const User = require("../models/User");

function signToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
}

async function me(req, res) {
  res.json({ user: publicUser(req.user) });
}

async function ensureAdminUser() {
  const email = (process.env.ADMIN_EMAIL || "admin@winfab.com").toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) return;

  await User.create({
    name: process.env.ADMIN_NAME || "WinFab Admin",
    email,
    password: process.env.ADMIN_PASSWORD || "admin123",
    role: "admin",
  });
  console.log(`Seeded admin user: ${email}`);
}

module.exports = { login, me, ensureAdminUser };
