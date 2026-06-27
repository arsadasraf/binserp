import jwt from "jsonwebtoken";

const generateToken = (companyId) => {
    return jwt.sign({ id: companyId }, process.env.JWT_SECRET, {
        expiresIn: "7d",
    });
};

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
    const token = generateToken(company._id);
    
    // We send payload as JSON string encoded in base64 to avoid URL length issues,
    // or we just send the token and type, and let frontend fetch profile.
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
    
    res.redirect(`${frontendUrl}/auth/success?token=${token}&type=company&data=${encodedData}`);
};
