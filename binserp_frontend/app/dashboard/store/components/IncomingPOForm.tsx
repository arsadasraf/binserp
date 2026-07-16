import React, { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, X, Search, FileText, Download, Calculator } from "lucide-react";
import SearchableSelect from "./SearchableSelect";
import { generateDocument } from "@/src/utils/documentHelper";
import { API_BASE_URL } from "@/src/utils/config";

interface IncomingPOFormProps {
  initialData?: any;
  fgItems: any[];
  customers?: any[];
  quotations?: any[];
  companyInfo?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  isPreview?: boolean;
}

export const IncomingPOForm: React.FC<IncomingPOFormProps> = ({ 
  initialData, 
  fgItems, 
  customers = [], 
  quotations = [],
  companyInfo, 
  onSubmit, 
  onCancel, 
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
    taxAmount: 0,
    totalAmount: 0,
    status: "Received",
    remarks: "",
  });

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);

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
        taxAmount: initialData.taxAmount || 0,
        totalAmount: initialData.totalAmount || 0,
        status: initialData.status || "Received",
        remarks: initialData.remarks || "",
      });
    }
  }, [initialData]);

  // Recalculate totals whenever items or discount changes
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

    const newTotalAmount = newSubtotal + newTaxAmount - (formData.discount || 0);

    // Only update if values actually changed to prevent infinite loops
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
  }, [formData.items, formData.discount]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === "discount" ? Number(value) : value }));
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
        if (selectedFg) {
          item.productName = selectedFg.name;
          item.description = selectedFg.description || "";
          item.unit = selectedFg.unit || "PCS";
        }
      } else if (field === "quantity" || field === "rate" || field === "taxRate") {
        item[field] = Number(value);
      } else {
        item[field] = value;
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

    const submitData = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      if (key === 'items') {
        submitData.append('items', JSON.stringify(value));
      } else {
        submitData.append(key, value as any);
      }
    });

    if (pdfFile) {
      submitData.append('pdf', pdfFile);
    }
    if (photoFiles.length > 0) {
      photoFiles.forEach(file => {
        submitData.append('photos', file);
      });
    }

    // In case of editing, append existing photos info if needed (assuming backend handles it or we send existingPhotos stringified)
    if (initialData?.photos && photoFiles.length === 0) {
       submitData.append('existingPhotos', JSON.stringify(initialData.photos));
    }

    onSubmit(submitData);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      if (filesArray.length > 3) {
        alert("Maximum 3 photos allowed.");
        setPhotoFiles(filesArray.slice(0, 3));
      } else {
        setPhotoFiles(filesArray);
      }
    }
  };

  const customerOptions = useMemo(() => {
    return customers.map(c => ({ value: c._id, label: c.name }));
  }, [customers]);

  const fgItemOptions = useMemo(() => {
    return fgItems.map(fg => ({ value: fg._id, label: `${fg.name} ${fg.itemCode ? `(${fg.itemCode})` : ''}` }));
  }, [fgItems]);
  
  const quotationOptions = useMemo(() => {
    return quotations.map(q => ({ value: q._id, label: `${q.quotationNumber} - ${new Date(q.date).toLocaleDateString()}` }));
  }, [quotations]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm sm:p-6 overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <FileText size={20} />
            </div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
              {isPreview ? 'View Customer PO' : initialData ? 'Edit Customer PO' : 'Create Customer PO'}
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          <form id="incoming-po-form" onSubmit={handleSubmit} className="space-y-8">
            {/* Header Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Customer *</label>
                <div className="relative">
                  <SearchableSelect
                    options={customerOptions}
                    value={formData.customer}
                    onChange={(val) => setFormData(prev => ({ ...prev, customer: val }))}
                    placeholder="Select Customer"
                    disabled={isPreview}
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
                  required
                  disabled={isPreview}
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
                  required
                  disabled={isPreview}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Ref. Quotation (Optional)</label>
                <SearchableSelect
                  options={quotationOptions}
                  value={formData.quotationReference}
                  onChange={(val) => setFormData(prev => ({ ...prev, quotationReference: val }))}
                  placeholder="Select Quotation"
                  disabled={isPreview}
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
                  <option value="Sales Order Generated">Sales Order Generated</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-indigo-500 rounded-full"></div>
                  PO Items
                </h3>
                {!isPreview && (
                  <button
                    type="button"
                    onClick={addItem}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                  >
                    <Plus size={16} /> Add Item
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {formData.items.map((item, index) => (
                  <div key={index} className="p-4 bg-gray-50/50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700/50 rounded-xl relative group">
                    {!isPreview && formData.items.length > 1 && (
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
                            onClick={() => !isPreview && handleItemChange(index, "itemType", "Master")}
                            className={`flex-1 py-1 text-xs font-medium rounded-md transition-all ${item.itemType === "Master" ? "bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}
                            disabled={isPreview}
                          >
                            FG Item
                          </button>
                          <button
                            type="button"
                            onClick={() => !isPreview && handleItemChange(index, "itemType", "Custom")}
                            className={`flex-1 py-1 text-xs font-medium rounded-md transition-all ${item.itemType === "Custom" ? "bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}
                            disabled={isPreview}
                          >
                            Custom
                          </button>
                        </div>
                        
                        {item.itemType === "Master" ? (
                          <SearchableSelect
                            options={fgItemOptions}
                            value={item.fgItem}
                            onChange={(val) => handleItemChange(index, "fgItem", val)}
                            placeholder="Select FG Item"
                            disabled={isPreview}
                          />
                        ) : (
                          <input
                            type="text"
                            value={item.productName}
                            onChange={(e) => handleItemChange(index, "productName", e.target.value)}
                            placeholder="Product Name"
                            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all dark:text-white"
                            disabled={isPreview}
                            required
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
                          disabled={isPreview}
                        />
                        <div className="flex items-center gap-2">
                           <span className="text-xs text-gray-500 whitespace-nowrap">Target Date:</span>
                           <input
                            type="date"
                            value={item.expectedDeliveryDate}
                            onChange={(e) => handleItemChange(index, "expectedDeliveryDate", e.target.value)}
                            className="w-full px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 transition-all dark:text-white"
                            disabled={isPreview}
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
                            disabled={isPreview}
                            required
                          />
                        </div>
                        <div className="w-16">
                          <label className="text-[10px] uppercase font-semibold text-gray-500 block mb-1">Unit</label>
                          <input
                            type="text"
                            value={item.unit}
                            onChange={(e) => handleItemChange(index, "unit", e.target.value)}
                            className="w-full px-2 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all dark:text-white text-center"
                            disabled={isPreview}
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
                            disabled={isPreview}
                            required
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
                            disabled={isPreview}
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

            {/* Totals & Remarks Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4 border-t border-gray-100 dark:border-gray-800">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Remarks / Terms</label>
                  <textarea
                    name="remarks"
                    value={formData.remarks}
                    onChange={handleChange}
                    rows={2}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all dark:text-white resize-none"
                    placeholder="Any special terms or conditions..."
                    disabled={isPreview}
                  />
                </div>
                
                {/* File Uploads */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Upload PDF</label>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => e.target.files && setPdfFile(e.target.files[0])}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm transition-all dark:text-gray-300 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-medium file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"
                      disabled={isPreview}
                    />
                    {initialData?.pdf && !pdfFile && (
                       <a href={initialData.pdf} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 underline mt-1 block">View Existing PDF</a>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Upload Photos (Max 3)</label>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoUpload}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm transition-all dark:text-gray-300 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-medium file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"
                      disabled={isPreview}
                    />
                     {initialData?.photos?.length > 0 && photoFiles.length === 0 && (
                       <div className="flex gap-2 mt-2">
                         {initialData.photos.map((url: string, i: number) => (
                           <a key={i} href={url} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 underline">Photo {i+1}</a>
                         ))}
                       </div>
                    )}
                  </div>
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
                        disabled={isPreview}
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

        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-end gap-3 sticky bottom-0 z-10">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-800"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            form="incoming-po-form"
            disabled={isSubmitting}
            className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 transition-all focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900 disabled:opacity-70 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {isPreview ? 'Updating...' : 'Saving...'}
              </>
            ) : (
              isPreview ? 'Update Status' : 'Save Customer PO'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
