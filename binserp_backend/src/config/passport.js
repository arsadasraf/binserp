import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Company } from "../models/company/index.js";

export const configurePassport = () => {
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

                    // Find if a company admin exists with this email
                    const company = await Company.findOne({ email });

                    if (!company) {
                        return done(null, {
                            isNewCompany: true,
                            email: email,
                            name: profile.displayName || ""
                        });
                    }

                    if (!company.isVerified) {
                        return done(null, false, { message: "Please verify your email first" });
                    }

                    // Pass the authenticated company forward
                    return done(null, company);
                } catch (error) {
                    return done(error, false);
                }
            }
        )
    );
};
