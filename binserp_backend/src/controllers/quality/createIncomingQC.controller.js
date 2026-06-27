import { QualityMasterSchema, IncomingQCSchema, ProcessQCSchema } from "../../models/quality/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { updateInventoryStock } from "../store/index.js";
import { grnSchema } from "../../models/store/index.js";
import { componentSchema, jobSchema } from "../../models/ppc/index.js";
import { signPhotos } from "../../utils/s3.js";

// --- Master Management (Standards) ---

export const createIncomingQC = asyncHandler(async (req, res) => {
    console.log("DEBUG: createIncomingQC called");
    console.log("DEBUG: req.user:", req.user ? "Present" : "Missing", req.user);
    console.log("DEBUG: req.company:", req.company ? "Present" : "Missing", req.company);

    // Explicitly validate availability
    if (!req.company?._id && !req.user?.company) {
        console.error("DEBUG: No Company ID found!");
        throw new ApiError(400, "Company ID is missing from request context");
    }

    const companyId = req.company?._id || req.user?.company;

    const {
        materialName, receivedQuantity, inspectedQuantity,
        acceptedQuantity, rejectedQuantity, overallStatus
    } = req.body;

    if (!materialName || receivedQuantity === undefined) {
        throw new ApiError(400, "Material Name and Received Quantity are required");
    }

    const IncomingQC = req.getModel("IncomingQC", IncomingQCSchema);

    let incoming;
    try {
        incoming = await IncomingQC.create({
            company: companyId,
            ...req.body,
            inspector: req.user?._id
        });
    } catch (err) {
        console.error("DEBUG: IncomingQC.create failed:", err);
        throw err;
    }

    // --- GRN & Stock Update Logic ---
    if (req.body.grnId && req.body.grnItemId) {
        const GRN = req.getModel('GRN', grnSchema);
        const grn = await GRN.findById(req.body.grnId);

        if (grn) {
            // Find the item in GRN items array
            const itemIndex = grn.items.findIndex(item => item._id.toString() === req.body.grnItemId);

            if (itemIndex > -1) {
                // Update Item Quantities
                grn.items[itemIndex].acceptedQuantity = (grn.items[itemIndex].acceptedQuantity || 0) + (acceptedQuantity || 0);
                grn.items[itemIndex].rejectedQuantity = (grn.items[itemIndex].rejectedQuantity || 0) + (rejectedQuantity || 0);

                // Auto-update GRN QC Status
                const allInspected = grn.items.every(item => {
                    const totalProcessed = (item.acceptedQuantity || 0) + (item.rejectedQuantity || 0);
                    // Check if processed matches received/ordered quantity
                    const targetQty = item.receivedQuantity || item.quantity || 0;
                    return totalProcessed >= targetQty;
                });

                const anyInspected = grn.items.some(item => (item.acceptedQuantity || 0) + (item.rejectedQuantity || 0) > 0);

                if (allInspected) {
                    grn.qcStatus = "Completed";
                } else if (anyInspected) {
                    grn.qcStatus = "Partial";
                }

                // Save GRN updates first
                await grn.save();

                // Update Stock (Only Accepted Qty)
                // Update Stock
                if (grn.type === 'inhouse') {
                    // Inhouse -> Component Stock (Only update accepted)
                    if (acceptedQuantity > 0) {
                        const compId = req.body.componentId || grn.items[itemIndex].component || grn.items[itemIndex].material;
                        const Component = req.getModel("Component", componentSchema);
                        await Component.findByIdAndUpdate(compId, { $inc: { quantity: acceptedQuantity } });
                    }
                } else {
                    // BO -> Inventory Stock (Handle Pending & Accepted)
                    const matId = req.body.materialId || grn.items[itemIndex].material;
                    await updateInventoryStock(
                        req,
                        matId,
                        acceptedQuantity || 0,
                        grn.items[itemIndex].unit || "PCS",
                        grn.items[itemIndex].locationId,
                        {
                            isQCRelease: true,
                            inspectedQuantity: inspectedQuantity || 0
                        }
                    );
                }
            }
        }
    }

    return res.status(201).json(new ApiResponse(201, incoming, "Incoming QC Record Created"));
});
