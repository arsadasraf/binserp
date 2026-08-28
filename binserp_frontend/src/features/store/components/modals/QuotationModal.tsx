"use client";

import React, { useState, useEffect } from "react";
import { Plus, Trash2, X, FileText, Download, Building2, Package, Truck, Calculator } from "lucide-react";
import Swal from "sweetalert2";
import SearchableSelect from "../SearchableSelect";
import { API_BASE_URL } from "@/src/utils/config";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getCurrencySymbol, CURRENCY_OPTIONS } from "@/src/utils/currencyHelper";

interface QuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  components?: any[];
  materials?: any[];
  customers?: any[];
  priceLists?: any[];
  companyInfo?: any;
  loading?: boolean;
  initialData?: any;
  isEditing?: boolean;
  isPreview?: boolean;
  isSubmitting?: boolean;
}

export default function QuotationModal({
  isOpen,
  onClose,
  onSubmit,
  components = [],
  customers = [],
  priceLists = [],
  companyInfo,
  initialData,
  isEditing = false,
  isPreview = false,
  isSubmitting = false,
}: QuotationModalProps) {
  const [customerType, setCustomerType] = useState<"master" | "custom">("master");
  const [prefix, setPrefix] = useState("QT-OUT");

  const generateQuotationNumber = (currentPrefix: string) => {
    const currentYear = new Date().getFullYear();
    return `${currentPrefix}-${currentYear}-Auto`;
  };

  const [formData, setFormData] = useState({
    quotationNumber: generateQuotationNumber(prefix),
    date: new Date().toISOString().split("T")[0],
    currency: "INR",
    customerType: "master",
    customer: "",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    customerAddress: "",
    transportationType: "Included",
    transportationCharges: 0,
    packagingType: "Standard",
    packagingCharges: 0,
    subtotal: 0,
    discount: 0,
    taxAmount: 0,
    totalAmount: 0,
    remarks: "",
    status: "Draft",
    items: [
      {
        itemType: "fg",
        component: "",
        productName: "",
        quantity: 1,
        unit: "PCS",
        rate: 0,
        amount: 0,
        taxRate: 0,
        taxAmount: 0,
        description: "",
      }
    ],
  });

  // Fetch prefix settings
  useEffect(() => {
    const fetchPrefix = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem("token") : null;
        if (!token) return;
        const res = await fetch(`${API_BASE_URL}/api/store/prefix`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }).catch(() => null);
        if (res && res.ok) {
          const data = await res.json().catch(() => null);
          if (data && data.settings?.quotationOutwardPrefix) {
            const loadedPrefix = data.settings.quotationOutwardPrefix;
            setPrefix(loadedPrefix);
            if (!initialData) {
              setFormData(prev => ({ ...prev, quotationNumber: generateQuotationNumber(loadedPrefix) }));
            }
          }
        }
      } catch (error) {
        // Ignore silent prefix fetch error
      }
    };
    if (isOpen && !initialData) fetchPrefix();
  }, [isOpen, initialData]);

  // Load initialData
  useEffect(() => {
    if (isOpen && initialData) {
      const formattedItems = initialData.items?.length > 0 ? initialData.items.map((i: any) => ({
        itemType: i.component ? "fg" : "custom",
        component: typeof i.component === "object" ? i.component?._id : i.component || "",
        productName: i.productName || i.description || "",
        quantity: i.quantity || 1,
        unit: i.unit || "PCS",
        rate: i.rate || 0,
        amount: i.amount || 0,
        taxRate: i.taxRate || 0,
        taxAmount: i.taxAmount || 0,
        description: i.description || "",
      })) : [];

      setFormData({
        quotationNumber: initialData.quotationNumber || "Auto-generated",
        date: initialData.date ? new Date(initialData.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
        currency: initialData.currency || "INR",
        customerType: initialData.customer ? "master" : "custom",
        customer: typeof initialData.customer === "object" ? initialData.customer?._id : initialData.customer || "",
        customerName: initialData.customerName || "",
        customerEmail: initialData.customerEmail || "",
        customerPhone: initialData.customerPhone || "",
        customerAddress: initialData.customerAddress || "",
        transportationType: initialData.transportationType || "Included",
        transportationCharges: initialData.transportationCharges || 0,
        packagingType: initialData.packagingType || "Standard",
        packagingCharges: initialData.packagingCharges || 0,
        subtotal: initialData.subtotal || 0,
        discount: initialData.discount || 0,
        taxAmount: initialData.taxAmount || 0,
        totalAmount: initialData.totalAmount || 0,
        remarks: initialData.remarks || initialData.otherDetails || "",
        status: initialData.status || "Draft",
        items: formattedItems.length > 0 ? formattedItems : [
          {
            itemType: "fg",
            component: "",
            productName: "",
            quantity: 1,
            unit: "PCS",
            rate: 0,
            amount: 0,
            taxRate: 0,
            taxAmount: 0,
            description: "",
          }
        ],
      });

      if (initialData.customerName && customers.length > 0) {
        const isMaster = customers.some(c => c.name === initialData.customerName);
        setCustomerType(isMaster ? "master" : "custom");
      }
    }
  }, [initialData, isOpen]);

  // Recalculate Totals
  useEffect(() => {
    let subtotal = 0;
    let totalTax = 0;

    const updatedItems = formData.items.map(item => {
      const amount = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
      const taxAmount = (amount * (Number(item.taxRate) || 0)) / 100;
      subtotal += amount;
      totalTax += taxAmount;
      return { ...item, amount, taxAmount };
    });

    const transport = Number(formData.transportationCharges || 0);
    const packing = Number(formData.packagingCharges || 0);
    const discount = Number(formData.discount || 0);

    const grandTotal = subtotal + totalTax + transport + packing - discount;

    if (
      Math.abs(subtotal - formData.subtotal) > 0.01 ||
      Math.abs(totalTax - formData.taxAmount) > 0.01 ||
      Math.abs(grandTotal - formData.totalAmount) > 0.01
    ) {
      setFormData(prev => ({
        ...prev,
        items: updatedItems,
        subtotal,
        taxAmount: totalTax,
        totalAmount: grandTotal > 0 ? grandTotal : 0
      }));
    }
  }, [
    formData.items.map(i => `${i.quantity}-${i.rate}-${i.taxRate}`).join('|'),
    formData.transportationCharges,
    formData.packagingCharges,
    formData.discount
  ]);

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    (newItems[index] as any)[field] = value;

    if (field === "component" && value) {
      const selectedFg = components.find(c => c._id === value);
      const priceConfig = (priceLists || []).find(p => (p.fgItem?._id || p.fgItem) === value);

      if (selectedFg || priceConfig) {
        if (selectedFg) {
          newItems[index].productName = selectedFg.name;
          newItems[index].unit = selectedFg.unit || "PCS";
          newItems[index].description = selectedFg.description || selectedFg.descriptions || "";
        }

        const resolvedPrice = priceConfig?.price ?? selectedFg?.sellingPrice;
        if (resolvedPrice !== undefined && resolvedPrice !== null && resolvedPrice !== "") {
          newItems[index].rate = Number(resolvedPrice);
        }

        const resolvedTax = priceConfig?.taxRate ?? selectedFg?.taxRate;
        if (resolvedTax !== undefined && resolvedTax !== null && resolvedTax !== "") {
          newItems[index].taxRate = Number(resolvedTax);
        }

        const resolvedHsn = priceConfig?.hsnCode || selectedFg?.hsnCode;
        if (resolvedHsn) {
          (newItems[index] as any).hsnCode = resolvedHsn;
        }
      }
    }

    setFormData({ ...formData, items: newItems });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          itemType: "fg",
          component: "",
          productName: "",
          quantity: 1,
          unit: "PCS",
          rate: 0,
          amount: 0,
          taxRate: 0,
          taxAmount: 0,
          description: "",
        }
      ]
    });
  };

  const removeItem = (index: number) => {
    if (formData.items.length === 1) return;
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isPreview) {
      onClose();
      return;
    }

    if (!formData.customer || !formData.customerName || !formData.customerName.trim()) {
      Swal.fire({
        icon: 'error',
        title: 'Customer Selection Required',
        text: 'Please select a registered Customer from the Master list.',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }

    if (!formData.items || formData.items.length === 0) {
      Swal.fire({
        icon: 'error',
        title: 'Items Required',
        text: 'Please add at least one item to the quotation.',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }

    for (let i = 0; i < formData.items.length; i++) {
      const item = formData.items[i];
      if (!item.productName || !item.productName.trim()) {
        Swal.fire({
          icon: 'error',
          title: 'Validation Error',
          text: `Item #${i + 1}: Please select a product or enter custom product name.`,
          confirmButtonColor: '#4f46e5'
        });
        return;
      }
      if (!item.quantity || Number(item.quantity) <= 0) {
        Swal.fire({
          icon: 'error',
          title: 'Validation Error',
          text: `Item #${i + 1}: Please enter a valid quantity.`,
          confirmButtonColor: '#4f46e5'
        });
        return;
      }
    }

    const payload = {
      ...formData,
      customer: formData.customer && String(formData.customer).trim() ? formData.customer : null,
      otherDetails: formData.remarks,
      items: formData.items.map(item => ({
        ...item,
        component: item.itemType === 'fg' && item.component && String(item.component).trim() ? item.component : null
      }))
    };

    if (!initialData) {
      delete (payload as any).quotationNumber;
    }

    onSubmit(payload);
  };

  const handleDownloadPDFClientSide = () => {
    try {
      const doc = new jsPDF();

      const compName = companyInfo?.companyName || companyInfo?.name || "COMPANY MASTER";
      const compAddress = companyInfo?.address || companyInfo?.location || "";
      const compEmail = companyInfo?.email || "";
      const compPhone = companyInfo?.phone || companyInfo?.contactNumber || "";
      const compGst = companyInfo?.gstin || companyInfo?.gstNumber || companyInfo?.gst || "";

      // Top Clean Header (Monochrome Dark Slate Text)
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(compName.toUpperCase(), 14, 16);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      const compHeaderSub = [compAddress, compPhone && `Ph: ${compPhone}`, compEmail && `Email: ${compEmail}`, compGst && `GSTIN: ${compGst}`].filter(Boolean).join(" | ");
      doc.text(compHeaderSub.substring(0, 110), 14, 22);

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("OUTWARD QUOTATION", 196, 16, { align: "right" });

      // Fine Divider Line
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(14, 26, 196, 26);

      // Metadata & Customer Section
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.setFont("helvetica", "bold");
      doc.text("QUOTATION DETAILS", 14, 33);
      doc.text("BILLED TO / CUSTOMER", 110, 33);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      doc.text(`Quotation No: ${formData.quotationNumber || 'N/A'}`, 14, 39);
      doc.text(`Date: ${formData.date || ''}`, 14, 44);
      doc.text(`Status: ${formData.status || 'Draft'}`, 14, 49);

      doc.setFont("helvetica", "bold");
      doc.text(formData.customerName || 'N/A', 110, 39);

      doc.setFont("helvetica", "normal");
      let custLineY = 44;
      if (formData.customerAddress) {
        const splitAddr = doc.splitTextToSize(formData.customerAddress, 85);
        doc.text(splitAddr, 110, custLineY);
        custLineY += (splitAddr.length * 4);
      }
      const custContact = [formData.customerEmail, formData.customerPhone].filter(Boolean).join(" | ");
      if (custContact) {
        doc.text(custContact, 110, Math.min(custLineY, 52));
      }

      const tableStartY = Math.max(56, custLineY + 4);

      const currSym = getCurrencySymbol(formData.currency);

      // Table Columns: SI.No, Product & Description, Qty, Unit, Rate, Tax Rate, Total Price
      const tableData = (formData.items || []).map((item: any, idx: number) => {
        const prodName = item.productName || "Product";
        const specText = item.description ? `\n${item.description}` : "";
        return [
          idx + 1,
          `${prodName}${specText}`,
          item.quantity || 0,
          item.unit || "PCS",
          `${currSym}${Number(item.rate || 0).toFixed(2)}`,
          `${item.taxRate || 0}%`,
          `${currSym}${Number(item.amount || (item.quantity * item.rate) || 0).toFixed(2)}`
        ];
      });

      autoTable(doc, {
        startY: tableStartY,
        head: [["SI.No", "Product & Description", "Qty", "Unit", `Rate (${currSym})`, "Tax %", `Total Price (${currSym})`]],
        body: tableData,
        headStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          fontStyle: "bold",
          fontSize: 8.5,
          lineColor: [226, 232, 240],
          lineWidth: 0.2
        },
        styles: {
          fontSize: 8,
          cellPadding: 3.5,
          textColor: [30, 41, 59],
          lineColor: [226, 232, 240],
          lineWidth: 0.1
        },
        columnStyles: {
          0: { cellWidth: 14, halign: 'center' },
          1: { cellWidth: 76 },
          2: { cellWidth: 16, halign: 'right' },
          3: { cellWidth: 16, halign: 'center' },
          4: { cellWidth: 22, halign: 'right' },
          5: { cellWidth: 18, halign: 'right' },
          6: { cellWidth: 20, halign: 'right' },
        },
        alternateRowStyles: { fillColor: [250, 250, 250] },
      });

      const finalY = (doc as any).lastAutoTable?.finalY || 120;

      // Clean Modern Calculation Summary
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(114, finalY + 6, 82, 44, 1.5, 1.5, "FD");

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);

      doc.text("Items Subtotal:", 118, finalY + 13);
      doc.text(`${currSym}${Number(formData.subtotal || 0).toFixed(2)}`, 190, finalY + 13, { align: "right" });

      doc.text(`Transport (${formData.transportationType || 'Included'}):`, 118, finalY + 19);
      doc.text(`+ ${currSym}${Number(formData.transportationCharges || 0).toFixed(2)}`, 190, finalY + 19, { align: "right" });

      doc.text(`Packaging (${formData.packagingType || 'Standard'}):`, 118, finalY + 25);
      doc.text(`+ ${currSym}${Number(formData.packagingCharges || 0).toFixed(2)}`, 190, finalY + 25, { align: "right" });

      doc.text("Total Tax (GST):", 118, finalY + 31);
      doc.text(`+ ${currSym}${Number(formData.taxAmount || 0).toFixed(2)}`, 190, finalY + 31, { align: "right" });

      if (Number(formData.discount || 0) > 0) {
        doc.text("Discount:", 118, finalY + 36);
        doc.text(`- ${currSym}${Number(formData.discount || 0).toFixed(2)}`, 190, finalY + 36, { align: "right" });
      }

      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(`Total Price (${formData.currency || 'INR'}):`, 118, finalY + 44);
      doc.text(`${currSym}${Number(formData.totalAmount || 0).toFixed(2)}`, 190, finalY + 44, { align: "right" });

      // Remarks / Terms Section
      if (formData.remarks) {
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text("REMARKS / TERMS & CONDITIONS", 14, finalY + 13);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        const splitRemarks = doc.splitTextToSize(formData.remarks, 90);
        doc.text(splitRemarks, 14, finalY + 19);
      }

      doc.save(`Outward_Quotation_${formData.quotationNumber || Date.now()}.pdf`);
    } catch (err) {
      console.error("PDF generation error", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-gray-900/60 backdrop-blur-sm overflow-y-auto">
      {/* ULTRA WIDE CONTAINER */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-[96vw] lg:max-w-7xl shadow-2xl overflow-hidden my-auto max-h-[95vh] flex flex-col border border-gray-100 dark:border-gray-800">
        
        {/* Compact Modal Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/50">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
                <FileText className="w-4 h-4" />
              </div>
              {isPreview ? "Outward Quotation Information" : (initialData ? "Edit Outward Quotation" : "Create Outward Quotation")}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* COMBINED SUMMARY PREVIEW VIEW */}
        {isPreview ? (
          <div className="p-5 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
            {/* Top Summary Banner */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-indigo-950/40 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">{formData.customerName || "Customer Quote"}</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    formData.status === 'Accepted' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' :
                    formData.status === 'Sent' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' :
                    formData.status === 'Rejected' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300' :
                    'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  }`}>
                    {formData.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Quote No: <span className="font-semibold text-gray-700 dark:text-gray-300">{formData.quotationNumber}</span> | Date: {formData.date}
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-right">
                <span className="text-[11px] text-gray-500 block">Grand Total Amount</span>
                <span className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">₹ {Number(formData.totalAmount || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Customer & Transport/Packing Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50/70 dark:bg-gray-800/40 p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Customer Information</span>
                <p className="text-xs font-bold text-gray-900 dark:text-white">{formData.customerName}</p>
                {formData.customerEmail && <p className="text-xs text-gray-600 dark:text-gray-400">Email: {formData.customerEmail}</p>}
                {formData.customerPhone && <p className="text-xs text-gray-600 dark:text-gray-400">Phone: {formData.customerPhone}</p>}
                {formData.customerAddress && <p className="text-xs text-gray-600 dark:text-gray-400">Address: {formData.customerAddress}</p>}
              </div>

              <div className="bg-gray-50/70 dark:bg-gray-800/40 p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Transport & Packaging</span>
                <p className="text-xs text-gray-700 dark:text-gray-300">
                  <span className="font-semibold">Transport:</span> {formData.transportationType} (₹{formData.transportationCharges})
                </p>
                <p className="text-xs text-gray-700 dark:text-gray-300">
                  <span className="font-semibold">Packaging:</span> {formData.packagingType} (₹{formData.packagingCharges})
                </p>
              </div>
            </div>

            {/* Quotation Items Summary Table */}
            <div className="bg-white dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800 font-bold text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wider flex justify-between items-center">
                <span>Quoted Items ({formData.items.length})</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/50 dark:bg-gray-800/50 text-gray-500 border-b border-gray-100 dark:border-gray-800">
                    <tr>
                      <th className="px-3 py-2 font-semibold">#</th>
                      <th className="px-3 py-2 font-semibold">Product Name & Specifications</th>
                      <th className="px-3 py-2 font-semibold text-right">Qty</th>
                      <th className="px-3 py-2 font-semibold">Unit</th>
                      <th className="px-3 py-2 font-semibold text-right">Unit Rate (₹)</th>
                      <th className="px-3 py-2 font-semibold text-right">Tax (%)</th>
                      <th className="px-3 py-2 font-semibold text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {formData.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                        <td className="px-3 py-2 text-gray-400 font-medium">{idx + 1}</td>
                        <td className="px-3 py-2">
                          <div className="font-bold text-gray-900 dark:text-white">{item.productName || "Product"}</div>
                          {item.description && (
                            <div className="text-[11px] text-gray-500 dark:text-gray-400 font-normal mt-0.5">
                              Spec: {item.description}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 font-semibold text-right text-gray-900 dark:text-white">{item.quantity}</td>
                        <td className="px-3 py-2 text-gray-500">{item.unit || "PCS"}</td>
                        <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-white">₹{Number(item.rate || 0).toFixed(2)}</td>
                        <td className="px-3 py-2 text-right text-gray-500">{item.taxRate || 0}%</td>
                        <td className="px-3 py-2 text-right font-bold text-indigo-600 dark:text-indigo-400">₹{Number(item.amount || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Calculations & Remarks */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              {formData.remarks ? (
                <div className="flex-1 bg-gray-50/70 dark:bg-gray-800/40 p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 space-y-1 w-full">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Remarks & Notes</span>
                  <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{formData.remarks}</p>
                </div>
              ) : <div className="flex-1" />}

              <div className="w-full sm:w-80 bg-gray-50 dark:bg-gray-800/60 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>Items Subtotal:</span> <span>₹{Number(formData.subtotal || 0).toFixed(2)}</span></div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>Transport Charges:</span> <span>+ ₹{Number(formData.transportationCharges || 0).toFixed(2)}</span></div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>Packaging Charges:</span> <span>+ ₹{Number(formData.packagingCharges || 0).toFixed(2)}</span></div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>Total Tax:</span> <span>+ ₹{Number(formData.taxAmount || 0).toFixed(2)}</span></div>
                {formData.discount > 0 && <div className="flex justify-between text-emerald-600"><span>Discount:</span> <span>- ₹{Number(formData.discount || 0).toFixed(2)}</span></div>}
                <div className="flex justify-between font-extrabold text-xs text-gray-900 dark:text-white pt-1.5 border-t border-gray-200 dark:border-gray-700">
                  <span>Grand Total:</span> <span className="text-indigo-600 dark:text-indigo-400">₹{Number(formData.totalAmount || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Preview Footer Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={handleDownloadPDFClientSide}
                className="px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Download size={14} />
                Download PDF
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-md"
              >
                Close Summary
              </button>
            </div>
          </div>
        ) : (
          /* FORM EDITABLE VIEW - ULTRA WIDE OPTIMIZED */
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
            
            {/* 1. Customer & Details Card (Single Row Layout) */}
            <div className="bg-white dark:bg-gray-800/40 p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-3 shadow-sm">
              <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-2">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                Customer & Quotation Details
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
                    Quotation No {initialData && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="text"
                    required={!!initialData}
                    disabled={!initialData}
                    value={formData.quotationNumber}
                    onChange={(e) => setFormData({ ...formData, quotationNumber: e.target.value })}
                    className={`w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium ${!initialData ? 'text-gray-400 cursor-not-allowed' : ''}`}
                    placeholder="Auto-generated"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Sent">Sent</option>
                    <option value="Accepted">Accepted</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mb-1">
                    Currency
                  </label>
                  <select
                    value={formData.currency || 'INR'}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-3 py-1.5 bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold text-indigo-700 dark:text-indigo-300 focus:ring-2 focus:ring-indigo-500"
                  >
                    {CURRENCY_OPTIONS.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2 lg:col-span-2">
                  <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
                    Customer Name (from Master) <span className="text-red-500">*</span>
                  </label>
                  <SearchableSelect
                    options={customers.map((c: any) => ({
                      value: c._id || c.name,
                      label: `${c.name}${c.code ? ` (${c.code})` : ''}${c.city ? ` - ${c.city}` : ''}`
                    }))}
                    value={formData.customer || (customers.find(c => c.name === formData.customerName)?._id) || formData.customerName}
                    onChange={(val: any) => {
                      const selected = customers.find(c => c._id === val || c.name === val);
                      const fullAddr = selected?.address || selected?.billingAddress || [selected?.street, selected?.city, selected?.state, selected?.pincode].filter(Boolean).join(", ") || "";
                      setFormData(prev => ({
                        ...prev,
                        customer: selected?._id || val,
                        customerName: selected?.name || val,
                        customerEmail: selected?.email || prev.customerEmail || "",
                        customerPhone: selected?.phone || prev.customerPhone || "",
                        customerAddress: fullAddr || prev.customerAddress || ""
                      }));
                    }}
                    placeholder="Select Customer from Master..."
                    className="w-full text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
                    Customer Address
                  </label>
                  <input
                    type="text"
                    value={formData.customerAddress}
                    onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
                    className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium"
                    placeholder="Address..."
                  />
                </div>
              </div>
            </div>

            {/* 2. Quotation Items Section Card (Ultra Wide Table Layout) */}
            <div className="bg-white dark:bg-gray-800/40 p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Package className="w-3.5 h-3.5 text-indigo-600" />
                  Quotation Items ({formData.items.length})
                </h3>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-300 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Product Item
                </button>
              </div>

              {/* Wide Header Labels */}
              <div className="hidden md:grid grid-cols-12 gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">
                <div className="col-span-2">Source</div>
                <div className="col-span-3">Product Name / Selection</div>
                <div className="col-span-1 text-center">Qty</div>
                <div className="col-span-1">Unit</div>
                <div className="col-span-1 text-right">Rate ({getCurrencySymbol(formData.currency)})</div>
                <div className="col-span-1 text-right">Tax (%)</div>
                <div className="col-span-2">Description / Specs</div>
                <div className="col-span-1 text-right">Action</div>
              </div>

              {/* Items Row list */}
              <div className="space-y-2">
                {formData.items.map((item, index) => (
                  <div key={index} className="p-2.5 bg-gray-50/70 dark:bg-gray-800/50 border border-gray-200/80 dark:border-gray-700 rounded-xl transition-all">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center text-xs">
                      
                      {/* Item Source */}
                      <div className="md:col-span-2">
                        <label className="block md:hidden text-[10px] text-gray-400">Source</label>
                        <select
                          value={item.itemType}
                          onChange={(e) => handleItemChange(index, "itemType", e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium"
                        >
                          <option value="fg">FG Master</option>
                          <option value="custom">Custom</option>
                        </select>
                      </div>

                      {/* Product Name */}
                      <div className="md:col-span-3">
                        <label className="block md:hidden text-[10px] text-gray-400">Product</label>
                        {item.itemType === "fg" ? (
                          <select
                            required
                            value={item.component}
                            onChange={(e) => handleItemChange(index, "component", e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium"
                          >
                            <option value="">Select FG Item...</option>
                            {components.map(fg => (
                              <option key={fg._id} value={fg._id}>{fg.name} ({fg.code || 'FG'})</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            required
                            placeholder="Custom product name..."
                            value={item.productName}
                            onChange={(e) => handleItemChange(index, "productName", e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium"
                          />
                        )}
                      </div>

                      {/* Qty */}
                      <div className="md:col-span-1">
                        <label className="block md:hidden text-[10px] text-gray-400">Qty</label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          required
                          value={item.quantity || ""}
                          onChange={(e) => handleItemChange(index, "quantity", e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium text-center"
                        />
                      </div>

                      {/* Unit */}
                      <div className="md:col-span-1">
                        <label className="block md:hidden text-[10px] text-gray-400">Unit</label>
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => handleItemChange(index, "unit", e.target.value)}
                          className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium"
                          placeholder="PCS"
                        />
                      </div>

                      {/* Unit Rate */}
                      <div className="md:col-span-1">
                        <label className="block md:hidden text-[10px] text-gray-400">Rate (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={item.rate || ""}
                          onChange={(e) => handleItemChange(index, "rate", e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium text-right"
                          placeholder="0.00"
                        />
                      </div>

                      {/* Tax % */}
                      <div className="md:col-span-1">
                        <label className="block md:hidden text-[10px] text-gray-400">Tax %</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={item.taxRate || ""}
                          onChange={(e) => handleItemChange(index, "taxRate", e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium text-right"
                          placeholder="18"
                        />
                      </div>

                      {/* Specs */}
                      <div className="md:col-span-2">
                        <label className="block md:hidden text-[10px] text-gray-400">Specs</label>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleItemChange(index, "description", e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium"
                          placeholder="Specifications..."
                        />
                      </div>

                      {/* Actions & Item Total */}
                      <div className="md:col-span-1 flex items-center justify-end gap-2">
                        <span className="font-bold text-xs text-indigo-600 dark:text-indigo-400">₹{Number(item.amount || 0).toFixed(0)}</span>
                        {formData.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                            title="Remove item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Transportation & Packaging Charges Section Card */}
            <div className="bg-white dark:bg-gray-800/40 p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-3 shadow-sm">
              <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-2">
                <Truck className="w-3.5 h-3.5 text-indigo-600" />
                Transportation & Packaging Charges
              </h3>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
                    Transportation Type
                  </label>
                  <select
                    value={formData.transportationType}
                    onChange={(e) => setFormData({ ...formData, transportationType: e.target.value })}
                    className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Included">Included in Rate</option>
                    <option value="Road Freight">Road Freight</option>
                    <option value="Air Cargo">Air Cargo</option>
                    <option value="Express Courier">Express Courier</option>
                    <option value="Rail Freight">Rail Freight</option>
                    <option value="Sea Freight">Sea Freight</option>
                    <option value="Customer Scope">Customer Scope</option>
                    <option value="Extra at Actuals">Extra at Actuals</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
                    Transportation Charges (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.transportationCharges || ""}
                    onChange={(e) => setFormData({ ...formData, transportationCharges: e.target.value === '' ? 0 : Number(e.target.value) })}
                    className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
                    Packaging Type
                  </label>
                  <select
                    value={formData.packagingType}
                    onChange={(e) => setFormData({ ...formData, packagingType: e.target.value })}
                    className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Standard">Standard Packing</option>
                    <option value="Wooden Box">Wooden Box</option>
                    <option value="Bubble Wrap">Bubble Wrap</option>
                    <option value="Corrugated Box">Corrugated Box</option>
                    <option value="Palletized">Palletized Export Packing</option>
                    <option value="Custom Packing">Custom Packing</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
                    Packaging Charges (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.packagingCharges || ""}
                    onChange={(e) => setFormData({ ...formData, packagingCharges: e.target.value === '' ? 0 : Number(e.target.value) })}
                    className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* 4. Remarks & Calculations Row (Side by Side Layout) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              {/* Remarks Box */}
              <div className="md:col-span-7 bg-white dark:bg-gray-800/40 p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-1.5 shadow-sm">
                <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                  Remarks & Internal Notes
                </label>
                <textarea
                  rows={2}
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                  placeholder="Payment terms, validity period, delivery lead time..."
                />
              </div>

              {/* Grand Total Summary Box */}
              <div className="md:col-span-5 bg-indigo-50/60 dark:bg-indigo-950/30 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/50 space-y-2">
                <div className="flex justify-between items-center text-xs text-gray-600 dark:text-gray-300">
                  <span>Items Subtotal:</span>
                  <span className="font-semibold">₹{Number(formData.subtotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-gray-600 dark:text-gray-300">
                  <span>Transport + Packaging:</span>
                  <span className="font-semibold">+ ₹{(Number(formData.transportationCharges || 0) + Number(formData.packagingCharges || 0)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-gray-600 dark:text-gray-300">
                  <span>Total Tax:</span>
                  <span className="font-semibold">+ ₹{Number(formData.taxAmount || 0).toFixed(2)}</span>
                </div>
                
                <div className="flex items-center justify-between pt-1 border-t border-indigo-100 dark:border-indigo-900/50">
                  <span className="text-[11px] font-semibold text-gray-500">Discount (₹):</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.discount || ""}
                    onChange={(e) => setFormData({ ...formData, discount: e.target.value === '' ? 0 : Number(e.target.value) })}
                    className="w-24 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs font-medium text-right"
                    placeholder="0.00"
                  />
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-indigo-200 dark:border-indigo-800">
                  <span className="text-xs font-extrabold text-gray-900 dark:text-white">Grand Total:</span>
                  <span className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">₹ {Number(formData.totalAmount || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Form Footer Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-md disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? "Saving..." : (initialData ? "Update Quotation" : "Save Quotation")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
