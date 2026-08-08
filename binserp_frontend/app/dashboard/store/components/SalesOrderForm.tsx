import React, { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, X, Search, FileText, Download, Calculator, Building2, Truck, Package, ShoppingCart } from "lucide-react";
import SearchableSelect from "./SearchableSelect";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

  // Recalculate totals
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

  const customerOptions = useMemo(() => {
    return [
      { value: "", label: "-- None (Internal Stock Production) --" },
      ...customers.map(c => ({ value: c._id || c.name || c.id, label: `${c.name || c.customerName} ${c.code ? `(${c.code})` : ''}` }))
    ];
  }, [customers]);

  const fgItemOptions = useMemo(() => {
    return fgItems.map(fg => ({ value: fg._id, label: `${fg.name} ${fg.itemCode ? `(${fg.itemCode})` : ''}` }));
  }, [fgItems]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-gray-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-[96vw] lg:max-w-7xl overflow-hidden flex flex-col my-auto max-h-[95vh] border border-gray-100 dark:border-gray-800">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
              <ShoppingCart size={20} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                {initialData ? 'Edit Sales Order' : 'Create Sales Order'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {formData.customer ? 'Customer Direct Order' : 'Direct / Internal Stock Order'}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel || onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form View */}
        <div className="overflow-y-auto flex-1 p-6">
          <form id="sales-order-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Header Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Customer <span className="text-xs font-normal text-gray-500">(Optional)</span>
                </label>
                <SearchableSelect
                  options={customerOptions}
                  value={formData.customer}
                  onChange={(val: string) => setFormData(prev => ({ ...prev, customer: val }))}
                  placeholder="Select Customer or Leave Blank"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  PO Reference <span className="text-xs font-normal text-gray-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  name="poReference"
                  value={formData.poReference}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white"
                  placeholder="e.g. CUST-PO-991"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Target Delivery Date *</label>
                <input
                  type="date"
                  name="targetDate"
                  value={formData.targetDate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white"
                >
                  <option value="Pending">Pending</option>
                  <option value="In-Progress">In-Progress</option>
                  <option value="Partially Dispatched">Partially Dispatched</option>
                  <option value="Dispatched">Dispatched</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Transportation & Packaging Optional Fields Grid */}
            <div className="bg-gray-50/70 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                <Truck className="w-4 h-4 text-blue-500" />
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

            {/* Line Items */}
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-blue-500 rounded-full"></div>
                  Finished Goods Line Items ({formData.items.length})
                </h3>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                >
                  <Plus size={16} /> Add FG Item
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
                            FG Master
                          </button>
                          <button
                            type="button"
                            onClick={() => handleItemChange(index, "itemType", "Custom")}
                            className={`flex-1 py-1 text-xs font-medium rounded-md transition-all ${item.itemType === "Custom" ? "bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}
                          >
                            Custom FG
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
                            placeholder="Product / FG Name"
                            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white"
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
                          className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white h-[38px]"
                        />
                        <div className="flex items-center gap-2">
                           <span className="text-xs text-gray-500 whitespace-nowrap">Target Date:</span>
                           <input
                            type="date"
                            value={item.targetDate}
                            onChange={(e) => handleItemChange(index, "targetDate", e.target.value)}
                            className="w-full px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20 transition-all dark:text-white"
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
                            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white"
                          />
                        </div>
                        <div className="w-16">
                          <label className="text-[10px] uppercase font-semibold text-gray-500 block mb-1">Unit</label>
                          <input
                            type="text"
                            value={item.unit}
                            onChange={(e) => handleItemChange(index, "unit", e.target.value)}
                            className="w-full px-2 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white text-center"
                          />
                        </div>
                      </div>

                      {/* Financials (Rate, Tax, Amount) */}
                      <div className="md:col-span-4 flex gap-2">
                         <div className="flex-1">
                          <label className="text-[10px] uppercase font-semibold text-gray-500 block mb-1">Rate (₹)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.rate === 0 ? "" : item.rate}
                            onChange={(e) => handleItemChange(index, "rate", e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white"
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
                            className="w-full px-2 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white text-center"
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
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Remarks / Order Instructions</label>
                  <textarea
                    name="remarks"
                    value={formData.remarks}
                    onChange={handleChange}
                    rows={2}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white resize-none"
                    placeholder="Production instructions, special terms..."
                  />
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
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm transition-all dark:text-gray-300 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100"
                  />
                  {documentFile && (
                    <p className="text-xs text-emerald-600 font-semibold mt-1">Selected Document: {documentFile.name}</p>
                  )}
                  {initialData?.pdf && !documentFile && (
                    <a href={initialData.pdf} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline mt-1 block font-medium">
                      View Attached PDF Document
                    </a>
                  )}
                  {initialData?.photos?.[0] && !documentFile && !initialData?.pdf && (
                    <a href={initialData.photos[0]} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline mt-1 block font-medium">
                      View Attached Image Document
                    </a>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/30 p-6 rounded-2xl border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-4 text-gray-800 dark:text-gray-200 font-semibold">
                   <Calculator size={18} className="text-blue-500"/>
                   <h3>Order Financial Summary</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>Items Subtotal</span>
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
                        className="w-full px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-right text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>Total Tax</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">₹{formData.taxAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
                  <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between">
                    <span className="text-base font-bold text-gray-900 dark:text-white">Total Amount</span>
                    <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                      ₹{formData.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-end gap-3 sticky bottom-0 z-10">
          <button
            type="button"
            onClick={onCancel || onClose}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-800"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            form="sales-order-form"
            disabled={isSubmitting}
            className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-blue-900/20 transition-all focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900 disabled:opacity-70 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              'Save Sales Order'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
