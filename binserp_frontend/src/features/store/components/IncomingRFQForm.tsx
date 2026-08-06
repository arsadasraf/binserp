import React, { useState, useEffect } from "react";
import { Plus, Trash2, X, Search, FileText, Download } from "lucide-react";
import Swal from "sweetalert2";
import SearchableSelect from "./SearchableSelect";
import { generateDocument } from "@/src/utils/documentHelper";
import { API_BASE_URL } from "@/src/utils/config";

interface IncomingRFQFormProps {
  initialData?: any;
  fgItems: any[];
  customers?: any[];
  companyInfo?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  isPreview?: boolean;
}

export const IncomingRFQForm: React.FC<IncomingRFQFormProps> = ({ initialData, fgItems, customers = [], companyInfo, onSubmit, onCancel, isSubmitting, isPreview }) => {
  const [customerType, setCustomerType] = useState<"master" | "custom">("master");
  const [prefix, setPrefix] = useState("RFQ");

  const generateRfqNumber = (currentPrefix: string) => {
    const currentYear = new Date().getFullYear();
    // Use a random or temporary sequence if count is not available in frontend,
    // or just let backend generate the actual number on submit.
    // However, since backend uses sequence, we can show a placeholder.
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
    } else {
      setFormData(prev => ({ ...prev, rfqNumber: generateRfqNumber(prefix) }));
    }
  }, [initialData, fgItems, customers, prefix]);

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
          setPrefix(data.settings.incomingRfqPrefix);
        }
      } catch (error) {
        console.error("Failed to fetch prefix settings", error);
      }
    };
    if (!initialData) fetchPrefix();
  }, [initialData]);

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    (newItems[index] as any)[field] = value;
    
    // Clear the other field if itemType changes
    if (field === "itemType") {
      if (value === "Custom") {
        newItems[index].fgItem = "";
      } else {
        newItems[index].customItemName = "";
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
    
    if ((initialData && !formData.rfqNumber) || !formData.customerName) {
      Swal.fire({
        icon: 'error',
        title: 'Missing Details',
        text: 'Please provide Customer Name and RFQ Number.',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }

    const hasInvalidItems = formData.items.some(item => 
      (item.itemType === "Custom" && !item.customItemName) || 
      (item.itemType === "FGItem" && !item.fgItem) || 
      !item.quantity
    );

    if (hasInvalidItems) {
      Swal.fire({
        icon: 'error',
        title: 'Validation Error',
        text: 'Please ensure all items have a valid selection/name and quantity.',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }

    const payload = { 
      ...formData,
      items: formData.items.map(item => {
        const cleanedItem: any = { ...item };
        if (cleanedItem.itemType === "Custom") {
          cleanedItem.fgItem = null;
        } else if (cleanedItem.fgItem === "") {
          cleanedItem.fgItem = null;
        }
        if (cleanedItem.itemType === "FGItem") {
          cleanedItem.customItemName = "";
        }
        return cleanedItem;
      })
    };
    
    // Allow backend to assign correct sequential number for new RFQs
    if (!initialData) {
      delete (payload as any).rfqNumber;
    }

    onSubmit(payload);
  };

  const handleDownloadPDF = async () => {
    try {
      await generateDocument('pdf', 'incoming_rfq', { doc: formData, companyInfo });
    } catch (error) {
      console.error("Failed to download PDF", error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-6xl shadow-2xl overflow-hidden my-8">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" />
              {isPreview ? "Incoming RFQ Details" : (initialData ? "Edit Incoming RFQ" : "Create Incoming RFQ")}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Record a customer inquiry for our finished goods or custom items.
            </p>
          </div>
          <button onClick={onCancel} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                RFQ Number {initialData && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                required={!!initialData}
                disabled={!initialData || isPreview}
                value={formData.rfqNumber}
                onChange={(e) => setFormData({ ...formData, rfqNumber: e.target.value })}
                className={`w-full px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${(!initialData || isPreview) ? 'text-gray-500 cursor-not-allowed' : ''}`}
                placeholder="e.g., RFQ-2023-001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                disabled={isPreview}
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className={`w-full px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isPreview ? 'opacity-70 cursor-not-allowed' : ''}`}
              />
            </div>

            <div className="md:col-span-2">
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Master</span>
                  <button
                    type="button"
                    disabled={isPreview}
                    onClick={() => {
                      setCustomerType(customerType === "master" ? "custom" : "master");
                      setFormData({ ...formData, customerName: "", customerEmail: "", customerPhone: "" });
                    }}
                    className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 ${customerType === "custom" ? "bg-indigo-600" : "bg-gray-300"} ${isPreview ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${customerType === "custom" ? "translate-x-4" : "translate-x-1"}`} />
                  </button>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Custom</span>
                </div>
              </div>
              
              {customerType === "master" ? (
                <div className={isPreview ? "pointer-events-none opacity-70" : ""}>
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
                    placeholder="Select Customer..."
                    className="w-full"
                  />
                </div>
              ) : (
                <input
                  type="text"
                  required
                  disabled={isPreview}
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  className={`w-full px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isPreview ? 'opacity-70 cursor-not-allowed' : ''}`}
                  placeholder="Enter custom customer name"
                />
              )}
            </div>

            {customerType === "custom" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Customer Email
                  </label>
                  <input
                    type="email"
                    disabled={isPreview}
                    value={formData.customerEmail}
                    onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                    className={`w-full px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isPreview ? 'opacity-70 cursor-not-allowed' : ''}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Customer Phone
                  </label>
                  <input
                    type="text"
                    disabled={isPreview}
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                    className={`w-full px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isPreview ? 'opacity-70 cursor-not-allowed' : ''}`}
                  />
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Open">Open</option>
                <option value="Quoted">Quoted</option>
                <option value="Closed">Closed</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Expected Delivery
              </label>
              <input
                type="date"
                disabled={isPreview}
                value={formData.expectedDeliveryDate}
                onChange={(e) => setFormData({ ...formData, expectedDeliveryDate: e.target.value })}
                className={`w-full px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isPreview ? 'opacity-70 cursor-not-allowed' : ''}`}
              />
            </div>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Inquiry Items</h3>
              {!isPreview && (
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Item
                </button>
              )}
            </div>
            
            <div className="space-y-4">
              {formData.items.map((item, index) => (
                <div key={index} className="p-4 bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700 rounded-xl relative group">
                  {!isPreview && formData.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="absolute -top-3 -right-3 p-1.5 bg-red-100 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200 shadow-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
                      <select
                        disabled={isPreview}
                        value={item.itemType}
                        onChange={(e) => handleItemChange(index, "itemType", e.target.value)}
                        className={`w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isPreview ? 'opacity-70 cursor-not-allowed' : ''}`}
                      >
                        <option value="Custom">Custom</option>
                        <option value="FGItem">FG Item</option>
                      </select>
                    </div>
                    
                    <div className="md:col-span-3">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Item Details <span className="text-red-500">*</span></label>
                      {item.itemType === "FGItem" ? (
                        <select
                          required
                          disabled={isPreview}
                          value={item.fgItem}
                          onChange={(e) => handleItemChange(index, "fgItem", e.target.value)}
                          className={`w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isPreview ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                          <option value="">Select Finished Good</option>
                          {fgItems.map(fg => (
                            <option key={fg._id} value={fg._id}>{fg.name}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          required
                          disabled={isPreview}
                          placeholder="Custom Item Name"
                          value={item.customItemName}
                          onChange={(e) => handleItemChange(index, "customItemName", e.target.value)}
                          className={`w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isPreview ? 'opacity-70 cursor-not-allowed' : ''}`}
                        />
                      )}
                    </div>
                    
                    <div className="md:col-span-1">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Qty <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        disabled={isPreview}
                        value={item.quantity || ""}
                        onChange={(e) => handleItemChange(index, "quantity", e.target.value === '' ? '' : Number(e.target.value))}
                        className={`w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isPreview ? 'opacity-70 cursor-not-allowed' : ''}`}
                      />
                    </div>
                    
                    <div className="md:col-span-1">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Unit</label>
                      <input
                        type="text"
                        disabled={isPreview}
                        value={item.unit}
                        onChange={(e) => handleItemChange(index, "unit", e.target.value)}
                        className={`w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isPreview ? 'opacity-70 cursor-not-allowed' : ''}`}
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Target Price</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        disabled={isPreview}
                        value={item.targetPrice || ""}
                        onChange={(e) => handleItemChange(index, "targetPrice", e.target.value === '' ? '' : Number(e.target.value))}
                        className={`w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isPreview ? 'opacity-70 cursor-not-allowed' : ''}`}
                      />
                    </div>
                    
                    <div className="md:col-span-3">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Description (Optional)</label>
                      <input
                        type="text"
                        disabled={isPreview}
                        value={item.description}
                        onChange={(e) => handleItemChange(index, "description", e.target.value)}
                        className={`w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isPreview ? 'opacity-70 cursor-not-allowed' : ''}`}
                        placeholder="Additional details..."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Remarks
            </label>
            <textarea
              rows={3}
              disabled={isPreview}
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              className={`w-full px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isPreview ? 'opacity-70 cursor-not-allowed' : ''}`}
              placeholder="Any additional notes..."
            />
          </div>

          <div className="mt-8 flex items-center justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-800">
            {isPreview && (
              <button
                type="button"
                onClick={handleDownloadPDF}
                className="px-5 py-2.5 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-2"
              >
                <Download size={16} />
                Download PDF
              </button>
            )}
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? "Saving..." : (isPreview ? "Update Status" : (initialData ? "Update RFQ" : "Create RFQ"))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
