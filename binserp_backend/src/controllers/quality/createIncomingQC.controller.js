import { QualityMasterSchema, IncomingQCSchema, ProcessQCSchema } from "../../models/quality/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { updateInventoryStock } from "../store/index.js";
import { grnSchema } from "../../models/store/index.js";
import { componentSchema, jobSchema } from "../../models/ppc/index.js";
import { recordStockTransaction } from "../../services/stockTransaction.service.js";
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
        acceptedQuantity, rejectedQuantity, overallStatus,
        rejectionReason, remarks
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
                const rejQty = Number(rejectedQuantity) || 0;
                const accQty = Number(acceptedQuantity) || 0;

                // Update Item Quantities
                grn.items[itemIndex].acceptedQuantity = (grn.items[itemIndex].acceptedQuantity || 0) + accQty;
                grn.items[itemIndex].rejectedQuantity = (grn.items[itemIndex].rejectedQuantity || 0) + rejQty;

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

                const matId = req.body.materialId || grn.items[itemIndex].component || grn.items[itemIndex].consumable || grn.items[itemIndex].material;
                const itemTypeOption = grn.type === 'inhouse' ? 'Component' : (grn.type === 'consumable' ? 'Consumable' : (grn.type === 'bo' ? 'BoughtOut' : 'RawMaterial'));

                // Update Stock (Only Accepted Qty)
                if (grn.type === 'inhouse') {
                    // Inhouse -> Component Stock (Only update accepted)
                    if (accQty > 0) {
                        const compId = req.body.componentId || matId;
                        const Component = req.getModel("Component", componentSchema);
                        await Component.findByIdAndUpdate(compId, { $inc: { quantity: accQty } });
                    }
                } else {
                    if (accQty > 0) {
                        await updateInventoryStock(
                            req,
                            matId,
                            accQty,
                            grn.items[itemIndex].unit || "PCS",
                            grn.items[itemIndex].locationId,
                            {
                                itemType: itemTypeOption,
                                isQCRelease: true,
                                inspectedQuantity: inspectedQuantity || 0
                            }
                        );
                    }
                }

                // Record Rejection Transaction in Stock Ledger if any rejected
                if (rejQty > 0 && matId) {
                    try {
                        const vendorLabel = grn.supplierName || grn.supplier?.name || "Supplier";
                        await recordStockTransaction(req, {
                            itemType: itemTypeOption === 'BoughtOut' ? 'RmBoItem' : (itemTypeOption === 'Consumable' ? 'ConsumableItem' : (itemTypeOption === 'Component' ? 'Component' : 'RawMaterial')),
                            item: matId,
                            itemName: materialName,
                            unit: grn.items[itemIndex].unit || "PCS",
                            movementType: "OUTWARD",
                            transactionCategory: "INCOMING_QC_REJECTED",
                            quantity: -rejQty,
                            previousStock: rejQty,
                            newStock: 0,
                            referenceDocType: "GRN",
                            referenceDocId: grn._id,
                            referenceDocNumber: grn.grnNumber,
                            recipientOrSource: `Vendor Rejection (${vendorLabel})`,
                            purpose: rejectionReason || remarks || `Incoming Quality Inspection Rejection / Scrap (GRN #${grn.grnNumber})`,
                            performedBy: req.user?._id || req.user?.id
                        });
                    } catch (rejErr) {
                        console.error("Error recording incoming QC rejection transaction:", rejErr);
                    }
                }
            }
        }
    }

    return res.status(201).json(new ApiResponse(201, incoming, "Incoming QC Record Created"));
});
