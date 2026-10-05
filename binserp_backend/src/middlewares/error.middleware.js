import { ApiError } from "../utils/ApiError.js";

export const globalErrorHandler = (err, req, res, next) => {
  // Only log full stack trace for unhandled 5xx server crashes, log client errors cleanly
  if (err instanceof ApiError && err.statusCode < 500) {
    console.warn(`[Client ${err.statusCode}] ${err.message}`);
  } else if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    console.warn(`[Auth ${err.name}] ${err.message}`);
  } else {
    console.error("🔥 Global Error Handler:", err);
  }

  // Handle custom ApiError
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Invalid token, please log in again.",
    });
  }

  // Handle Mongoose validation or cast errors
  if (err.name === "ValidationError") {
    const formattedMessages = Object.values(err.errors || {}).map((e) => {
      let msg = e.message || "Invalid input";
      // Convert "Path `itemType` is required." -> "Item Type is required."
      msg = msg.replace(/Path `(\w+)` is required\./gi, (_match, p1) => {
        const readable = p1.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
        return `${readable.charAt(0).toUpperCase() + readable.slice(1)} is required.`;
      });
      // Convert "`XYZ` is not a valid enum value for path `abc`." -> "XYZ is not a valid option for abc."
      msg = msg.replace(/`([^`]+)` is not a valid enum value for path `(\w+)`\./gi, (_match, val, path) => {
        const readable = path.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
        return `"${val}" is not a valid option for ${readable}.`;
      });
      return msg;
    });

    return res.status(400).json({
      success: false,
      message: formattedMessages.join("; ") || "Validation failed. Please verify input fields.",
    });
  }

  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: `Invalid ${err.path}: ${err.value}`,
    });
  }

  // Fallback for unhandled errors
  res.status(500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
};
