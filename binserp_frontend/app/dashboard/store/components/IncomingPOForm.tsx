import React, { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, X, Search, FileText, Download, Calculator, Building2, Truck, Package, Activity, Layers } from "lucide-react";
import SearchableSelect from "./SearchableSelect";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useGetIncomingPODispatchHistoryQuery } from "@/src/store/services/storeService";

interface IncomingPOFormProps {
  isOpen?: boolean;
  initialData?: any;
  fgItems: any[];
  customers?: any[];
  priceLists?: any[];
  quotations?: any[];
  companyInfo?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  onClose?: () => void;
  isSubmitting?: boolean;
  isPreview?: boolean;
}

export const IncomingPOForm: React.FC<IncomingPOFormProps> = ({ 
  isOpen,
  initialData, 
  fgItems = [], 
  customers = [], 
  priceLists = [],
  quotations = [],
  companyInfo, 
  onSubmit, 
  onCancel, 
  onClose,
  isSubmitting, 
  isPreview 
}) => {
  const [formData, setFormData] = useState({
    poNumber: "",
    date: new Date().toISOString().split("T")[0],
    customer: "",
    quotationReference: "",
    items: [
      {
        itemType: "Custom",
        fgItem: "",
        productName: "",
        description: "",
        quantity: 1,
        unit: "PCS",
        rate: 0,
        amount: 0,
        taxRate: 0,
        taxAmount: 0,
        expectedDeliveryDate: "",
      }
    ],
    subtotal: 0,
    discount: 0,
    transportationType: "Road Transport",
    transportationCharges: 0,
    packagingType: "Standard Packaging",
    packagingCharges: 0,
    taxAmount: 0,
    totalAmount: 0,
    status: "Received",
    remarks: "",
    transportationMethod: "",
  });

  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [previewTab, setPreviewTab] = useState<"overview" | "dispatch">("overview");

  const { data: historyData } = useGetIncomingPODispatchHistoryQuery(initialData?._id, {
    skip: !initialData?._id || !isPreview
  });

  const deliveryChallans = historyData?.data?.deliveryChallans || [];
  const invoices = historyData?.data?.invoices || [];

  useEffect(() => {
    if (initialData) {
      const formattedItems = initialData.items?.length > 0 ? initialData.items.map((i: any) => ({
        itemType: i.fgItem ? "Master" : "Custom",
        fgItem: typeof i.fgItem === "object" ? i.fgItem?._id : i.fgItem || "",
        productName: i.productName || "",
        description: i.description || "",
        quantity: i.quantity || 1,
        unit: i.unit || "PCS",
        rate: i.rate || 0,
        amount: i.amount || 0,
        taxRate: i.taxRate || 0,
        taxAmount: i.taxAmount || 0,
        expectedDeliveryDate: i.expectedDeliveryDate ? new Date(i.expectedDeliveryDate).toISOString().split("T")[0] : "",
      })) : [];

      setFormData({
        poNumber: initialData.poNumber || "",
        date: initialData.date ? new Date(initialData.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
        customer: typeof initialData.customer === "object" ? initialData.customer?._id : initialData.customer || "",
        quotationReference: typeof initialData.quotationReference === "object" ? initialData.quotationReference?._id : initialData.quotationReference || "",
        items: formattedItems.length > 0 ? formattedItems : [{
          itemType: "Custom", fgItem: "", productName: "", description: "", quantity: 1, unit: "PCS", rate: 0, amount: 0, taxRate: 0, taxAmount: 0, expectedDeliveryDate: ""
        }],
        subtotal: initialData.subtotal || 0,
        discount: initialData.discount || 0,
        transportationType: initialData.transportationType || "Road Transport",
        transportationCharges: initialData.transportationCharges || 0,
        packagingType: initialData.packagingType || "Standard Packaging",
        packagingCharges: initialData.packagingCharges || 0,
        taxAmount: initialData.taxAmount || 0,
        totalAmount: initialData.totalAmount || 0,
        status: initialData.status || "Received",
        remarks: initialData.remarks || "",
        transportationMethod: initialData.transportationMethod || "",
      });
    }
  }, [initialData]);

  // Recalculate totals whenever items, discount, transport charges or packaging charges change
  useEffect(() => {
    let newSubtotal = 0;
    let newTaxAmount = 0;

    const newItems = formData.items.map(item => {
      const amount = (item.quantity || 0) * (item.rate || 0);
      const taxAmount = amount * ((item.taxRate || 0) / 100);
      newSubtotal += amount;
      newTaxAmount += taxAmount;
      return { ...item, amount, taxAmount };
    });

    const newTotalAmount = newSubtotal + newTaxAmount + Number(formData.transportationCharges || 0) + Number(formData.packagingCharges || 0) - Number(formData.discount || 0);

    if (
      newSubtotal !== formData.subtotal || 
      newTaxAmount !== formData.taxAmount || 
      newTotalAmount !== formData.totalAmount ||
      JSON.stringify(newItems) !== JSON.stringify(formData.items)
    ) {
      setFormData(prev => ({
        ...prev,
        items: newItems,
        subtotal: newSubtotal,
        taxAmount: newTaxAmount,
        totalAmount: newTotalAmount
      }));
    }
  }, [formData.items, formData.discount, formData.transportationCharges, formData.packagingCharges]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === "discount" || name === "transportationCharges" || name === "packagingCharges" ? Number(value) : value
    }));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      const item = { ...newItems[index] };

      if (field === "itemType") {
        item.itemType = value;
        if (value === "Custom") {
          item.fgItem = "";
        }
      } else if (field === "fgItem") {
        item.fgItem = value;
        const selectedFg = fgItems.find(f => f._id === value);
        const priceConfig = (priceLists || []).find(p => (p.fgItem?._id || p.fgItem) === value);
        if (selectedFg || priceConfig) {
          if (selectedFg) {
            item.productName = selectedFg.name;
            item.description = selectedFg.description || "";
            item.unit = selectedFg.unit || "PCS";
          }
          const resolvedPrice = priceConfig?.price ?? selectedFg?.sellingPrice;
          if (resolvedPrice !== undefined && resolvedPrice !== null && resolvedPrice !== "") {
            item.rate = Number(resolvedPrice);
          }
          const resolvedTax = priceConfig?.taxRate ?? selectedFg?.taxRate;
          if (resolvedTax !== undefined && resolvedTax !== null && resolvedTax !== "") {
            item.taxRate = Number(resolvedTax);
          }
        }
      } else if (field === "quantity" || field === "rate" || field === "taxRate") {
        (item as any)[field] = Number(value);
      } else {
        (item as any)[field] = value;
      }
      
      newItems[index] = item;
      return { ...prev, items: newItems };
    });
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        { itemType: "Custom", fgItem: "", productName: "", description: "", quantity: 1, unit: "PCS", rate: 0, amount: 0, taxRate: 0, taxAmount: 0, expectedDeliveryDate: "" }
      ]
    }));
  };

  const removeItem = (index: number) => {
    if (formData.items.length > 1) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      }));
    }
  };

  const selectedCustomerObj = useMemo(() => {
    return customers.find(c => (c._id || c.name || c.id) === formData.customer);
  }, [customers, formData.customer]);

  const handleDownloadPDFClientSide = () => {
    try {
      const doc = new jsPDF();

      const compName = companyInfo?.companyName || companyInfo?.name || "COMPANY MASTER";
      const compAddress = companyInfo?.address || companyInfo?.location || "";
      const compEmail = companyInfo?.email || "";
      const compPhone = companyInfo?.phone || companyInfo?.contactNumber || "";
      const compGst = companyInfo?.gstin || companyInfo?.gstNumber || companyInfo?.gst || "";

      const custName = selectedCustomerObj?.name || selectedCustomerObj?.customerName || formData.customer || "N/A";
      const custAddress = selectedCustomerObj?.address || selectedCustomerObj?.location || "";
      const custPhone = selectedCustomerObj?.phone || selectedCustomerObj?.contactNumber || "";
      const custEmail = selectedCustomerObj?.email || "";

      // Header Brand bar
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
      doc.text("INWARD PURCHASE ORDER", 196, 16, { align: "right" });

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(14, 26, 196, 26);

      // Metadata & Customer Section
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.setFont("helvetica", "bold");
      doc.text("PURCHASE ORDER DETAILS", 14, 33);
      doc.text("CUSTOMER DETAILS", 110, 33);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      doc.text(`PO Number: ${formData.poNumber || 'N/A'}`, 14, 39);
      doc.text(`Date: ${formData.date || ''}`, 14, 44);
      doc.text(`Status: ${formData.status || 'Received'}`, 14, 49);

      doc.setFont("helvetica", "bold");
      doc.text(custName, 110, 39);

      doc.setFont("helvetica", "normal");
      let custLineY = 44;
      if (custAddress) {
        const splitAddr = doc.splitTextToSize(custAddress, 85);
        doc.text(splitAddr, 110, custLineY);
        custLineY += (splitAddr.length * 4);
      }
      const custContact = [custEmail, custPhone].filter(Boolean).join(" | ");
      if (custContact) {
        doc.text(custContact, 110, Math.min(custLineY, 52));
      }

      const tableStartY = Math.max(56, custLineY + 4);

      // Table Data
      const tableData = (formData.items || []).map((item: any, idx: number) => {
        const prodName = item.productName || "Product";
        const specText = item.description ? `\n${item.description}` : "";
        return [
          idx + 1,
          `${prodName}${specText}`,
          item.quantity || 0,
          item.unit || "PCS",
          `₹${Number(item.rate || 0).toFixed(2)}`,
          `${item.taxRate || 0}%`,
          `₹${Number(item.amount || (item.quantity * item.rate) || 0).toFixed(2)}`
        ];
      });

      autoTable(doc, {
        startY: tableStartY,
        head: [["SI.No", "Product & Description", "Qty", "Unit", "Rate", "Tax Rate", "Total Price"]],
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

      // Clean Summary
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(114, finalY + 6, 82, 44, 1.5, 1.5, "FD");

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);

      doc.text("Items Subtotal:", 118, finalY + 13);
      doc.text(`₹${Number(formData.subtotal || 0).toFixed(2)}`, 190, finalY + 13, { align: "right" });

      doc.text(`Transport (${formData.transportationType || 'Included'}):`, 118, finalY + 19);
      doc.text(`+ ₹${Number(formData.transportationCharges || 0).toFixed(2)}`, 190, finalY + 19, { align: "right" });

      doc.text(`Packaging (${formData.packagingType || 'Standard'}):`, 118, finalY + 25);
      doc.text(`+ ₹${Number(formData.packagingCharges || 0).toFixed(2)}`, 190, finalY + 25, { align: "right" });

      doc.text("Total Tax (GST):", 118, finalY + 31);
      doc.text(`+ ₹${Number(formData.taxAmount || 0).toFixed(2)}`, 190, finalY + 31, { align: "right" });

      if (Number(formData.discount || 0) > 0) {
        doc.text("Discount:", 118, finalY + 36);
        doc.text(`- ₹${Number(formData.discount || 0).toFixed(2)}`, 190, finalY + 36, { align: "right" });
      }

      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("Total Amount:", 118, finalY + 44);
      doc.text(`₹${Number(formData.totalAmount || 0).toFixed(2)}`, 190, finalY + 44, { align: "right" });

      if (formData.remarks) {
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text("REMARKS / TERMS", 14, finalY + 13);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        const splitRemarks = doc.splitTextToSize(formData.remarks, 90);
        doc.text(splitRemarks, 14, finalY + 19);
      }

      doc.save(`Inward_PO_${formData.poNumber || Date.now()}.pdf`);
    } catch (err) {
      console.error("PDF generation error", err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customer) {
      alert("Please select a customer.");
      return;
    }
    if (!formData.poNumber.trim()) {
      alert("Please enter a PO Number.");
      return;
    }
    if (formData.items.some(item => !item.productName.trim() || item.quantity <= 0 || item.rate < 0)) {
      alert("Please ensure all items have a name, quantity > 0, and rate >= 0.");
      return;
    }

    const cleanedItems = formData.items.map(item => {
      const itemCopy: any = { ...item };
      if (!itemCopy.fgItem || itemCopy.fgItem === "") delete itemCopy.fgItem;
      if (!itemCopy.expectedDeliveryDate || itemCopy.expectedDeliveryDate === "") delete itemCopy.expectedDeliveryDate;
      return itemCopy;
    });

    const submitData = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      if (key === 'items') {
        submitData.append('items', JSON.stringify(cleanedItems));
      } else if (key === 'quotationReference' && (!value || value === "")) {
        // Skip empty quotationReference so Mongoose doesn't fail ObjectId cast
      } else {
        submitData.append(key, value as any);
      }
    });

    if (documentFile) {
      const isPdf = documentFile.name.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        submitData.append('pdf', documentFile);
      } else {
        submitData.append('photos', documentFile);
      }
      submitData.append('document', documentFile);
    }

    onSubmit(submitData);
  };

  const customerOptions = useMemo(() => {
    return customers.map(c => ({ value: c._id || c.name || c.id, label: c.name || c.customerName }));
  }, [customers]);

  const fgItemOptions = useMemo(() => {
    return fgItems.map(fg => ({ value: fg._id, label: `${fg.name} ${fg.itemCode ? `(${fg.itemCode})` : ''}` }));
  }, [fgItems]);
  
  const quotationOptions = useMemo(() => {
    return quotations.map(q => ({ value: q._id, label: `${q.quotationNumber} - ${new Date(q.date).toLocaleDateString()}` }));
  }, [quotations]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-gray-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-[96vw] lg:max-w-7xl overflow-hidden flex flex-col my-auto max-h-[95vh] border border-gray-100 dark:border-gray-800">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <FileText size={20} />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
              {isPreview ? 'Inward Purchase Order Summary' : initialData ? 'Edit Customer PO' : 'Create Customer PO'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {isPreview && (
              <button
                type="button"
                onClick={handleDownloadPDFClientSide}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl flex items-center gap-2 shadow-sm transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </button>
            )}
            <button
              onClick={onCancel || onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Informative Read-Only Summary View when isPreview is true */}
        {isPreview ? (
          <div className="overflow-y-auto flex-1 p-6 space-y-6">
            {/* Dedicated Tab Navigation Bar */}
            <div className="flex gap-4 border-b border-gray-200 dark:border-gray-800 pb-2">
              <button
                type="button"
                onClick={() => setPreviewTab("overview")}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                  previewTab === "overview"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                <FileText size={15} />
                <span>PO Overview & Line Items</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab("dispatch")}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                  previewTab === "dispatch"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                <Truck size={15} />
                <span>Dispatch Details & Analytics</span>
                {(deliveryChallans.length > 0 || invoices.length > 0) && (
                  <span className="px-1.5 py-0.5 text-[10px] bg-white/20 rounded-full font-extrabold">
                    {deliveryChallans.length + invoices.length}
                  </span>
                )}
              </button>
            </div>

            {previewTab === "overview" ? (
              <div className="space-y-6">
                {/* Top Summary Banner */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-indigo-950/40 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-base font-bold text-gray-900 dark:text-white">
                        {selectedCustomerObj?.name || selectedCustomerObj?.customerName || formData.customer || "Customer PO"}
                      </h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        formData.status === 'Accepted' || formData.status === 'MRP Done' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' :
                        formData.status === 'Received' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' :
                        'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                      }`}>
                        {formData.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      PO Number: <span className="font-semibold text-gray-700 dark:text-gray-300">{formData.poNumber}</span> | Date: {formData.date}
                    </p>
                  </div>

                  <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-right">
                    <span className="text-[11px] text-gray-500 block">Total Order Amount</span>
                    <span className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">₹ {Number(formData.totalAmount || 0).toFixed(2)}</span>
                  </div>
                </div>

                {/* Customer, Logistics & Packaging Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50/70 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Customer Details</span>
                    <p className="text-xs font-bold text-gray-900 dark:text-white">{selectedCustomerObj?.name || formData.customer}</p>
                    {selectedCustomerObj?.email && <p className="text-xs text-gray-600 dark:text-gray-400">Email: {selectedCustomerObj.email}</p>}
                    {selectedCustomerObj?.phone && <p className="text-xs text-gray-600 dark:text-gray-400">Phone: {selectedCustomerObj.phone}</p>}
                    {selectedCustomerObj?.address && <p className="text-xs text-gray-600 dark:text-gray-400">Address: {selectedCustomerObj.address}</p>}
                  </div>

                  <div className="bg-gray-50/70 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Transportation & Packaging</span>
                    <p className="text-xs text-gray-700 dark:text-gray-300"><span className="font-semibold">Transport:</span> {formData.transportationType} (₹{Number(formData.transportationCharges || 0).toFixed(2)})</p>
                    <p className="text-xs text-gray-700 dark:text-gray-300"><span className="font-semibold">Packaging:</span> {formData.packagingType} (₹{Number(formData.packagingCharges || 0).toFixed(2)})</p>
                    {formData.remarks && <p className="text-xs text-gray-700 dark:text-gray-300 mt-1"><span className="font-semibold">Remarks:</span> {formData.remarks}</p>}
                    {initialData?.pdf && (
                      <a href={initialData.pdf} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 underline font-medium block mt-2">
                        View Attached PDF Document
                      </a>
                    )}
                    {initialData?.photos?.[0] && !initialData?.pdf && (
                      <a href={initialData.photos[0]} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 underline font-medium block mt-2">
                        View Attached Image Document
                      </a>
                    )}
                  </div>
                </div>

                {/* PO Items Summary Table */}
                <div className="bg-white dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
                  <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800 font-bold text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    PO Line Items ({formData.items.length})
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50/50 dark:bg-gray-800/50 text-gray-500 border-b border-gray-100 dark:border-gray-800">
                        <tr>
                          <th className="px-3 py-2 font-semibold">SI.No</th>
                          <th className="px-3 py-2 font-semibold">Product & Description</th>
                          <th className="px-3 py-2 font-semibold text-right">Qty</th>
                          <th className="px-3 py-2 font-semibold">Unit</th>
                          <th className="px-3 py-2 font-semibold text-right">Rate (₹)</th>
                          <th className="px-3 py-2 font-semibold text-right">Tax Rate (%)</th>
                          <th className="px-3 py-2 font-semibold text-right">Total Price (₹)</th>
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
                                  {item.description}
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

                {/* Calculations Breakdown */}
                <div className="flex justify-end">
                  <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-100 dark:border-gray-800 w-full sm:w-80 space-y-2 text-xs">
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>Items Subtotal:</span>
                      <span className="font-semibold text-gray-900 dark:text-white">₹{Number(formData.subtotal || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>Transportation ({formData.transportationType}):</span>
                      <span className="font-semibold text-gray-900 dark:text-white">+ ₹{Number(formData.transportationCharges || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>Packaging ({formData.packagingType}):</span>
                      <span className="font-semibold text-gray-900 dark:text-white">+ ₹{Number(formData.packagingCharges || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>Total Tax (GST):</span>
                      <span className="font-semibold text-gray-900 dark:text-white">+ ₹{Number(formData.taxAmount || 0).toFixed(2)}</span>
                    </div>
                    {Number(formData.discount || 0) > 0 && (
                      <div className="flex justify-between text-gray-600 dark:text-gray-400">
                        <span>Discount:</span>
                        <span className="font-semibold text-gray-900 dark:text-white">- ₹{Number(formData.discount || 0).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between font-bold text-sm">
                      <span className="text-gray-900 dark:text-white">Total Amount:</span>
                      <span className="text-indigo-600 dark:text-indigo-400">₹{Number(formData.totalAmount || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* DEDICATED DISPATCH DETAILS & CHARTS TAB */
              <div className="space-y-6">
                {/* KPI Cards Header */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {(() => {
                    const poItems = initialData?.items || formData.items || [];
                    const totalOrdered = poItems.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0);
                    const totalDispatched = poItems.reduce((sum: number, i: any) => sum + (i.dispatchedQuantity || 0), 0);
                    const remainingAvailable = Math.max(0, totalOrdered - totalDispatched);
                    const overallPercent = Math.min(100, Math.round((totalDispatched / (totalOrdered || 1)) * 100));

                    return (
                      <>
                        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white p-5 rounded-2xl shadow-md space-y-1">
                          <span className="text-xs font-semibold opacity-80 uppercase tracking-wider block">Total Ordered Quantity</span>
                          <span className="text-2xl font-black">{totalOrdered.toLocaleString()} PCS</span>
                          <p className="text-[11px] opacity-75 mt-1">Total items across PO lines</p>
                        </div>

                        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-5 rounded-2xl shadow-md space-y-1">
                          <span className="text-xs font-semibold opacity-80 uppercase tracking-wider block">Total Dispatched Quantity</span>
                          <span className="text-2xl font-black">{totalDispatched.toLocaleString()} PCS</span>
                          <div className="w-full bg-white/30 h-1.5 rounded-full mt-2 overflow-hidden">
                            <div className="h-full bg-white rounded-full" style={{ width: `${overallPercent}%` }} />
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white p-5 rounded-2xl shadow-md space-y-1">
                          <span className="text-xs font-semibold opacity-80 uppercase tracking-wider block">Available Balance</span>
                          <span className="text-2xl font-black">{remainingAvailable.toLocaleString()} PCS</span>
                          <p className="text-[11px] opacity-75 mt-1">{overallPercent}% fulfilled to date</p>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Item-by-Item Dispatch Analytics Chart */}
                <div className="bg-white dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-gray-800 dark:text-gray-200 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      Item-by-Item Dispatch Progress & Completion Status
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {(initialData?.items || formData.items || []).map((item: any, idx: number) => {
                      const ordered = item.quantity || 0;
                      const dispatched = item.dispatchedQuantity || 0;
                      const remaining = Math.max(0, ordered - dispatched);
                      const percent = Math.min(100, Math.round((dispatched / (ordered || 1)) * 100));

                      return (
                        <div key={idx} className="p-4 bg-gray-50/70 dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-800 space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <div className="font-bold text-gray-900 dark:text-white">
                              {idx + 1}. {item.productName || item.name || "Product"}
                            </div>
                            <div className="flex items-center gap-4 text-xs font-semibold">
                              <span className="text-gray-500">Ordered: <strong className="text-gray-900 dark:text-white">{ordered} {item.unit || "PCS"}</strong></span>
                              <span className="text-indigo-600 dark:text-indigo-400">Dispatched: <strong>{dispatched}</strong></span>
                              <span className="text-emerald-600 dark:text-emerald-400">Remaining: <strong>{remaining}</strong></span>
                            </div>
                          </div>

                          {/* Visual Progress Bar */}
                          <div className="w-full bg-gray-200 dark:bg-gray-700 h-2.5 rounded-full overflow-hidden flex">
                            <div className="bg-gradient-to-r from-indigo-600 to-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Delivery Challans Timeline */}
                <div className="bg-white dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-gray-800 dark:text-gray-200 flex items-center gap-2">
                      <Truck className="w-4 h-4 text-amber-500" />
                      Delivery Challans History ({deliveryChallans.length})
                    </h3>
                  </div>

                  {deliveryChallans.length === 0 ? (
                    <p className="text-xs text-gray-400 py-3 text-center">No Delivery Challans generated yet for this Customer PO.</p>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden text-xs">
                      {deliveryChallans.map((dc: any) => (
                        <div key={dc._id} className="p-3.5 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/30">
                          <div>
                            <span className="font-mono font-bold text-gray-900 dark:text-white text-sm">DC #{dc.dcNumber}</span>
                            <span className="text-gray-500 ml-2">({new Date(dc.date).toLocaleDateString("en-IN")})</span>
                            <div className="text-[11px] text-gray-500 mt-1">
                              Items: {(dc.items || []).map((i: any) => `${i.materialName || i.productName} (${i.quantity} ${i.unit || 'PCS'})`).join(", ")}
                            </div>
                          </div>
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                            {dc.status || "Issued"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Invoices Timeline */}
                <div className="bg-white dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-gray-800 dark:text-gray-200 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-500" />
                      Tax Invoices History ({invoices.length})
                    </h3>
                  </div>

                  {invoices.length === 0 ? (
                    <p className="text-xs text-gray-400 py-3 text-center">No Tax Invoices generated yet for this Customer PO.</p>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden text-xs">
                      {invoices.map((inv: any) => (
                        <div key={inv._id} className="p-3.5 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/30">
                          <div>
                            <span className="font-mono font-bold text-gray-900 dark:text-white text-sm">Invoice #{inv.invoiceNumber}</span>
                            <span className="text-gray-500 ml-2">({new Date(inv.date).toLocaleDateString("en-IN")})</span>
                          </div>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                            ₹{(inv.totalAmount || inv.grandTotal || 0).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Editable Form View */
          <div className="overflow-y-auto flex-1 p-6">
            <form id="incoming-po-form" onSubmit={handleSubmit} className="space-y-6">
              {/* Header Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Customer *</label>
                  <div className="relative">
                    <SearchableSelect
                      options={customerOptions}
                      value={formData.customer}
                      onChange={(val: string) => setFormData(prev => ({ ...prev, customer: val }))}
                      placeholder="Select Customer"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">PO Number *</label>
                  <input
                    type="text"
                    name="poNumber"
                    value={formData.poNumber}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all dark:text-white"
                    placeholder="e.g. PO-2023-001"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Date *</label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all dark:text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Ref. Quotation (Optional)</label>
                  <SearchableSelect
                    options={quotationOptions}
                    value={formData.quotationReference}
                    onChange={(val: string) => setFormData(prev => ({ ...prev, quotationReference: val }))}
                    placeholder="Select Quotation"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all dark:text-white"
                  >
                    <option value="Received">Received</option>
                    <option value="Accepted">Accepted</option>
                    <option value="MRP Done">MRP Done</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Transportation & Packaging Optional Fields Grid */}
              <div className="bg-gray-50/70 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  <Truck className="w-4 h-4 text-indigo-500" />
                  <span>Transportation & Packaging Charges (Optional)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Transport Type</label>
                    <input
                      type="text"
                      name="transportationType"
                      value={formData.transportationType}
                      onChange={handleChange}
                      placeholder="e.g. By Road, Express"
                      className="w-full px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Transport Charges (₹)</label>
                    <input
                      type="number"
                      name="transportationCharges"
                      min="0"
                      value={formData.transportationCharges === 0 ? "" : formData.transportationCharges}
                      onChange={handleChange}
                      placeholder="0.00"
                      className="w-full px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Packaging Type</label>
                    <input
                      type="text"
                      name="packagingType"
                      value={formData.packagingType}
                      onChange={handleChange}
                      placeholder="e.g. Wooden Box, Standard"
                      className="w-full px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Packaging Charges (₹)</label>
                    <input
                      type="number"
                      name="packagingCharges"
                      min="0"
                      value={formData.packagingCharges === 0 ? "" : formData.packagingCharges}
                      onChange={handleChange}
                      placeholder="0.00"
                      className="w-full px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-800">
                  <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-indigo-500 rounded-full"></div>
                    PO Items
                  </h3>
                  <button
                    type="button"
                    onClick={addItem}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                  >
                    <Plus size={16} /> Add Item
                  </button>
                </div>

                <div className="space-y-4">
                  {formData.items.map((item, index) => (
                    <div key={index} className="p-4 bg-gray-50/50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700/50 rounded-xl relative group">
                      {formData.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="absolute -top-2 -right-2 p-1.5 bg-red-100 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200 shadow-sm"
                        >
                          <X size={14} />
                        </button>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        {/* Item Type & Selection */}
                        <div className="md:col-span-3 space-y-3">
                          <div className="flex gap-2 p-1 bg-gray-200/50 dark:bg-gray-700/50 rounded-lg">
                            <button
                              type="button"
                              onClick={() => handleItemChange(index, "itemType", "Master")}
                              className={`flex-1 py-1 text-xs font-medium rounded-md transition-all ${item.itemType === "Master" ? "bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}
                            >
                              FG Item
                            </button>
                            <button
                              type="button"
                              onClick={() => handleItemChange(index, "itemType", "Custom")}
                              className={`flex-1 py-1 text-xs font-medium rounded-md transition-all ${item.itemType === "Custom" ? "bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}
                            >
                              Custom
                            </button>
                          </div>
                          
                          {item.itemType === "Master" ? (
                            <SearchableSelect
                              options={fgItemOptions}
                              value={item.fgItem}
                              onChange={(val: string) => handleItemChange(index, "fgItem", val)}
                              placeholder="Select FG Item"
                            />
                          ) : (
                            <input
                              type="text"
                              value={item.productName}
                              onChange={(e) => handleItemChange(index, "productName", e.target.value)}
                              placeholder="Product Name"
                              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all dark:text-white"
                            />
                          )}
                        </div>

                        {/* Description & Date */}
                        <div className="md:col-span-3 space-y-3">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleItemChange(index, "description", e.target.value)}
                            placeholder="Description (Optional)"
                            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all dark:text-white h-[38px]"
                          />
                          <div className="flex items-center gap-2">
                             <span className="text-xs text-gray-500 whitespace-nowrap">Target Date:</span>
                             <input
                              type="date"
                              value={item.expectedDeliveryDate}
                              onChange={(e) => handleItemChange(index, "expectedDeliveryDate", e.target.value)}
                              className="w-full px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 transition-all dark:text-white"
                            />
                          </div>
                        </div>

                        {/* Quantity & Unit */}
                        <div className="md:col-span-2 flex gap-2">
                          <div className="flex-1">
                            <label className="text-[10px] uppercase font-semibold text-gray-500 block mb-1">Qty</label>
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={item.quantity || ""}
                              onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all dark:text-white"
                            />
                          </div>
                          <div className="w-16">
                            <label className="text-[10px] uppercase font-semibold text-gray-500 block mb-1">Unit</label>
                            <input
                              type="text"
                              value={item.unit}
                              onChange={(e) => handleItemChange(index, "unit", e.target.value)}
                              className="w-full px-2 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all dark:text-white text-center"
                            />
                          </div>
                        </div>

                        {/* Financials (Rate, Tax, Amount) */}
                        <div className="md:col-span-4 flex gap-2">
                           <div className="flex-1">
                            <label className="text-[10px] uppercase font-semibold text-gray-500 block mb-1">Rate</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.rate === 0 ? "" : item.rate}
                              onChange={(e) => handleItemChange(index, "rate", e.target.value)}
                              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all dark:text-white"
                            />
                          </div>
                          <div className="w-16">
                            <label className="text-[10px] uppercase font-semibold text-gray-500 block mb-1">Tax %</label>
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={item.taxRate === 0 ? "" : item.taxRate}
                              onChange={(e) => handleItemChange(index, "taxRate", e.target.value)}
                              className="w-full px-2 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all dark:text-white text-center"
                            />
                          </div>
                          <div className="flex-1">
                             <label className="text-[10px] uppercase font-semibold text-gray-500 block mb-1">Amount</label>
                             <div className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center justify-between">
                                <span>₹</span>
                                <span>{item.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                             </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals & Single Document Upload Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4 border-t border-gray-100 dark:border-gray-800">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Remarks / Terms</label>
                      <textarea
                        name="remarks"
                        value={formData.remarks}
                        onChange={handleChange}
                        rows={2}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all dark:text-white resize-none"
                        placeholder="Any special terms or conditions..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Transportation Method</label>
                      <input
                        type="text"
                        name="transportationMethod"
                        value={formData.transportationMethod}
                        onChange={handleChange}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all dark:text-white"
                        placeholder="e.g. By Road, Courier, etc."
                      />
                    </div>
                  </div>
                  
                  {/* Single Document Upload Field (PDF & JPG Only) */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Upload Document (PDF or JPG)</label>
                    <input
                      type="file"
                      accept=".pdf, .jpg, .jpeg, .png, image/jpeg, image/png"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          const ext = file.name.split('.').pop()?.toLowerCase();
                          if (['pdf', 'jpg', 'jpeg', 'png'].includes(ext || '')) {
                            setDocumentFile(file);
                          } else {
                            alert("Only PDF and JPG/JPEG/PNG files are allowed.");
                            e.target.value = "";
                          }
                        }
                      }}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm transition-all dark:text-gray-300 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-medium file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"
                    />
                    {documentFile && (
                      <p className="text-xs text-emerald-600 font-semibold mt-1">Selected Document: {documentFile.name}</p>
                    )}
                    {initialData?.pdf && !documentFile && (
                      <a href={initialData.pdf} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 underline mt-1 block font-medium">
                        View Attached PDF Document
                      </a>
                    )}
                    {initialData?.photos?.[0] && !documentFile && !initialData?.pdf && (
                      <a href={initialData.photos[0]} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 underline mt-1 block font-medium">
                        View Attached Image Document
                      </a>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/30 p-6 rounded-2xl border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-4 text-gray-800 dark:text-gray-200 font-semibold">
                     <Calculator size={18} className="text-indigo-500"/>
                     <h3>Order Summary</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                      <span>Subtotal</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">₹{formData.subtotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                      <span>Transportation ({formData.transportationType || 'Road'})</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">+ ₹{Number(formData.transportationCharges || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                      <span>Packaging ({formData.packagingType || 'Standard'})</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">+ ₹{Number(formData.packagingCharges || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 items-center">
                      <span>Discount</span>
                      <div className="flex items-center gap-1 w-32">
                        <span className="text-gray-500">₹</span>
                        <input
                          type="number"
                          name="discount"
                          min="0"
                          value={formData.discount === 0 ? "" : formData.discount}
                          onChange={handleChange}
                          className="w-full px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-right text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all dark:text-white"
                        />
                      </div>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                      <span>Total Tax</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">₹{formData.taxAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between">
                      <span className="text-base font-bold text-gray-900 dark:text-white">Total Amount</span>
                      <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                        ₹{formData.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-end gap-3 sticky bottom-0 z-10">
          <button
            type="button"
            onClick={onCancel || onClose}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-800"
          >
            {isPreview ? 'Close' : 'Cancel'}
          </button>
          
          {!isPreview && (
            <button
              type="submit"
              form="incoming-po-form"
              disabled={isSubmitting}
              className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 transition-all focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900 disabled:opacity-70 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Customer PO'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
