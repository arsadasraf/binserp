import { generateTokens, setTokenCookies } from "../../utils/token.js";

export const googleAuthCallback = (req, res) => {
    // The company/profile is available on req.user thanks to passport
    const userOrCompany = req.user;
    const frontendUrl = req.frontendUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
    
    if (!userOrCompany) {
        return res.redirect(`${frontendUrl}/login?error=AuthenticationFailed`);
    }

    if (userOrCompany.isNewCompany) {
        // Redirect to registration, pre-filling the email and name
        const params = new URLSearchParams({
            googleEmail: userOrCompany.email,
            googleName: userOrCompany.name,
        });
        return res.redirect(`${frontendUrl}/register/step1?${params.toString()}`);
    }

    const company = userOrCompany;
    const { accessToken, refreshToken } = generateTokens(company._id, "company");
    
    // Save refresh token asynchronously (don't block redirect unnecessarily, but better to wait)
    company.refreshToken = refreshToken;
    // Note: Since this is in passport callback, company might be a mongoose document. Let's assume it is.
    company.save({ validateBeforeSave: false }).catch(err => console.error("Error saving refresh token in Google Auth:", err));

    // Set secure HttpOnly cookies
    setTokenCookies(res, accessToken, refreshToken);
    
    // We send payload as JSON string encoded in base64 to avoid URL length issues.
    // The frontend's /auth/success page will handle it.
    
    const companyData = {
        id: company._id,
        companyName: company.companyName,
        email: company.email,
        userId: company.userId,
        logo: company.logo,
        isVerified: company.isVerified
    };

    const encodedData = Buffer.from(JSON.stringify(companyData)).toString('base64');
    
    // Still passing accessToken in URL temporarily for backward compatibility in frontend /auth/success
    res.redirect(`${frontendUrl}/auth/success?token=${accessToken}&type=company&data=${encodedData}`);
};
