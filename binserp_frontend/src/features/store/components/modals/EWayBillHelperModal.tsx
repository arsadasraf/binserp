"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  Truck,
  Copy,
  Check,
  ExternalLink,
  Download,
  FileJson,
  Package,
  Building2,
  User,
  Info,
} from "lucide-react";
import { CompanyInfo } from "@/src/features/store/types/store.types";
import { getCurrencySymbol } from "@/src/utils/currencyHelper";

interface EWayBillHelperModalProps {
  isOpen: boolean;
  onClose: () => void;
  dc?: any | null;
  invoice?: any | null;
  documentType?: "dc" | "invoice";
  companyInfo?: CompanyInfo;
}

const EWAY_PORTAL_URL = "https://ewaybillgst.gov.in/";

const formatDDMMYYYY = (dateStr?: string | Date) => {
  if (!dateStr) {
    const now = new Date();
    return `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

const mapTransModeCode = (modeStr?: string): number => {
  const m = (modeStr || "").toLowerCase();
  if (m.includes("rail")) return 2;
  if (m.includes("air")) return 3;
  if (m.includes("ship") || m.includes("sea")) return 4;
  return 1; // Road
};

const extractStateCodeFromGstin = (gstin?: string): number => {
  const cleaned = (gstin || "").trim();
  if (/^\d{2}/.test(cleaned)) {
    return parseInt(cleaned.slice(0, 2), 10);
  }
  return 0;
};

const extractPincode = (obj: any, fallbackAddress?: string): number => {
  const direct = String(obj?.pincode || obj?.pin || "").replace(/\D/g, "");
  if (direct.length === 6) return parseInt(direct, 10);
  const match = String(fallbackAddress || "").match(/\b(\d{6})\b/);
  return match ? parseInt(match[1], 10) : 0;
};

export default function EWayBillHelperModal({
  isOpen,
  onClose,
  dc,
  invoice,
  documentType,
  companyInfo,
}: EWayBillHelperModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const doc = invoice || dc || null;
  const isInvoice =
    documentType === "invoice" ||
    (Boolean(invoice) && !dc) ||
    Boolean(doc?.invoiceNumber && !doc?.dcNumber);

  const resolvedData = useMemo(() => {
    if (!doc) return null;

    let masterComp: any = companyInfo;
    if (!masterComp || !masterComp.companyName) {
      try {
        const storeCached = typeof window !== "undefined" ? localStorage.getItem("storeCompanyInfo") : null;
        const storedCompany = typeof window !== "undefined" ? localStorage.getItem("companyInfo") : null;
        if (storeCached) masterComp = { ...JSON.parse(storeCached), ...companyInfo };
        else if (storedCompany) masterComp = { ...JSON.parse(storedCompany), ...companyInfo };
      } catch {
        // ignore parse error
      }
    }

    const compName = masterComp?.companyName || masterComp?.name || "";
    const compGst = (masterComp?.gstin || masterComp?.gstNumber || masterComp?.gst || "").trim().toUpperCase();
    const compAddr = masterComp?.billingAddress || masterComp?.address || masterComp?.location || "";
    const compPlace = masterComp?.city || "";
    const compPincode = extractPincode(masterComp, compAddr);
    const compStateCode = extractStateCodeFromGstin(compGst);

    const custObj = typeof doc.customer === "object" && doc.customer !== null ? doc.customer : {};
    const custName = doc.customerName || custObj?.name || custObj?.companyName || "";
    const custGst = (doc.customerGST || custObj?.gstin || custObj?.gstNumber || custObj?.gst || "URP").trim().toUpperCase();
    const custAddr = doc.customerAddress || custObj?.shippingAddress || custObj?.billingAddress || custObj?.address || "";
    const custPlace = custObj?.city || "";
    const custPincode = extractPincode(custObj, custAddr);
    const custStateCode = extractStateCodeFromGstin(custGst) || compStateCode;

    const docNumber = isInvoice ? (doc.invoiceNumber || "") : (doc.dcNumber || "");
    const docDate = formatDDMMYYYY(doc.date || doc.createdAt);
    const transportMode = doc.transportationType || "Road Transport";
    const vehicleNumber = (doc.vehicleNumber || "").trim().toUpperCase();
    const currency = doc.currency || "INR";
    const currSym = getCurrencySymbol(currency);
    const gstSupplyType: "intra" | "inter" = doc.gstSupplyType === "inter" ? "inter" : "intra";

    const items = (Array.isArray(doc.items) ? doc.items : []).map((it: any) => {
      const refObj = it.fgItem || it.rawMaterial || it.boughtOut || it.consumableItem || it.material;
      const name = it.materialName || it.productName || it.name || (typeof refObj === "object" ? refObj?.name : "") || "Item";
      const desc = it.description || it.descriptions || (typeof refObj === "object" ? (refObj?.description || refObj?.descriptions || "") : "");
      const hsn = String(it.hsnCode || it.hsn || "").replace(/\D/g, "") || "";
      const qty = Number(it.quantity || 0);
      const unit = (it.unit || "PCS").toUpperCase();
      const rate = Number(it.rate || 0);
      const amount = Number(it.amount || qty * rate);
      const taxRate = isInvoice ? Number(it.taxRate ?? 0) : 0;
      const taxAmount = isInvoice ? Number(it.taxAmount ?? (amount * taxRate) / 100) : 0;
      return { name, desc, hsn, qty, unit, rate, amount, taxRate, taxAmount };
    });

    const subtotal = Number(doc.subtotal || items.reduce((s: number, i: any) => s + i.amount, 0));
    const taxAmount = isInvoice
      ? Number(doc.taxAmount ?? items.reduce((s: number, i: any) => s + i.taxAmount, 0))
      : 0;
    const cgstAmount = isInvoice
      ? (doc.cgstAmount !== undefined ? Number(doc.cgstAmount) : (gstSupplyType === "intra" ? parseFloat((taxAmount / 2).toFixed(2)) : 0))
      : 0;
    const sgstAmount = isInvoice
      ? (doc.sgstAmount !== undefined ? Number(doc.sgstAmount) : (gstSupplyType === "intra" ? parseFloat((taxAmount - cgstAmount).toFixed(2)) : 0))
      : 0;
    const igstAmount = isInvoice
      ? (doc.igstAmount !== undefined ? Number(doc.igstAmount) : (gstSupplyType === "inter" ? taxAmount : 0))
      : 0;
    const totalValue = Number(doc.grandTotal || doc.totalAmount || (subtotal + taxAmount));
    const otherCharges = Number((totalValue - subtotal - taxAmount).toFixed(2));

    return {
      compName,
      compGst,
      compAddr,
      compPlace,
      compPincode,
      compStateCode,
      custName,
      custGst,
      custAddr,
      custPlace,
      custPincode,
      custStateCode,
      docNumber,
      docDate,
      transportMode,
      vehicleNumber,
      currency,
      currSym,
      gstSupplyType,
      items,
      subtotal,
      taxAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      otherCharges,
      totalValue,
    };
  }, [doc, isInvoice, companyInfo]);

  if (!isOpen || !doc || !resolvedData) return null;

  const copyText = async (value: string, key: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1800);
    } catch {
      // Fallback for restricted clipboard contexts
      const textarea = document.createElement("textarea");
      textarea.value = value;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1800);
    }
  };

  const buildAllDetailsText = () => {
    const taxLines = isInvoice
      ? resolvedData.gstSupplyType === "inter"
        ? [
            `Taxable Value: ${resolvedData.subtotal.toFixed(2)}`,
            `IGST: ${resolvedData.igstAmount.toFixed(2)}`,
            `Total Invoice Value: ${resolvedData.totalValue.toFixed(2)}`,
          ]
        : [
            `Taxable Value: ${resolvedData.subtotal.toFixed(2)}`,
            `CGST: ${resolvedData.cgstAmount.toFixed(2)} | SGST: ${resolvedData.sgstAmount.toFixed(2)}`,
            `Total Invoice Value: ${resolvedData.totalValue.toFixed(2)}`,
          ]
      : [`Total Challan Value: ${resolvedData.totalValue.toFixed(2)}`];

    const lines = [
      `=== E-WAY BILL DETAILS (${isInvoice ? "TAX INVOICE" : "DELIVERY CHALLAN"}) ===`,
      isInvoice
        ? `Supply Type: Outward | Sub Type: Supply`
        : `Supply Type: Outward | Sub Type: Others / Delivery Challan`,
      isInvoice
        ? `Document Type: Tax Invoice (INV)`
        : `Document Type: Delivery Challan (CHL)`,
      `Document No: ${resolvedData.docNumber}`,
      `Document Date: ${resolvedData.docDate}`,
      ``,
      `--- BILL FROM (SUPPLIER) ---`,
      `Name: ${resolvedData.compName || "-"}`,
      `GSTIN: ${resolvedData.compGst || "-"}`,
      `Address: ${resolvedData.compAddr || "-"}`,
      `Pincode: ${resolvedData.compPincode || "-"}`,
      ``,
      `--- BILL TO / SHIP TO (CONSIGNEE) ---`,
      `Name: ${resolvedData.custName || "-"}`,
      `GSTIN: ${resolvedData.custGst || "URP"}`,
      `Address: ${resolvedData.custAddr || "-"}`,
      `Pincode: ${resolvedData.custPincode || "-"}`,
      ``,
      `--- TRANSPORT & VALUE DETAILS ---`,
      `Mode: ${resolvedData.transportMode}`,
      `Vehicle No: ${resolvedData.vehicleNumber || "-"}`,
      ...taxLines,
      ``,
      `--- ITEM DETAILS ---`,
      ...resolvedData.items.map(
        (it: any, idx: number) =>
          `${idx + 1}. ${it.name}${it.desc ? ` — ${it.desc}` : ""} | HSN: ${it.hsn || "-"} | Qty: ${it.qty} ${it.unit} | Value: ${it.amount.toFixed(2)}${isInvoice && it.taxRate ? ` | GST: ${it.taxRate}%` : ""}`
      ),
    ];
    return lines.join("\n");
  };

  const handleCopyAllAndOpenPortal = async () => {
    const text = buildAllDetailsText();
    await copyText(text, "__ALL__");
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
    window.open(EWAY_PORTAL_URL, "_blank", "noopener,noreferrer");
  };

  const handleOpenPortalOnly = () => {
    window.open(EWAY_PORTAL_URL, "_blank", "noopener,noreferrer");
  };

  const handleDownloadNicJson = () => {
    const nicPayload = {
      version: "1.0.0421",
      billLists: [
        {
          userGstin: resolvedData.compGst || "",
          supplyType: "O",
          subSupplyType: isInvoice ? 1 : 8, // 1 = Supply (Tax Invoice), 8 = Others (Delivery Challan)
          subSupplyDesc: isInvoice ? "Tax Invoice" : "Delivery Challan",
          docType: isInvoice ? "INV" : "CHL",
          docNo: resolvedData.docNumber,
          docDate: resolvedData.docDate,
          transType: 1,
          fromGstin: resolvedData.compGst || "",
          fromTrdName: resolvedData.compName || "",
          fromAddr1: resolvedData.compAddr || "",
          fromAddr2: "",
          fromPlace: resolvedData.compPlace || "",
          fromPincode: resolvedData.compPincode || 0,
          fromStateCode: resolvedData.compStateCode || 0,
          actualFromStateCode: resolvedData.compStateCode || 0,
          toGstin: resolvedData.custGst || "URP",
          toTrdName: resolvedData.custName || "",
          toAddr1: resolvedData.custAddr || "",
          toAddr2: "",
          toPlace: resolvedData.custPlace || "",
          toPincode: resolvedData.custPincode || 0,
          toStateCode: resolvedData.custStateCode || 0,
          actualToStateCode: resolvedData.custStateCode || 0,
          totalValue: Number(resolvedData.subtotal.toFixed(2)),
          cgstValue: Number(resolvedData.cgstAmount.toFixed(2)),
          sgstValue: Number(resolvedData.sgstAmount.toFixed(2)),
          igstValue: Number(resolvedData.igstAmount.toFixed(2)),
          cessValue: 0,
          OthValue: resolvedData.otherCharges,
          totInvValue: Number(resolvedData.totalValue.toFixed(2)),
          transMode: mapTransModeCode(resolvedData.transportMode),
          transDistance: 0,
          transporterName: "",
          transporterId: "",
          transDocNo: resolvedData.docNumber,
          transDocDate: resolvedData.docDate,
          vehicleNo: resolvedData.vehicleNumber.replace(/\s+/g, ""),
          vehicleType: "R",
          mainHsnCode: resolvedData.items[0]?.hsn ? parseInt(resolvedData.items[0].hsn, 10) : 0,
          itemList: resolvedData.items.map((it: any, idx: number) => ({
            itemNo: idx + 1,
            productName: it.name,
            productDesc: it.desc || it.name,
            hsnCode: it.hsn ? parseInt(it.hsn, 10) : 0,
            quantity: it.qty,
            qtyUnit: it.unit.slice(0, 3),
            taxableAmount: Number(it.amount.toFixed(2)),
            sgstRate: isInvoice && resolvedData.gstSupplyType === "intra" ? Number((it.taxRate / 2).toFixed(2)) : 0,
            cgstRate: isInvoice && resolvedData.gstSupplyType === "intra" ? Number((it.taxRate / 2).toFixed(2)) : 0,
            igstRate: isInvoice && resolvedData.gstSupplyType === "inter" ? Number(it.taxRate.toFixed(2)) : 0,
            cessRate: 0,
          })),
        },
      ],
    };

    const blob = new Blob([JSON.stringify(nicPayload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeNo = String(resolvedData.docNumber || (isInvoice ? "INV" : "DC")).replace(/[^a-zA-Z0-9_-]/g, "_");
    a.href = url;
    a.download = `EWayBill_${safeNo}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderCopyRow = (label: string, value: string, keyId: string, mono = false) => {
    const isCopied = copiedKey === keyId;
    const hasVal = Boolean(value && value !== "-" && value !== "0");
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
          <div className={`text-xs font-bold text-slate-900 dark:text-white truncate ${mono ? "font-mono" : ""}`} title={value || "-"}>
            {value || "-"}
          </div>
        </div>
        <button
          type="button"
          disabled={!hasVal}
          onClick={() => copyText(value, keyId)}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
            isCopied
              ? "bg-emerald-600 text-white"
              : "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-600 hover:text-white border border-indigo-200 dark:border-indigo-800"
          }`}
          title={`Copy ${label}`}
        >
          {isCopied ? <Check size={12} /> : <Copy size={12} />}
          <span>{isCopied ? "Copied" : "Copy"}</span>
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-2 sm:p-4 lg:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[94vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-indigo-50/70 to-blue-50/70 dark:from-slate-800/80 dark:to-slate-800/40 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-500/25 shrink-0">
              <Truck size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 truncate">
                <span>E-Way Bill Assistant — {isInvoice ? "INV" : "DC"} #{resolvedData.docNumber}</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                1-Click Copy &amp; NIC Bulk JSON export for official GST E-Way Bill Portal (ewaybillgst.gov.in)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer active:scale-95"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Quick Tip Banner */}
          <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/60 text-xs text-indigo-900 dark:text-indigo-200">
            <Info size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Fastest way to fill E-Way Bill:</span> Download the{" "}
              <strong>NIC Bulk JSON</strong> below and upload it directly on{" "}
              <span className="font-mono font-bold">ewaybillgst.gov.in → e-Waybill → Generate Bulk</span> to auto-fill all fields in one step, or use the{" "}
              <strong>Copy</strong> buttons below to paste field-by-field.
            </div>
          </div>

          {/* Document & Transport Details */}
          <div className="bg-slate-50/60 dark:bg-slate-800/40 rounded-2xl p-4 sm:p-5 border border-slate-200/70 dark:border-slate-750 shadow-2xs space-y-3.5">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-4 bg-indigo-600 rounded-full shrink-0" />
              <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Document &amp; Transport Details
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {renderCopyRow(isInvoice ? "Document No (Invoice)" : "Document No (DC)", resolvedData.docNumber, "docNo", true)}
              {renderCopyRow("Document Date", resolvedData.docDate, "docDate", true)}
              {renderCopyRow("Vehicle Number", resolvedData.vehicleNumber || "-", "vehicleNo", true)}
              {renderCopyRow("Transport Mode", resolvedData.transportMode, "transMode")}
              {renderCopyRow(isInvoice ? "Total Invoice Value" : "Total Challan Value", resolvedData.totalValue.toFixed(2), "totalVal", true)}
              {renderCopyRow("Document Type", isInvoice ? "Tax Invoice" : "Delivery Challan", "docType")}
              {isInvoice && renderCopyRow("Taxable Value", resolvedData.subtotal.toFixed(2), "taxableVal", true)}
              {isInvoice && resolvedData.gstSupplyType === "intra" && (
                <>
                  {renderCopyRow("CGST Amount", resolvedData.cgstAmount.toFixed(2), "cgstVal", true)}
                  {renderCopyRow("SGST Amount", resolvedData.sgstAmount.toFixed(2), "sgstVal", true)}
                </>
              )}
              {isInvoice && resolvedData.gstSupplyType === "inter" && (
                renderCopyRow("IGST Amount", resolvedData.igstAmount.toFixed(2), "igstVal", true)
              )}
            </div>
          </div>

          {/* Supplier & Consignee Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-slate-50/60 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-200/70 dark:border-slate-750 shadow-2xs space-y-2.5">
              <div className="flex items-center gap-2">
                <Building2 size={14} className="text-indigo-600" />
                <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Bill From (Supplier)
                </span>
              </div>
              {renderCopyRow("Supplier Name", resolvedData.compName, "compName")}
              {renderCopyRow("Supplier GSTIN", resolvedData.compGst, "compGst", true)}
              {renderCopyRow("Supplier Address", resolvedData.compAddr, "compAddr")}
              {renderCopyRow("Supplier Pincode", resolvedData.compPincode ? String(resolvedData.compPincode) : "", "compPin", true)}
            </div>

            <div className="bg-slate-50/60 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-200/70 dark:border-slate-750 shadow-2xs space-y-2.5">
              <div className="flex items-center gap-2">
                <User size={14} className="text-indigo-600" />
                <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Bill To / Ship To (Consignee)
                </span>
              </div>
              {renderCopyRow("Consignee Name", resolvedData.custName, "custName")}
              {renderCopyRow("Consignee GSTIN", resolvedData.custGst, "custGst", true)}
              {renderCopyRow("Consignee Address", resolvedData.custAddr, "custAddr")}
              {renderCopyRow("Consignee Pincode", resolvedData.custPincode ? String(resolvedData.custPincode) : "", "custPin", true)}
            </div>
          </div>

          {/* Line Items Copy Table */}
          <div className="bg-slate-50/60 dark:bg-slate-800/40 rounded-2xl p-4 sm:p-5 border border-slate-200/70 dark:border-slate-750 shadow-2xs space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-4 bg-indigo-600 rounded-full shrink-0" />
              <Package size={14} className="text-indigo-600" />
              <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Item Details ({resolvedData.items.length}) — Click Any Value to Copy
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                <thead className="bg-indigo-50/70 dark:bg-slate-800 text-indigo-900 dark:text-indigo-200 uppercase font-bold text-[10px]">
                  <tr>
                    <th className="px-3 py-2.5 text-center w-10">#</th>
                    <th className="px-3 py-2.5 text-left min-w-[240px]">Item Name &amp; Description</th>
                    <th className="px-3 py-2.5 text-center">HSN</th>
                    <th className="px-3 py-2.5 text-right">Qty</th>
                    <th className="px-3 py-2.5 text-right">Taxable Value</th>
                    <th className="px-3 py-2.5 text-right">Copy Row</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {resolvedData.items.map((it: any, idx: number) => (
                    <tr key={idx} className="hover:bg-indigo-50/30 dark:hover:bg-slate-800/40">
                      <td className="px-3 py-2.5 text-center font-mono text-slate-500">{idx + 1}</td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => copyText(it.desc ? `${it.name} — ${it.desc}` : it.name, `item_name_${idx}`)}
                          className="text-left group cursor-pointer"
                          title="Click to copy Item Name & Description"
                        >
                          <div className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                            {it.name}
                          </div>
                          {it.desc && (
                            <div className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-2">
                              {it.desc}
                            </div>
                          )}
                          {copiedKey === `item_name_${idx}` && (
                            <span className="text-[10px] font-bold text-emerald-600">Copied ✓</span>
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => copyText(it.hsn, `item_hsn_${idx}`)}
                          className="font-mono font-bold text-slate-700 dark:text-slate-200 hover:text-indigo-600 cursor-pointer"
                          title="Click to copy HSN"
                        >
                          {copiedKey === `item_hsn_${idx}` ? "Copied ✓" : it.hsn || "-"}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => copyText(String(it.qty), `item_qty_${idx}`)}
                          className="font-bold text-indigo-700 dark:text-indigo-300 hover:underline cursor-pointer"
                          title="Click to copy Quantity"
                        >
                          {copiedKey === `item_qty_${idx}` ? "Copied ✓" : `${it.qty} ${it.unit}`}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => copyText(it.amount.toFixed(2), `item_amt_${idx}`)}
                          className="font-mono font-bold text-slate-900 dark:text-white hover:text-indigo-600 cursor-pointer"
                          title="Click to copy Taxable Value"
                        >
                          {copiedKey === `item_amt_${idx}` ? "Copied ✓" : `${resolvedData.currSym}${it.amount.toFixed(2)}`}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            copyText(
                              `${it.name}${it.desc ? ` — ${it.desc}` : ""} | HSN: ${it.hsn || "-"} | Qty: ${it.qty} ${it.unit} | Value: ${it.amount.toFixed(2)}`,
                              `item_row_${idx}`
                            )
                          }
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-all ${
                            copiedKey === `item_row_${idx}`
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-indigo-600 hover:text-white"
                          }`}
                        >
                          {copiedKey === `item_row_${idx}` ? <Check size={11} /> : <Copy size={11} />}
                          <span>{copiedKey === `item_row_${idx}` ? "Copied" : "Copy"}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownloadNicJson}
              className="px-4 py-2.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-600 hover:text-white border border-emerald-200 dark:border-emerald-800 rounded-xl transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              title="Upload this JSON on ewaybillgst.gov.in → e-Waybill → Generate Bulk"
            >
              <FileJson size={15} />
              <span>Download NIC Bulk JSON</span>
            </button>

            <button
              type="button"
              onClick={handleOpenPortalOnly}
              className="px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <ExternalLink size={14} />
              <span>Open Portal Only</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer active:scale-95"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleCopyAllAndOpenPortal}
              className="px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 rounded-xl shadow-md shadow-indigo-500/25 hover:shadow-lg hover:shadow-indigo-500/35 transition-all cursor-pointer flex items-center gap-2 active:scale-95"
            >
              {copiedAll ? <Check size={15} /> : <Copy size={15} />}
              <span>{copiedAll ? "Copied! Opening E-Way Portal..." : "Copy All & Open E-Way Portal"}</span>
              <ExternalLink size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
