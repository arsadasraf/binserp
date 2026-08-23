/**
 * Helper to extract User Audit info (ID and display Name) from an authenticated Express Request
 */
export const getUserAudit = (req) => {
  const userId = req.user?._id || req.user?.id || null;
  let userName = "System";

  if (req.userType === "company") {
    userName = req.user?.companyName || req.user?.name || "Company Admin";
  } else if (req.user) {
    const fullName = [req.user?.firstName, req.user?.lastName].filter(Boolean).join(" ").trim();
    userName = fullName || req.user?.name || req.user?.username || req.user?.email || "User";
  }

  return { userId, userName };
};
