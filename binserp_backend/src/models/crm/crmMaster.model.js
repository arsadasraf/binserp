import mongoose from "mongoose";

export const crmMasterSchema = new mongoose.Schema(
    {
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
        },
        type: {
            type: String,
            required: true,
            enum: ["source", "stage", "industry", "lossReason", "product", "team"],
            trim: true
        },
        name: { type: String, required: true, trim: true },
        code: { type: String, trim: true },
        color: { type: String, default: "#3b82f6" },
        order: { type: Number, default: 0 },
        probability: { type: Number, default: 0, min: 0, max: 100 }, // for stages
        description: { type: String, trim: true },
        unitPrice: { type: Number, default: 0 }, // legacy fallback
        unit: { type: String, default: "PCS" }, // for product catalog
        
        // Product & Service Advanced Commercial Configuration
        itemClassification: {
            type: String,
            enum: ["product", "service"],
            default: "product"
        },
        hsnSacCode: { type: String, trim: true, default: "" },
        taxRate: { type: Number, default: 18 }, // Standard GST slab rate: 0, 5, 12, 18, 28

        // Multi-Territory & Multi-Currency Pricing Matrix
        pricing: {
            // 1. Intra-State (Same State: CGST + SGST)
            intraState: {
                currency: { type: String, default: "INR", uppercase: true },
                sellingPrice: { type: Number, default: 0, min: 0 },
                negotiationPrice: { type: Number, default: 0, min: 0 }, // Minimum floor price
                cgstRate: { type: Number, default: 9 },
                sgstRate: { type: Number, default: 9 }
            },

            // 2. Inter-State (Domestic Outside State: IGST)
            interState: {
                currency: { type: String, default: "INR", uppercase: true },
                sellingPrice: { type: Number, default: 0, min: 0 },
                negotiationPrice: { type: Number, default: 0, min: 0 },
                igstRate: { type: Number, default: 18 }
            },

            // 3. Foreign (Exports: Multi-Currency & 0% LUT or IGST)
            foreign: {
                currency: { type: String, default: "USD", uppercase: true },
                sellingPrice: { type: Number, default: 0, min: 0 },
                negotiationPrice: { type: Number, default: 0, min: 0 },
                taxTreatment: {
                    type: String,
                    enum: ["LUT_BOND_ZERO_RATED", "EXPORT_WITH_IGST", "EXEMPT"],
                    default: "LUT_BOND_ZERO_RATED"
                },
                exportTaxRate: { type: Number, default: 0 },
                incoterms: { type: String, default: "FOB", uppercase: true }
            }
        },

        isDefault: { type: Boolean, default: false },
        isActive: { type: Boolean, default: true },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        }
    },
    { timestamps: true }
);

crmMasterSchema.index({ company: 1, type: 1, name: 1 }, { unique: true });
