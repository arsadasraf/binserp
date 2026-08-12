import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Company } from "../models/company/index.js";
import { SaasAdmin } from "../models/saasadmin/saasadmin.model.js";

export const configurePassport = () => {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: process.env.GOOGLE_CALLBACK_URL || "/api/auth/google/callback",
          passReqToCallback: true,
        },
        async (req, accessToken, refreshToken, profile, done) => {
          try {
            // Extract email from Google profile
            const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null;

            if (!email) {
              return done(null, false, { message: "No email associated with this Google Account" });
            }

            const saasAdminEmail = (process.env.SAAS_ADMIN_EMAIL || "").toLowerCase().trim();

            // 👑 1. Check if email matches configured SaaS Admin Gmail
            if (saasAdminEmail && email.toLowerCase().trim() === saasAdminEmail) {
              let saasAdmin = await SaasAdmin.findOne({ email: saasAdminEmail });

              if (!saasAdmin) {
                saasAdmin = await SaasAdmin.create({
                  username: email.split("@")[0] || "saasadmin",
                  email: saasAdminEmail,
                  password: "GoogleOAuthManagedPassword_StrictLock",
                  roleLevel: 100,
                });
                console.log("[Google OAuth] Initialized SaaS Admin document for:", saasAdminEmail);
              }

              return done(null, {
                isSaasAdmin: true,
                saasAdmin,
              });
            }

            // 🏢 2. Standard Company Admin login lookup
            const company = await Company.findOne({ email: email.toLowerCase() });

            if (!company) {
              return done(null, {
                isNewCompany: true,
                email: email,
                name: profile.displayName || "",
              });
            }

            if (!company.isVerified) {
              return done(null, false, { message: "Please verify your email first" });
            }

            // Pass authenticated company forward
            return done(null, company);
          } catch (error) {
            return done(error, false);
          }
        }
      )
    );
  } else {
    console.warn("Google OAuth credentials missing. Google login will be disabled.");
  }
};
