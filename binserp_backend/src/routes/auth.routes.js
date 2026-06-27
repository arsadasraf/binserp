import express from "express";
import passport from "passport";
import { googleAuthCallback } from "../controllers/auth/index.js";

const router = express.Router();

// @route   GET /api/auth/google
// @desc    Auth with Google
router.get(
    "/google",
    (req, res, next) => {
        const origin = req.query.origin || process.env.FRONTEND_URL || 'http://localhost:3000';
        passport.authenticate("google", { 
            scope: ["profile", "email"], 
            session: false,
            state: origin
        })(req, res, next);
    }
);

// @route   GET /api/auth/google/callback
// @desc    Google auth callback
router.get(
    "/google/callback",
    (req, res, next) => {
        passport.authenticate("google", { session: false }, (err, user, info) => {
            const frontendUrl = req.query.state || process.env.FRONTEND_URL || 'http://localhost:3000';
            if (err) {
                return res.redirect(`${frontendUrl}/login?error=Server_Error`);
            }
            if (!user) {
                const errorMessage = info && info.message ? info.message : 'Auth_Failed';
                return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(errorMessage)}`);
            }
            req.user = user;
            req.frontendUrl = frontendUrl;
            next();
        })(req, res, next);
    },
    googleAuthCallback
);

export default router;
