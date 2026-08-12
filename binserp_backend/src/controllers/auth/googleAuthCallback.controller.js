import { generateTokens, setTokenCookies } from "../../utils/token.js";

export const googleAuthCallback = async (req, res) => {
    // The profile / admin / company is available on req.user thanks to passport
    const userOrCompany = req.user;
    const frontendUrl = req.frontendUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
    
    if (!userOrCompany) {
        return res.redirect(`${frontendUrl}/login?error=AuthenticationFailed`);
    }

    // 👑 1. SaaS Admin Authentication Branch
    if (userOrCompany.isSaasAdmin) {
        const admin = userOrCompany.saasAdmin;
        const { accessToken, refreshToken } = generateTokens(admin._id, "saasadmin");

        admin.refreshToken = refreshToken;
        await admin.save({ validateBeforeSave: false }).catch(err => console.error("Error saving refresh token in SaaS Admin Google Auth:", err));

        // Set dedicated saasAdminToken cookie
        res.cookie("saasAdminToken", accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 12 * 60 * 60 * 1000,
        });

        setTokenCookies(res, accessToken, refreshToken);

        const adminData = {
            id: admin._id,
            username: admin.username,
            email: admin.email,
            roleLevel: admin.roleLevel
        };

        const encodedData = Buffer.from(JSON.stringify(adminData)).toString('base64');
        return res.redirect(`${frontendUrl}/auth/success?token=${accessToken}&type=saasadmin&data=${encodedData}`);
    }

    // 🏢 2. New Company Registration Branch
    if (userOrCompany.isNewCompany) {
        const params = new URLSearchParams({
            googleEmail: userOrCompany.email,
            googleName: userOrCompany.name,
        });
        return res.redirect(`${frontendUrl}/register/step1?${params.toString()}`);
    }

    // 🏢 3. Existing Company Login Branch
    const company = userOrCompany;

    // 🚫 SUSPENSION CHECK
    if (company.isSuspended) {
        const msg = encodeURIComponent("Your company has been suspended from ERP provider.");
        return res.redirect(`${frontendUrl}/login?error=${msg}`);
    }

    company.tokenVersion = (company.tokenVersion || 0) + 1;

    const { accessToken, refreshToken } = generateTokens(company._id, "company", null, company.tokenVersion);
    
    company.refreshToken = refreshToken;
    company.save({ validateBeforeSave: false }).catch(err => console.error("Error saving refresh token in Google Auth:", err));

    setTokenCookies(res, accessToken, refreshToken);

    const companyData = {
        id: company._id,
        companyName: company.companyName,
        email: company.email,
        userId: company.userId,
        logo: company.logo,
        isVerified: company.isVerified
    };

    const encodedData = Buffer.from(JSON.stringify(companyData)).toString('base64');
    res.redirect(`${frontendUrl}/auth/success?token=${accessToken}&type=company&data=${encodedData}`);
};
