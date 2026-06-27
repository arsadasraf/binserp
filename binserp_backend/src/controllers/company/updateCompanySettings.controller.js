import { Company } from "../../models/company/index.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendVerificationCode, sendPasswordResetEmail, sendWelcomeEmail } from "../../utils/emailService.js";
import { sendWhatsAppVerificationCode } from "../../utils/whatsappService.js";
import { uploadOnS3, deleteFromS3, signPhotos } from "../../utils/s3.js";
import { getTenantModel } from "../../db/tenant.js";
import { userSchema } from "../../models/user/index.js";

// Generate JWT token
const generateToken = (companyId) => {
  return jwt.sign({ id: companyId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// ✅ Register Company

export const updateCompanySettings = async (req, res) => {
  try {
    const { companyName, contactNumber, state, city, pincode } = req.body;

    const company = await Company.findById(req.user.id);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // Update fields if provided
    if (companyName) company.companyName = companyName;
    if (req.body.companyType) company.companyType = req.body.companyType;
    if (req.body.service) company.service = req.body.service;
    if (contactNumber) company.contactNumber = contactNumber;
    if (state) company.state = state;
    if (city) company.city = city;
    if (pincode !== undefined) company.pincode = pincode;

    // Extended Profile Fields
    if (req.body.billingAddress !== undefined) company.billingAddress = req.body.billingAddress;
    if (req.body.shippingAddress !== undefined) company.shippingAddress = req.body.shippingAddress;
    if (req.body.qualitySpecs !== undefined) company.qualitySpecs = req.body.qualitySpecs;
    if (req.body.commercialTerms !== undefined) company.commercialTerms = req.body.commercialTerms;
    if (req.body.bankDetails) company.bankDetails = req.body.bankDetails;
    if (req.body.printSettings) company.printSettings = req.body.printSettings;

    await company.save();

    res.status(200).json({
      message: "Company settings updated successfully",
      company: {
        id: company._id,
        companyName: company.companyName,
        companyType: company.companyType,
        service: company.service,
        email: company.email,
        contactNumber: company.contactNumber,
        state: company.state,
        city: company.city,
        pincode: company.pincode,
        logo: (await signPhotos([company.logo]))[0],
        // Extended fields
        billingAddress: company.billingAddress,
        shippingAddress: company.shippingAddress,
        qualitySpecs: company.qualitySpecs,
        commercialTerms: company.commercialTerms,
        bankDetails: company.bankDetails,
        printSettings: company.printSettings
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Upload Company Logo
