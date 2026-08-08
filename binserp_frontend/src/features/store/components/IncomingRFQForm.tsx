"use client";

import React, { useState, useEffect } from "react";
import { Plus, Trash2, X, FileText, Download, Building2, Calendar, Package, Paperclip, Upload, Eye, CheckCircle2, AlertCircle } from "lucide-react";
import Swal from "sweetalert2";
import SearchableSelect from "./SearchableSelect";
import { API_BASE_URL } from "@/src/utils/config";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface IncomingRFQFormProps {
  initialData?: any;
  fgItems: any[];
  customers?: any[];
  companyInfo?: any;
  isOpen?: boolean;
  onSubmit: (data: any) => void;
  onClose?: () => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  isPreview?: boolean;
}

export const IncomingRFQForm: React.FC<IncomingRFQFormProps> = ({
  initialData,
  fgItems = [],
  customers = [],
  companyInfo,
  isOpen = true,
  onSubmit,
  onClose,
  onCancel,
  isSubmitting,
  isPreview
}) => {
  const [customerType, setCustomerType] = useState<"master" | "custom">("master");
  const [prefix, setPrefix] = useState("RFQ");
  const [showDocModal, setShowDocModal] = useState(false);

  const generateRfqNumber = (currentPrefix: string) => {
    const currentYear = new Date().getFullYear();
    return `${currentPrefix}-${currentYear}-Auto`;
  };

  const [formData, setFormData] = useState({
    rfqNumber: generateRfqNumber(prefix),
    date: new Date().toISOString().split("T")[0],
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    expectedDeliveryDate: "",
    remarks: "",
    status: "Open",
    attachedDocument: "",
    attachedDocumentName: "",
    items: [
      {
        itemType: "Custom",
        fgItem: "",
        customItemName: "",
        quantity: 1,
        unit: "PCS",
        description: "",
        targetPrice: 0,
      }
    ],
  });

  useEffect(() => {
    if (initialData) {
      const formattedItems = initialData.items?.length > 0 ? initialData.items.map((i: any) => ({
        itemType: i.itemType || "Custom",
        fgItem: typeof i.fgItem === "object" ? i.fgItem?._id : i.fgItem || "",
        customItemName: i.customItemName || "",
        quantity: i.quantity || 1,
        unit: i.unit || "PCS",
        description: i.description || "",
        targetPrice: i.targetPrice || 0,
      })) : [];

      setFormData({
        rfqNumber: initialData.rfqNumber || "Auto-generated",
        date: initialData.date ? new Date(initialData.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
        customerName: initialData.customerName || "",
        customerEmail: initialData.customerEmail || "",
        customerPhone: initialData.customerPhone || "",
        expectedDeliveryDate: initialData.expectedDeliveryDate ? new Date(initialData.expectedDeliveryDate).toISOString().split("T")[0] : "",
        remarks: initialData.remarks || "",
        status: initialData.status || "Open",
        attachedDocument: initialData.attachedDocument || "",
        attachedDocumentName: initialData.attachedDocumentName || "",
        items: formattedItems.length > 0 ? formattedItems : [
          {
            itemType: "Custom",
            fgItem: "",
            customItemName: "",
            quantity: 1,
            unit: "PCS",
            description: "",
            targetPrice: 0,
          }
        ],
      });

      if (initialData.customerName && customers.length > 0) {
        const isMaster = customers.some(c => c.name === initialData.customerName);
        setCustomerType(isMaster ? "master" : "custom");
      }
    }
  }, [initialData]);

  useEffect(() => {
    const fetchPrefix = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE_URL}/api/store/prefix`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await res.json();
        if (data.settings?.incomingRfqPrefix) {
          const loadedPrefix = data.settings.incomingRfqPrefix;
          setPrefix(loadedPrefix);
          if (!initialData) {
            setFormData(prev => ({ ...prev, rfqNumber: generateRfqNumber(loadedPrefix) }));
          }
        }
      } catch (error) {
        console.error("Failed to fetch prefix settings", error);
      }
    };
    if (!initialData) fetchPrefix();
  }, [initialData]);

  const handleClose = () => {
    if (onClose) onClose();
    else if (onCancel) onCancel();
  };

  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      const fileNameLower = file.name.toLowerCase();
      const isPdf = file.type === "application/pdf" || fileNameLower.endsWith(".pdf");
      const isJpeg = file.type === "image/jpeg" || file.type === "image/jpg" || fileNameLower.endsWith(".jpg") || fileNameLower.endsWith(".jpeg");

      if (!isPdf && !isJpeg) {
        Swal.fire({
          icon: 'error',
          title: 'Invalid File Format',
          text: 'Only PDF (.pdf) and JPEG (.jpg, .jpeg) documents are allowed.',
          confirmButtonColor: '#4f46e5'
        });
        e.target.value = "";
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        Swal.fire({
          icon: 'error',
          title: 'File Too Large',
          text: 'Document size must be under 10MB.',
          confirmButtonColor: '#4f46e5'
        });
        e.target.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const base64Data = uploadEvent.target?.result as string;
        setFormData(prev => ({
          ...prev,
          attachedDocument: base64Data,
          attachedDocumentName: file.name
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Safe document opening converting data URL to Blob URL to bypass browser security blocks
  const handleOpenDocument = () => {
    if (!formData.attachedDocument) return;

    try {
      if (formData.attachedDocument.startsWith("data:")) {
        const parts = formData.attachedDocument.split(";base64,");
        const contentType = parts[0].replace("data:", "");
        const byteCharacters = atob(parts[1]);
        const byteArrays = [];

        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
          const slice = byteCharacters.slice(offset, offset + 512);
          const byteNumbers = new Array(slice.length);
          for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          byteArrays.push(byteArray);
        }

        const blob = new Blob(byteArrays, { type: contentType });
        const blobUrl = URL.createObjectURL(blob);
        
        // Open popup modal in frontend or new window
        const win = window.open(blobUrl, "_blank");
        if (!win) {
          setShowDocModal(true);
        }
      } else {
        window.open(formData.attachedDocument, "_blank");
      }
    } catch (err) {
      console.error("Failed to open document blob URL", err);
      setShowDocModal(true);
    }
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    (newItems[index] as any)[field] = value;

    if (field === "itemType") {
      if (value === "Custom") {
        newItems[index].fgItem = "";
      } else {
        newItems[index].customItemName = "";
      }
    } else if (field === "fgItem" && value) {
      const selectedFg = fgItems.find(f => f._id === value);
      const priceConfig = (priceLists || []).find(p => (p.fgItem?._id || p.fgItem) === value);
      const resolvedPrice = priceConfig?.price ?? selectedFg?.sellingPrice;
      if (resolvedPrice !== undefined && resolvedPrice !== null && resolvedPrice !== "") {
        newItems[index].targetPrice = Number(resolvedPrice);
      }
      if (selectedFg?.unit) {
        newItems[index].unit = selectedFg.unit;
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
          itemType: "Custom",
          fgItem: "",
          customItemName: "",
          quantity: 1,
          unit: "PCS",
          description: "",
          targetPrice: 0,
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
      handleClose();
      return;
    }

    if (!formData.customerName || !formData.customerName.trim()) {
      Swal.fire({
        icon: 'error',
        title: 'Customer Name Required',
        text: 'Please select a Customer from Master list or enter Custom Customer Name.',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }

    if (!formData.items || formData.items.length === 0) {
      Swal.fire({
        icon: 'error',
        title: 'Inquiry Items Required',
        text: 'Please add at least one item to the inquiry.',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }

    for (let i = 0; i < formData.items.length; i++) {
      const item = formData.items[i];
      if (item.itemType === "Custom" && (!item.customItemName || !item.customItemName.trim())) {
        Swal.fire({
          icon: 'error',
          title: 'Validation Error',
          text: `Item #${i + 1}: Custom item name cannot be empty.`,
          confirmButtonColor: '#4f46e5'
        });
        return;
      }
      if (item.itemType === "FGItem" && (!item.fgItem || !item.fgItem.trim())) {
        Swal.fire({
          icon: 'error',
          title: 'Validation Error',
          text: `Item #${i + 1}: Please select a Finished Good (FG Item) from the list.`,
          confirmButtonColor: '#4f46e5'
        });
        return;
      }
      if (!item.quantity || Number(item.quantity) <= 0) {
        Swal.fire({
          icon: 'error',
          title: 'Validation Error',
          text: `Item #${i + 1}: Please enter a valid quantity greater than 0.`,
          confirmButtonColor: '#4f46e5'
        });
        return;
      }
    }

    const payload = {
      ...formData,
      items: formData.items.map(item => ({
        itemType: item.itemType,
        fgItem: item.itemType === "FGItem" && item.fgItem ? item.fgItem : null,
        customItemName: item.itemType === "Custom" ? item.customItemName : "",
        quantity: Number(item.quantity),
        unit: item.unit || "PCS",
        description: item.description || "",
        targetPrice: Number(item.targetPrice || 0)
      }))
    };

    if (!initialData) {
      delete (payload as any).rfqNumber;
    }

    onSubmit(payload);
  };

  // Pure Client-Side PDF Generation (works 100% reliably in Production / EC2 without backend Puppeteer)
  const handleDownloadPDFClientSide = () => {
    try {
      const doc = new jsPDF();

      // Header Banner
      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, 210, 24, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("INWARD REQUEST FOR QUOTATION (RFQ)", 14, 15);

      // Metadata Info
      doc.setTextColor(40, 40, 40);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`RFQ Number: ${formData.rfqNumber || 'RFQ-Auto'}`, 14, 32);
      doc.text(`Inquiry Date: ${formData.date || ''}`, 14, 38);
      doc.text(`Status: ${formData.status || 'Open'}`, 14, 44);

      doc.text(`Customer Name: ${formData.customerName || '-'}`, 110, 32);
      doc.setFont("helvetica", "normal");
      if (formData.customerEmail) doc.text(`Email: ${formData.customerEmail}`, 110, 38);
      if (formData.customerPhone) doc.text(`Phone: ${formData.customerPhone}`, 110, 44);
      if (formData.expectedDeliveryDate) doc.text(`Expected Delivery: ${formData.expectedDeliveryDate}`, 110, 50);

      // Table of Inquiry Items
      const tableData = (formData.items || []).map((item: any, idx: number) => {
        const itemName = item.itemType === "FGItem" 
          ? (fgItems.find(f => f._id === item.fgItem)?.name || item.fgItem || "Finished Good") 
          : (item.customItemName || "Custom Item");
        return [
          idx + 1,
          itemName,
          item.itemType,
          item.quantity || 0,
          item.unit || "PCS",
          item.targetPrice ? `₹${Number(item.targetPrice).toFixed(2)}` : "-",
          item.description || "-"
        ];
      });

      autoTable(doc, {
        startY: 56,
        head: [["#", "Item Name", "Type", "Qty", "Unit", "Target Price", "Specification"]],
        body: tableData,
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: "bold" },
        styles: { fontSize: 8, cellPadding: 3 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });

      const finalY = (doc as any).lastAutoTable?.finalY || 100;

      if (formData.remarks) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("Remarks & Notes:", 14, finalY + 8);
        doc.setFont("helvetica", "normal");
        doc.text(formData.remarks, 14, finalY + 14);
      }

      if (formData.attachedDocumentName) {
        const noteY = formData.remarks ? finalY + 24 : finalY + 8;
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(`Attached Document: ${formData.attachedDocumentName}`, 14, noteY);
      }

      doc.save(`Inward_RFQ_${formData.rfqNumber || Date.now()}.pdf`);
    } catch (err: any) {
      console.error("Client-side PDF generation error:", err);
      Swal.fire({
        icon: 'error',
        title: 'PDF Export Error',
        text: 'Failed to generate PDF on frontend.',
        confirmButtonColor: '#4f46e5'
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-gray-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col border border-gray-100 dark:border-gray-800">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <FileText className="w-5 h-5" />
              </div>
              {isPreview ? "Inward RFQ Information" : (initialData ? "Edit Inward RFQ" : "Create Inward RFQ")}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {isPreview ? "Combined summary of recorded customer inquiry details." : "Record incoming customer requests for quotation for finished goods or custom items."}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* COMBINED INFORMATION PREVIEW VIEW */}
        {isPreview ? (
          <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
            {/* Top Summary Banner */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-indigo-950/40 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">{formData.customerName || "Customer Inquiry"}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    formData.status === 'Open' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' :
                    formData.status === 'Quoted' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' :
                    formData.status === 'Closed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' :
                    'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300'
                  }`}>
                    {formData.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  RFQ No: <span className="font-semibold text-gray-700 dark:text-gray-300">{formData.rfqNumber}</span> | Date: {formData.date}
                </p>
              </div>

              {formData.expectedDeliveryDate && (
                <div className="bg-white dark:bg-gray-800 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs">
                  <span className="text-gray-500 block">Expected Delivery</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{formData.expectedDeliveryDate}</span>
                </div>
              )}
            </div>

            {/* Combined Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50/70 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-1.5">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Customer Information</span>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{formData.customerName}</p>
                {formData.customerEmail && <p className="text-xs text-gray-600 dark:text-gray-400">Email: {formData.customerEmail}</p>}
                {formData.customerPhone && <p className="text-xs text-gray-600 dark:text-gray-400">Phone: {formData.customerPhone}</p>}
              </div>

              <div className="bg-gray-50/70 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-1.5">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Attached Document</span>
                {formData.attachedDocument ? (
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2 truncate">
                      <Paperclip className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{formData.attachedDocumentName || "Document"}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenDocument}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1 shrink-0"
                    >
                      <Eye size={12} /> View File
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic pt-1">No PDF or JPEG attached.</p>
                )}
              </div>
            </div>

            {/* Inquiry Items Summary Table */}
            <div className="bg-white dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800 font-bold text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wider flex justify-between items-center">
                <span>Inquiry Items</span>
                <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full text-[11px]">{formData.items.length} items</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/50 dark:bg-gray-800/50 text-gray-500 border-b border-gray-100 dark:border-gray-800">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">#</th>
                      <th className="px-4 py-2.5 font-semibold">Item Details</th>
                      <th className="px-4 py-2.5 font-semibold">Type</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Qty</th>
                      <th className="px-4 py-2.5 font-semibold">Unit</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Target Price</th>
                      <th className="px-4 py-2.5 font-semibold">Specification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {formData.items.map((item, idx) => {
                      const itemName = item.itemType === "FGItem" 
                        ? (fgItems.find(f => f._id === item.fgItem)?.name || item.fgItem || "Finished Good") 
                        : (item.customItemName || "Custom Item");
                      return (
                        <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                          <td className="px-4 py-3 text-gray-400 font-medium">{idx + 1}</td>
                          <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{itemName}</td>
                          <td className="px-4 py-3 text-gray-500">{item.itemType}</td>
                          <td className="px-4 py-3 font-semibold text-right text-gray-900 dark:text-white">{item.quantity}</td>
                          <td className="px-4 py-3 text-gray-500">{item.unit || "PCS"}</td>
                          <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                            {item.targetPrice ? `₹${Number(item.targetPrice).toFixed(2)}` : "-"}
                          </td>
                          <td className="px-4 py-3 text-gray-500 italic">{item.description || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Remarks Section */}
            {formData.remarks && (
              <div className="bg-gray-50/70 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-1">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Remarks & Notes</span>
                <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{formData.remarks}</p>
              </div>
            )}

            {/* Preview Footer Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={handleDownloadPDFClientSide}
                className="px-4 py-2.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors flex items-center gap-2"
              >
                <Download size={15} />
                Download PDF (Frontend)
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-md"
              >
                Close Summary
              </button>
            </div>
          </div>
        ) : (
          /* FORM EDITABLE VIEW */
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
            {/* Basic Details Section Card */}
            <div className="bg-white dark:bg-gray-800/40 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
                <Building2 className="w-4 h-4 text-indigo-600" />
                Customer & Inquiry Details
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    RFQ Number {initialData && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="text"
                    required={!!initialData}
                    disabled={!initialData}
                    value={formData.rfqNumber}
                    onChange={(e) => setFormData({ ...formData, rfqNumber: e.target.value })}
                    className={`w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 ${!initialData ? 'text-gray-500 cursor-not-allowed' : ''}`}
                    placeholder="Auto-generated"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Inquiry Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Open">Open</option>
                    <option value="Quoted">Quoted</option>
                    <option value="Closed">Closed</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>

                <div className="sm:col-span-2 lg:col-span-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Customer Name <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Master List</span>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerType(customerType === "master" ? "custom" : "master");
                          setFormData({ ...formData, customerName: "", customerEmail: "", customerPhone: "" });
                        }}
                        className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${customerType === "custom" ? "bg-indigo-600" : "bg-gray-300"}`}
                      >
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${customerType === "custom" ? "translate-x-4" : "translate-x-1"}`} />
                      </button>
                      <span className="text-xs text-gray-500">Custom Entry</span>
                    </div>
                  </div>

                  {customerType === "master" ? (
                    <div>
                      <SearchableSelect
                        options={customers.map((c: any) => ({ value: c.name, label: c.name || '' }))}
                        value={formData.customerName}
                        onChange={(val: any) => {
                          const selected = customers.find(c => c.name === val);
                          setFormData({
                            ...formData,
                            customerName: val,
                            customerEmail: selected?.email || "",
                            customerPhone: selected?.phone || ""
                          });
                        }}
                        placeholder="Search and select customer from master list..."
                        className="w-full"
                      />
                    </div>
                  ) : (
                    <input
                      type="text"
                      required
                      value={formData.customerName}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                      placeholder="Enter customer name..."
                    />
                  )}
                </div>

                {customerType === "custom" && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                        Customer Email
                      </label>
                      <input
                        type="email"
                        value={formData.customerEmail}
                        onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                        className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium"
                        placeholder="customer@email.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                        Customer Phone
                      </label>
                      <input
                        type="text"
                        value={formData.customerPhone}
                        onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                        className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium"
                        placeholder="+91 9876543210"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Expected Delivery Date
                  </label>
                  <input
                    type="date"
                    value={formData.expectedDeliveryDate}
                    onChange={(e) => setFormData({ ...formData, expectedDeliveryDate: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Inquiry Items Section Card */}
            <div className="bg-white dark:bg-gray-800/40 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Package className="w-4 h-4 text-indigo-600" />
                  Inquiry Items ({formData.items.length})
                </h3>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-300 rounded-xl transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Inquiry Item
                </button>
              </div>

              <div className="space-y-3">
                {formData.items.map((item, index) => (
                  <div key={index} className="p-4 bg-gray-50/70 dark:bg-gray-800/50 border border-gray-200/80 dark:border-gray-700 rounded-xl relative group transition-all">
                    {formData.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="absolute -top-2.5 -right-2.5 p-1 bg-red-100 text-red-600 rounded-full hover:bg-red-200 shadow-sm transition-colors"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-3 lg:col-span-2">
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Item Source</label>
                        <select
                          value={item.itemType}
                          onChange={(e) => handleItemChange(index, "itemType", e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium"
                        >
                          <option value="Custom">Custom Entry</option>
                          <option value="FGItem">FG Item Master</option>
                        </select>
                      </div>

                      <div className="sm:col-span-5 lg:col-span-4">
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                          Item Name / Selection <span className="text-red-500">*</span>
                        </label>
                        {item.itemType === "FGItem" ? (
                          <select
                            required
                            value={item.fgItem}
                            onChange={(e) => handleItemChange(index, "fgItem", e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium"
                          >
                            <option value="">Select Finished Goods...</option>
                            {fgItems.map(fg => (
                              <option key={fg._id} value={fg._id}>{fg.name} ({fg.code || 'FG'})</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            required
                            placeholder="e.g. Custom Shaft Bracket 50mm"
                            value={item.customItemName}
                            onChange={(e) => handleItemChange(index, "customItemName", e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium"
                          />
                        )}
                      </div>

                      <div className="sm:col-span-2 lg:col-span-2">
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                          Qty <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          required
                          value={item.quantity || ""}
                          onChange={(e) => handleItemChange(index, "quantity", e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium"
                        />
                      </div>

                      <div className="sm:col-span-2 lg:col-span-2">
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Unit</label>
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => handleItemChange(index, "unit", e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium"
                          placeholder="PCS"
                        />
                      </div>

                      <div className="sm:col-span-3 lg:col-span-2">
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Target Price (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.targetPrice || ""}
                          onChange={(e) => handleItemChange(index, "targetPrice", e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium"
                          placeholder="0.00"
                        />
                      </div>

                      <div className="sm:col-span-9 lg:col-span-10">
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Specification / Description</label>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleItemChange(index, "description", e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium"
                          placeholder="Additional specs or customer requirements..."
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Attached Document Section Card (Restricted to PDF and JPEG) */}
            <div className="bg-white dark:bg-gray-800/40 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-3 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
                <Paperclip className="w-4 h-4 text-indigo-600" />
                Attached Document <span className="text-xs font-normal text-gray-400">(PDF or JPEG only)</span>
              </h3>

              {formData.attachedDocument ? (
                <div className="flex items-center justify-between p-3.5 bg-indigo-50/60 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800/50 rounded-xl">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-2 bg-indigo-600 text-white rounded-lg">
                      <FileText size={18} />
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                        {formData.attachedDocumentName || "Attached_Document.pdf"}
                      </p>
                      <span className="text-[11px] text-indigo-600 dark:text-indigo-300">Document attached</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleOpenDocument}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                    >
                      <Eye size={14} /> Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, attachedDocument: "", attachedDocumentName: "" }))}
                      className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      title="Remove attachment"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center hover:border-indigo-400 transition-colors">
                  <label className="cursor-pointer flex flex-col items-center justify-center gap-1.5">
                    <Upload className="w-6 h-6 text-gray-400" />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Click to upload customer drawing or RFQ document <span className="font-bold text-indigo-600 dark:text-indigo-400">(PDF or JPEG only)</span>
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,image/jpeg,application/pdf"
                      onChange={handleDocumentUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Remarks Section */}
            <div className="bg-white dark:bg-gray-800/40 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-2 shadow-sm">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                Remarks & Internal Notes
              </label>
              <textarea
                rows={2}
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                placeholder="Add any specific notes or follow-up instructions..."
              />
            </div>

            {/* Form Footer Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-2.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-md disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? "Saving..." : (initialData ? "Update Inward RFQ" : "Save Inward RFQ")}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Built-in Document Preview Modal for fallback viewing */}
      {showDocModal && formData.attachedDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-md">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-4xl h-[85vh] shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
              <span className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-indigo-600" />
                {formData.attachedDocumentName || "Attached Document"}
              </span>
              <button
                type="button"
                onClick={() => setShowDocModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 bg-gray-100 dark:bg-gray-950 p-2 overflow-auto flex items-center justify-center">
              {formData.attachedDocument.startsWith("data:image/") || formData.attachedDocumentName.match(/\.(jpg|jpeg|png)$/i) ? (
                <img
                  src={formData.attachedDocument}
                  alt="Attachment Preview"
                  className="max-h-full max-w-full object-contain rounded-lg shadow-md"
                />
              ) : (
                <iframe
                  src={formData.attachedDocument}
                  title="Document Preview"
                  className="w-full h-full rounded-lg border-0 bg-white"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
