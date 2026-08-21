import React, { useState, useEffect, useMemo } from "react";
import { 
  Plus, Trash2, X, FileText, Calculator, 
  Package, ShoppingCart, Calendar, CheckCircle2, FileUp, Tag
} from "lucide-react";
import SearchableSelect from "./SearchableSelect";

interface SalesOrderFormProps {
  isOpen?: boolean;
  initialData?: any;
  fgItems: any[];
  customers?: any[];
  priceLists?: any[];
  companyInfo?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  onClose?: () => void;
  isSubmitting?: boolean;
}

export const SalesOrderForm: React.FC<SalesOrderFormProps> = ({ 
  isOpen,
  initialData, 
  fgItems = [], 
  customers = [], 
  priceLists = [],
  companyInfo, 
  onSubmit, 
  onCancel, 
  onClose,
  isSubmitting,
}) => {
  const [formData, setFormData] = useState({
    orderNumber: "",
    orderType: "DIRECT",
    poReference: "",
    customer: "",
    targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    items: [
      {
        itemType: "Master",
        fgItem: "",
        productName: "",
        description: "",
        quantity: 1,
        unit: "PCS",
        rate: 0,
        amount: 0,
        taxRate: 0,
        taxAmount: 0,
        targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
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
    status: "Pending",
    remarks: "",
  });

  const [documentFile, setDocumentFile] = useState<File | null>(null);

  useEffect(() => {
    if (initialData) {
      const formattedItems = initialData.items?.length > 0 ? initialData.items.map((i: any) => ({
        itemType: i.fgItem ? "Master" : "Custom",
        fgItem: typeof i.fgItem === "object" ? i.fgItem?._id : i.fgItem || "",
        productName: i.productName || i.name || "",
        description: i.description || "",
        quantity: i.quantity || 1,
        unit: i.unit || "PCS",
        rate: i.pricePerQuantity || i.rate || 0,
        amount: i.totalPrice || i.amount || 0,
        taxRate: i.taxRate || 0,
        taxAmount: i.taxAmount || 0,
        targetDate: i.targetDate ? new Date(i.targetDate).toISOString().split("T")[0] : "",
      })) : [];

      setFormData({
        orderNumber: initialData.orderNumber || "",
        orderType: initialData.orderType || (initialData.poReference ? "PO_BASED" : "DIRECT"),
        poReference: initialData.poReference || "",
        customer: typeof initialData.customer === "object" ? initialData.customer?._id : initialData.customer || "",
        targetDate: initialData.targetDate ? new Date(initialData.targetDate).toISOString().split("T")[0] : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        items: formattedItems.length > 0 ? formattedItems : [{
          itemType: "Master", fgItem: "", productName: "", description: "", quantity: 1, unit: "PCS", rate: 0, amount: 0, taxRate: 0, taxAmount: 0, targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
        }],
        subtotal: initialData.subtotal || 0,
        discount: initialData.discount || 0,
        transportationType: initialData.transportationType || "Road Transport",
        transportationCharges: initialData.transportationCharges || 0,
        packagingType: initialData.packagingType || "Standard Packaging",
        packagingCharges: initialData.packagingCharges || 0,
        taxAmount: initialData.taxAmount || 0,
        totalAmount: initialData.totalAmount || 0,
        status: initialData.status || "Pending",
        remarks: initialData.remarks || "",
      });
    }
  }, [initialData]);

  // Recalculate totals dynamically
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

    const newTotalAmount = newSubtotal + newTaxAmount - Number(formData.discount || 0);

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
    setFormData(prev => ({
      ...prev,
      [name]: name === "discount" ? Number(value) : value
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
        { 
          itemType: "Master", 
          fgItem: "", 
          productName: "", 
          description: "", 
          quantity: 1, 
          unit: "PCS", 
          rate: 0, 
          amount: 0, 
          taxRate: 0, 
          taxAmount: 0, 
          targetDate: prev.targetDate 
        }
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
    if (formData.items.some(item => !item.productName.trim() || item.quantity <= 0 || item.rate < 0)) {
      alert("Please ensure all items have a valid Product Name, quantity > 0, and rate >= 0.");
      return;
    }

    const cleanedItems = formData.items.map(item => {
      const itemCopy: any = {
        fgItem: item.fgItem || undefined,
        name: item.productName,
        productName: item.productName,
        description: item.description,
        quantity: Number(item.quantity || 1),
        pricePerQuantity: Number(item.rate || 0),
        rate: Number(item.rate || 0),
        totalPrice: Number(item.amount || 0),
        amount: Number(item.amount || 0),
        taxRate: Number(item.taxRate || 0),
        targetDate: item.targetDate || formData.targetDate
      };
      if (!itemCopy.fgItem) delete itemCopy.fgItem;
      if (!itemCopy.targetDate) delete itemCopy.targetDate;
      return itemCopy;
    });

    const submitData = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      if (key === 'items') {
        submitData.append('items', JSON.stringify(cleanedItems));
      } else if ((key === 'customer' || key === 'poReference') && (!value || value === "")) {
        // Omit empty optional fields
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

  const fgItemOptions = useMemo(() => {
    return fgItems.map(fg => ({ value: fg._id, label: `${fg.name} ${fg.itemCode ? `(${fg.itemCode})` : ''}` }));
  }, [fgItems]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-md overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-[96vw] lg:max-w-7xl overflow-hidden flex flex-col my-auto max-h-[92vh] border border-slate-200/80 dark:border-slate-800">
        
        {/* Compact Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-slate-50 via-blue-50/40 to-slate-50 dark:from-slate-900 dark:via-slate-800/60 dark:to-slate-900 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/20">
              <ShoppingCart size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {initialData ? 'Edit Sales Order' : 'Create Internal Sales Order'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Product Entry
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Internal Sales Order & Product Rate Summary
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Target Delivery Date:</span>
              <input
                type="date"
                name="targetDate"
                value={formData.targetDate}
                onChange={handleChange}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white"
              />
            </div>
            <button
              onClick={onCancel || onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          <form id="sales-order-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Product Line Items */}
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  Product Entry Line Items ({formData.items.length})
                </h3>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800/80 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors shadow-sm"
                >
                  <Plus size={16} /> Add Product Row
                </button>
              </div>

              <div className="space-y-4">
                {formData.items.map((item, index) => (
                  <div key={index} className="p-4 bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-2xl relative group shadow-sm hover:border-blue-300 dark:hover:border-blue-800 transition-all">
                    {formData.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="absolute -top-2.5 -right-2.5 p-1.5 bg-red-100 text-red-600 dark:bg-red-900/80 dark:text-red-300 rounded-full opacity-90 hover:opacity-100 transition-opacity hover:bg-red-200 shadow-md border border-red-200 dark:border-red-800"
                        title="Remove product line"
                      >
                        <X size={14} />
                      </button>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      {/* Product Type & Dropdown */}
                      <div className="md:col-span-4 space-y-2">
                        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/50 dark:border-slate-700">
                          <button
                            type="button"
                            onClick={() => handleItemChange(index, "itemType", "Master")}
                            className={`flex-1 py-1 text-xs font-medium rounded-lg transition-all ${item.itemType === "Master" ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-300 font-bold" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
                          >
                            FG Catalog Item
                          </button>
                          <button
                            type="button"
                            onClick={() => handleItemChange(index, "itemType", "Custom")}
                            className={`flex-1 py-1 text-xs font-medium rounded-lg transition-all ${item.itemType === "Custom" ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-300 font-bold" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
                          >
                            Custom Product
                          </button>
                        </div>
                        
                        {item.itemType === "Master" ? (
                          <SearchableSelect
                            options={fgItemOptions}
                            value={item.fgItem}
                            onChange={(val: string) => handleItemChange(index, "fgItem", val)}
                            placeholder="Select Finished Good"
                          />
                        ) : (
                          <input
                            type="text"
                            value={item.productName}
                            onChange={(e) => handleItemChange(index, "productName", e.target.value)}
                            placeholder="Custom Product Name *"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white"
                          />
                        )}
                      </div>

                      {/* Item Description & Target Date */}
                      <div className="md:col-span-3 space-y-2">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleItemChange(index, "description", e.target.value)}
                          placeholder="Specification / Specs (Optional)"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white"
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">Target Date:</span>
                          <input
                            type="date"
                            value={item.targetDate}
                            onChange={(e) => handleItemChange(index, "targetDate", e.target.value)}
                            className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20 transition-all dark:text-white"
                          />
                        </div>
                      </div>

                      {/* Quantity & Unit */}
                      <div className="md:col-span-2 flex gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Qty</label>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={item.quantity || ""}
                            onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white font-medium"
                          />
                        </div>
                        <div className="w-16">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Unit</label>
                          <input
                            type="text"
                            value={item.unit}
                            onChange={(e) => handleItemChange(index, "unit", e.target.value)}
                            className="w-full px-2 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white text-center uppercase"
                          />
                        </div>
                      </div>

                      {/* Financials (Unit Price, Tax %, Total Amount) */}
                      <div className="md:col-span-3 flex gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Unit Price (₹)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.rate === 0 ? "" : item.rate}
                            onChange={(e) => handleItemChange(index, "rate", e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white font-medium"
                          />
                        </div>
                        <div className="w-16">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">GST %</label>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={item.taxRate === 0 ? "" : item.taxRate}
                            onChange={(e) => handleItemChange(index, "taxRate", e.target.value)}
                            className="w-full px-2 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white text-center font-medium"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Line Amount</label>
                          <div className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                            <span className="text-slate-400 text-xs">₹</span>
                            <span>{item.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Section: Notes & Attachment (Left) + Clean Price Summary (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-4 border-t border-slate-200 dark:border-slate-800">
              
              {/* Left Column: Remarks & File Upload */}
              <div className="lg:col-span-7 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Order Notes & Remarks</label>
                  <textarea
                    name="remarks"
                    value={formData.remarks}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white resize-none"
                    placeholder="Add internal notes, production instructions, or reference tags..."
                  />
                </div>
                
                {/* Document Upload */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    <FileUp className="w-4 h-4 text-blue-600" />
                    <span>Attach Optional Reference Document (PDF / Image)</span>
                  </div>
                  <input
                    type="file"
                    accept=".pdf, .jpg, .jpeg, .png"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        const file = e.target.files[0];
                        const ext = file.name.split('.').pop()?.toLowerCase();
                        if (['pdf', 'jpg', 'jpeg', 'png'].includes(ext || '')) {
                          setDocumentFile(file);
                        } else {
                          alert("Only PDF and image (JPG/PNG) files are allowed.");
                          e.target.value = "";
                        }
                      }
                    }}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs transition-all dark:text-slate-300 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100"
                  />
                  {documentFile && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 size={14} /> Attached: {documentFile.name}
                    </p>
                  )}
                  {initialData?.pdf && !documentFile && (
                    <a href={initialData.pdf} target="_blank" rel="noreferrer" className="text-xs text-blue-600 dark:text-blue-400 underline font-medium block">
                      View Existing PDF Attachment
                    </a>
                  )}
                </div>
              </div>

              {/* Right Column: Clean Price Summary Card */}
              <div className="lg:col-span-5 bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-800/60 dark:to-slate-900/80 p-6 rounded-3xl border border-slate-200 dark:border-slate-700/80 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4 text-slate-900 dark:text-white font-bold">
                    <Calculator size={20} className="text-blue-600"/>
                    <h3 className="text-base tracking-tight">Order Price Summary</h3>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                      <span>Items Subtotal</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        ₹{formData.subtotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </span>
                    </div>

                    <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400 items-center">
                      <span>Discount</span>
                      <div className="flex items-center gap-1 w-32">
                        <span className="text-slate-400 text-xs">₹</span>
                        <input
                          type="number"
                          name="discount"
                          min="0"
                          value={formData.discount === 0 ? "" : formData.discount}
                          onChange={handleChange}
                          className="w-full px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-right text-sm font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                      <span>Calculated Tax (GST)</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        ₹{formData.taxAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-6 border-t border-slate-200/80 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">Total Net Amount</span>
                    <span className="text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tight">
                      ₹{formData.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex justify-end gap-3 sticky bottom-0 z-20 backdrop-blur-sm">
          <button
            type="button"
            onClick={onCancel || onClose}
            className="px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            form="sales-order-form"
            disabled={isSubmitting}
            className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-2xl shadow-lg shadow-blue-500/25 transition-all focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900 disabled:opacity-70 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving Sales Order...
              </>
            ) : (
              <>
                <CheckCircle2 size={18} />
                Save Sales Order
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
