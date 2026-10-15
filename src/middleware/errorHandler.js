function notFound(req, res, next) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

function errorHandler(err, _req, res, _next) {
  console.error(err);

  if (err.name === "ValidationError") {
    return res.status(400).json({
      message: "Validation failed",
      errors: Object.values(err.errors).map((e) => e.message),
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({ message: "Duplicate key", fields: err.keyValue });
  }

  if (err.name === "CastError") {
    return res.status(400).json({
      message: `Invalid id${err.path ? ` for ${err.path}` : ""}`,
      value: err.value,
    });
  }

  res.status(err.status || 500).json({
    message: err.message || "Internal server error",
  });
}

module.exports = { notFound, errorHandler };
