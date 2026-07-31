import jwt from "jsonwebtoken";

export const generateTokens = (id, type, companyId = null, tokenVersion = 0) => {
  const payload = { id, type, tokenVersion };
  if (companyId) {
    payload.companyId = companyId;
  }

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "1h", // 1-hour access token
  });

  const refreshToken = jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET, {
    expiresIn: "30d", // 30 days refresh token
  });

  return { accessToken, refreshToken };
};

export const setTokenCookies = (res, accessToken, refreshToken) => {
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 1000, // 1 hour
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });
};
