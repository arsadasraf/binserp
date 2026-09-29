import express from "express";
import passport from "passport";
import { googleAuthCallback, refreshTokens, logout } from "../controllers/auth/index.js";

const router = express.Router();

const getAllowedOrigin = (requestedOrigin) => {
    const defaultOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';
    if (!requestedOrigin) return defaultOrigin;

    try {
        const parsed = new URL(requestedOrigin);
        if (defaultOrigin) {
            const parsedDefault = new URL(defaultOrigin);
            if (parsed.origin === parsedDefault.origin) return parsed.origin;
        }
        if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
            return parsed.origin;
        }
        if (parsed.hostname === 'binserp.com' || parsed.hostname.endsWith('.binserp.com')) {
            return parsed.origin;
        }
    } catch {
        // invalid URL format
    }
    return defaultOrigin;
};

// @route   GET /api/auth/google
// @desc    Auth with Google
router.get(
    "/google",
    (req, res, next) => {
        const origin = getAllowedOrigin(req.query.origin);
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
            const frontendUrl = getAllowedOrigin(req.query.state);
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

// @route   POST /api/auth/refresh
// @desc    Refresh access token
router.post("/refresh", refreshTokens);

// @route   POST /api/auth/logout
// @desc    Logout user and clear cookies
router.post("/logout", logout);

export default router;
