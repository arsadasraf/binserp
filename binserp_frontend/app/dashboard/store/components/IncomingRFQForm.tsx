import React, { useState, useEffect } from "react";
import { Plus, Trash2, X, Search, FileText } from "lucide-react";
import Swal from "sweetalert2";

interface IncomingRFQFormProps {
  initialData?: any;
  fgItems: any[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export const IncomingRFQForm: React.FC<IncomingRFQFormProps> = ({ initialData, fgItems, onSubmit, onCancel, isSubmitting }) => {
  const [formData, setFormData] = useState({
    rfqNumber: "",
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
      setFormData({
        rfqNumber: initialData.rfqNumber || "",
        date: initialData.date ? new Date(initialData.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
        customerName: initialData.customerName || "",
        customerEmail: initialData.customerEmail || "",
        customerPhone: initialData.customerPhone || "",
        expectedDeliveryDate: initialData.expectedDeliveryDate ? new Date(initialData.expectedDeliveryDate).toISOString().split("T")[0] : "",
        remarks: initialData.remarks || "",
        status: initialData.status || "Open",
        items: initialData.items?.length > 0 ? initialData.items.map((i: any) => ({
          itemType: i.itemType || "Custom",
          fgItem: typeof i.fgItem === "object" ? i.fgItem?._id : i.fgItem || "",
          customItemName: i.customItemName || "",
          quantity: i.quantity || 1,
          unit: i.unit || "PCS",
          description: i.description || "",
          targetPrice: i.targetPrice || 0,
        })) : [
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
    }
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
    
    if (!formData.rfqNumber || !formData.customerName) {
      Swal.fire({
        icon: 'error',
        title: 'Validation Error',
        text: 'Please fill in all required fields (RFQ Number, Customer Name).',
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

    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-6xl shadow-2xl overflow-hidden my-8">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" />
              {initialData ? "Edit Incoming RFQ" : "Create Incoming RFQ"}
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
                RFQ Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.rfqNumber}
                onChange={(e) => setFormData({ ...formData, rfqNumber: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Customer Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Customer Email
              </label>
              <input
                type="email"
                value={formData.customerEmail}
                onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Customer Phone
              </label>
              <input
                type="text"
                value={formData.customerPhone}
                onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
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
                value={formData.expectedDeliveryDate}
                onChange={(e) => setFormData({ ...formData, expectedDeliveryDate: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Inquiry Items</h3>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Item
              </button>
            </div>
            
            <div className="space-y-4">
              {formData.items.map((item, index) => (
                <div key={index} className="p-4 bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700 rounded-xl relative group">
                  {formData.items.length > 1 && (
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
                        value={item.itemType}
                        onChange={(e) => handleItemChange(index, "itemType", e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                          value={item.fgItem}
                          onChange={(e) => handleItemChange(index, "fgItem", e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                          placeholder="Custom Item Name"
                          value={item.customItemName}
                          onChange={(e) => handleItemChange(index, "customItemName", e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, "quantity", parseFloat(e.target.value))}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    
                    <div className="md:col-span-1">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Unit</label>
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) => handleItemChange(index, "unit", e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Target Price</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.targetPrice}
                        onChange={(e) => handleItemChange(index, "targetPrice", parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    
                    <div className="md:col-span-3">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Description (Optional)</label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => handleItemChange(index, "description", e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Any additional notes..."
            />
          </div>

          <div className="mt-8 flex items-center justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-800">
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
              {isSubmitting ? "Saving..." : (initialData ? "Update RFQ" : "Create RFQ")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
