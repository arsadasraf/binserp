import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Calendar, User, Package, Layers, Info, Check, AlertCircle } from 'lucide-react';
import { Vendor, RmBoItem, JobWorkFormData, JobWorkSupplier } from '../../types/store.types';
import { apiPost, apiPut } from '@/src/lib/api';
import { generateDocument } from '@/src/utils/documentHelper';
import SearchableSelect from '../SearchableSelect';

interface JobWorkFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    onError: (msg: string) => void;
    vendors?: Vendor[];
    jobWorkSuppliers: JobWorkSupplier[];
    materials?: RmBoItem[]; // BO Items
    inHouseItems?: any[]; // In-House Items
     initialData?: Partial<JobWorkFormData> & { _id?: string }; // Pre-fill data
    isModal?: boolean;
    token: string | null;
    companyInfo?: any;
}

export default function JobWorkForm({ isOpen, onClose, onSuccess, onError, vendors = [], jobWorkSuppliers = [], materials = [], inHouseItems = [], initialData, isModal = true, token, companyInfo }: JobWorkFormProps) {
    const [loading, setLoading] = useState(false);
    const [successData, setSuccessData] = useState<any>(null);

    const [formData, setFormData] = useState<JobWorkFormData>({
        challanNumber: '',
        vendor: '',
        date: new Date().toISOString().split('T')[0],
        expectedReturnDate: '',
        poNumber: '',
        vehicleNo: '',
        freightType: 'To pay',
        lrNr: '',
        eSugamNo: '',
        eSugamDate: '',
        estimatedWeight: 0,
        estimatedPrice: 0,
        items: [
            { item: '', itemType: 'bo', processType: '', quantitySent: 0, unit: 'PCS', unitPrice: 0, description: '', itemToBeReceived: '' }
        ]
    });

    // Effect to populate form when initialData changes or modal opens
    useEffect(() => {
        if (isOpen && initialData) {
            const { _id, items, ...rest } = initialData;
            setFormData(prev => ({
                ...prev,
                ...rest,
                items: items || prev.items
            }));
            setSuccessData(null);
        } else if (isOpen && !initialData) {
            // Reset if opening empty
            setSuccessData(null);
            setFormData({
                challanNumber: '',
                vendor: '',
                date: new Date().toISOString().split('T')[0],
                expectedReturnDate: '',
                poNumber: '',
                vehicleNo: '',
                freightType: 'To pay',
                lrNr: '',
                eSugamNo: '',
                eSugamDate: '',
                estimatedWeight: 0,
                estimatedPrice: 0,
                items: [
                    { item: '', itemType: 'bo', processType: '', quantitySent: 0, unit: 'PCS', unitPrice: 0, description: '', itemToBeReceived: '' }
                ]
            });
        }
    }, [isOpen, initialData]);

    const handleItemChange = (index: number, field: string, value: any) => {
        const newItems = [...formData.items];
        newItems[index] = { ...newItems[index], [field]: value };

        // Auto-populate Unit if item changes
        if (field === 'item') {
            const selectedId = value;
            const type = newItems[index].itemType;
            const sourceList = type === 'bo' ? materials : inHouseItems;

            const found = sourceList.find(i => i._id === selectedId);
            if (found) {
                let unit = 'PCS';
                if (type === 'bo') {
                    unit = (found as any).categoryId?.unit || (found as any).category?.unit || 'PCS';
                } else {
                    unit = found.unit || 'PCS';
                }
                newItems[index].unit = unit;
            }
        }

        setFormData({ ...formData, items: newItems });
    };

    const addItem = () => {
        setFormData({
            ...formData,
            items: [...formData.items, { item: '', itemType: 'bo', processType: '', quantitySent: 0, unit: 'PCS', unitPrice: 0, description: '', itemToBeReceived: '' }]
        });
    };

    const removeItem = (index: number) => {
        const newItems = formData.items.filter((_, i) => i !== index);
        setFormData({ ...formData, items: newItems });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        if (!token) {
            onError("Authentication token missing");
            setLoading(false);
            return;
        }

        try {
            // Validate
            if (!formData.vendor) {
                onError('Please select a vendor');
                setLoading(false);
                return;
            }
            if (formData.items.some(i => (i.itemType === 'custom' ? !i.itemName : !i.item) || !i.processType || i.quantitySent <= 0)) {
                onError('Please check item details (Item, Process, Quantity)');
                setLoading(false);
                return;
            }

            const payload = {
                ...formData,
                items: formData.items.map(item => ({
                    ...item,
                    // If working with InHouse items, we might need to send specific flags or IDs?
                    // Currently backend handles both ID types in same field.
                }))
            };

            if (initialData && initialData._id) {
                await apiPut(`/api/store/jobwork/update/${initialData._id}`, payload, token);
                onSuccess();
            } else {
                const response = await apiPost('/api/store/jobwork/create', payload, token);
                setSuccessData(response.jobWork);
            }
        } catch (error: any) {
            onError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPDF = async () => {
        try {
            await generateDocument('pdf', 'returnable_dc', { doc: successData, companyInfo });
        } catch (error) {
            onError('Failed to generate PDF');
        }
    };

    const handleDownloadExcel = async () => {
        try {
            await generateDocument('excel', 'Returnable DC', [{ doc: successData, companyInfo }]);
        } catch (error) {
            onError('Failed to generate Excel');
        }
    };

    if (!isOpen) return null;

    // Styles
    const inputWrapperClass = "relative";
    const inputClass = "w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm group-hover:bg-white";
    const labelClass = "block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1";
    const iconClass = "absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-indigo-500 transition-colors";

    const content = successData ? (
        <div className="flex flex-col h-full bg-white p-8 items-center justify-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <Check className="text-green-600 w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Challan Created Successfully!</h2>
            <p className="text-gray-500 mb-8 text-center">
                Job Work Challan <strong>{successData.challanNumber}</strong> has been created. <br />
                You can now download the Returnable DC in PDF or Excel format.
            </p>
            <div className="flex gap-4 mb-8">
                <button
                    onClick={handleDownloadPDF}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium transition-all shadow-lg shadow-indigo-200 flex items-center gap-2"
                >
                    <Layers size={20} /> Download PDF
                </button>
                <button
                    onClick={handleDownloadExcel}
                    className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium transition-all shadow-lg shadow-emerald-200 flex items-center gap-2"
                >
                    <Package size={20} /> Download Excel
                </button>
            </div>
            <button
                onClick={() => {
                    setSuccessData(null);
                    onSuccess();
                }}
                className="text-gray-500 hover:text-gray-900 font-medium underline"
            >
                Close and return to list
            </button>
        </div>
    ) : (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10 shrink-0">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Create Job Work Challan</h2>
                    <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                        Send materials for external processing
                    </p>
                </div>
                {isModal && (
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                )}
            </div>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar pb-32">
                    {/* Header Fields Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <div className="group">
                            <label className={labelClass}>Challan Number</label>
                            <div className={inputWrapperClass}>
                                <input
                                    type="text"
                                    value={formData.challanNumber || ''}
                                    readOnly
                                    className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-500 cursor-not-allowed"
                                    placeholder="Auto-generated"
                                />
                            </div>
                        </div>

                        <div className="group">
                            <label className={labelClass}>Vendor / Supplier <span className="text-red-500">*</span></label>
                            <SearchableSelect
                                options={vendors.filter(v => v.vendorType === 'Manufacturing Vendor').map(v => ({ value: v._id, label: v.name || '' }))}
                                value={typeof formData.vendor === 'object' ? (formData.vendor as any)._id : formData.vendor || ''}
                                onChange={(val: any) => setFormData({ ...formData, vendor: val })}
                                placeholder="Select Supplier"
                            />
                        </div>

                        <div className="group">
                            <label className={labelClass}>Sent Date <span className="text-red-500">*</span></label>
                            <div className={inputWrapperClass}>
                                <div className={iconClass}><Calendar size={16} /></div>
                                <input
                                    type="date"
                                    required
                                    value={formData.date}
                                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    className={inputClass}
                                />
                            </div>
                        </div>

                        <div className="group">
                            <label className={labelClass}>Expected Return</label>
                            <div className={inputWrapperClass}>
                                <div className={iconClass}><Calendar size={16} /></div>
                                <input
                                    type="date"
                                    value={formData.expectedReturnDate || ''}
                                    onChange={e => setFormData({ ...formData, expectedReturnDate: e.target.value })}
                                    className={inputClass}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Transport & Additional Details */}
                    <div className="bg-gray-50/50 rounded-2xl border border-gray-100 overflow-visible shadow-sm mb-8">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2 bg-white">
                            <span className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                                <Info size={18} />
                            </span>
                            <h3 className="text-base font-bold text-gray-900">Transport & Tax Details</h3>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 bg-white">
                            <div className="group">
                                <label className={labelClass}>Our PO No</label>
                                <div className={inputWrapperClass}>
                                    <input
                                        type="text"
                                        value={formData.poNumber || ''}
                                        onChange={e => setFormData({ ...formData, poNumber: e.target.value })}
                                        className={inputClass}
                                        placeholder="e.g. PO-241/26"
                                    />
                                </div>
                            </div>
                            <div className="group">
                                <label className={labelClass}>Vehicle No</label>
                                <div className={inputWrapperClass}>
                                    <input
                                        type="text"
                                        value={formData.vehicleNo || ''}
                                        onChange={e => setFormData({ ...formData, vehicleNo: e.target.value })}
                                        className={inputClass}
                                        placeholder="e.g. KA-01-AB-1234"
                                    />
                                </div>
                            </div>
                            <div className="group">
                                <label className={labelClass}>Estimated Weight (Kgs)</label>
                                <div className={inputWrapperClass}>
                                    <input
                                        type="number"
                                        value={formData.estimatedWeight || ''}
                                        onChange={e => setFormData({ ...formData, estimatedWeight: Number(e.target.value) })}
                                        className={inputClass}
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div className="group">
                                <label className={labelClass}>Estimated Price (₹)</label>
                                <div className={inputWrapperClass}>
                                    <input
                                        type="number"
                                        value={formData.estimatedPrice || ''}
                                        onChange={e => setFormData({ ...formData, estimatedPrice: Number(e.target.value) })}
                                        className={inputClass}
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div className="group">
                                <label className={labelClass}>Freight Type</label>
                                <select
                                    value={formData.freightType || 'To pay'}
                                    onChange={e => setFormData({ ...formData, freightType: e.target.value as any })}
                                    className={inputClass}
                                >
                                    <option value="To pay">To pay</option>
                                    <option value="Paid">Paid</option>
                                    <option value="LR/NR">LR/NR</option>
                                </select>
                            </div>
                            <div className="group">
                                <label className={labelClass}>LR / NR</label>
                                <div className={inputWrapperClass}>
                                    <input
                                        type="text"
                                        value={formData.lrNr || ''}
                                        onChange={e => setFormData({ ...formData, lrNr: e.target.value })}
                                        className={inputClass}
                                        placeholder="LR/NR Details"
                                    />
                                </div>
                            </div>
                            <div className="group">
                                <label className={labelClass}>E-Sugam No</label>
                                <div className={inputWrapperClass}>
                                    <input
                                        type="text"
                                        value={formData.eSugamNo || ''}
                                        onChange={e => setFormData({ ...formData, eSugamNo: e.target.value })}
                                        className={inputClass}
                                        placeholder="e-Sugam number"
                                    />
                                </div>
                            </div>
                            <div className="group">
                                <label className={labelClass}>E-Sugam Date</label>
                                <div className={inputWrapperClass}>
                                    <input
                                        type="date"
                                        value={formData.eSugamDate ? formData.eSugamDate.split('T')[0] : ''}
                                        onChange={e => setFormData({ ...formData, eSugamDate: e.target.value })}
                                        className={inputClass}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Items Section */}
                    <div className="bg-gray-50/50 rounded-2xl border border-gray-100 overflow-visible shadow-sm">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white">
                            <div className="flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                                    <Layers size={18} />
                                </span>
                                <h3 className="text-base font-bold text-gray-900">Items List</h3>
                            </div>
                            <button
                                type="button"
                                onClick={addItem}
                                className="px-3 py-1.5 text-sm bg-white border border-gray-200 text-indigo-600 font-medium rounded-lg hover:bg-indigo-50 hover:border-indigo-100 transition-all flex items-center gap-2 shadow-sm"
                            >
                                <Plus size={16} /> Add Item
                            </button>
                        </div>

                        <div className="overflow-visible">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50/80 backdrop-blur">
                                    <tr>
                                        <th className="px-4 py-3 text-left w-28 font-semibold text-gray-500 uppercase tracking-wider text-xs">Type</th>
                                        <th className="px-4 py-3 text-left w-[25%] font-semibold text-gray-500 uppercase tracking-wider text-xs">Item Sent</th>
                                        <th className="px-4 py-3 text-left w-[25%] font-semibold text-gray-500 uppercase tracking-wider text-xs">Item To Receive</th>
                                        <th className="px-4 py-3 text-left w-[20%] font-semibold text-gray-500 uppercase tracking-wider text-xs">Process</th>
                                        <th className="px-4 py-3 text-left w-24 font-semibold text-gray-500 uppercase tracking-wider text-xs">Qty</th>
                                        <th className="px-4 py-3 text-left w-20 font-semibold text-gray-500 uppercase tracking-wider text-xs">Unit</th>
                                        <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase tracking-wider text-xs">Description</th>
                                        <th className="px-4 py-3 w-12"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {formData.items.map((item, idx) => (
                                        <tr key={idx} className="group hover:bg-indigo-50/30 transition-colors">
                                            <td className="p-3">
                                                <select
                                                    value={item.itemType}
                                                    onChange={e => handleItemChange(idx, 'itemType', e.target.value)}
                                                    className="w-full bg-transparent border-b border-transparent group-hover:border-gray-300 focus:border-indigo-500 focus:outline-none py-1.5 transition-colors text-gray-700 font-medium cursor-pointer"
                                                >
                                                    <option value="bo">RM / BO</option>
                                                    <option value="inhouse">Fg items</option>
                                                    <option value="custom">Custom</option>
                                                </select>
                                            </td>
                                            <td className="p-3">
                                                {item.itemType === 'custom' ? (
                                                    <input
                                                        type="text"
                                                        value={item.itemName || ''}
                                                        onChange={e => handleItemChange(idx, 'itemName', e.target.value)}
                                                        className="w-full bg-transparent border-b border-transparent group-hover:border-gray-300 focus:border-indigo-500 focus:outline-none py-1.5 transition-colors text-gray-900 font-medium"
                                                        placeholder="Custom Item Name"
                                                        required
                                                    />
                                                ) : (
                                                <SearchableSelect
                                                    options={item.itemType === 'bo' 
                                                        ? (materials || []).map(m => ({ value: m._id, label: m.name || '' })) 
                                                        : (inHouseItems || []).map(i => ({ value: i._id, label: i.componentName || i.name || '' }))
                                                    }
                                                    value={typeof item.item === 'object' ? (item.item as any)._id : item.item || ''}
                                                    onChange={(val: any) => handleItemChange(idx, 'item', val)}
                                                    placeholder="Select Item"
                                                />
                                                )}
                                            </td>
                                            <td className="p-3">
                                                <input
                                                    type="text"
                                                    value={item.itemToBeReceived || ''}
                                                    onChange={e => handleItemChange(idx, 'itemToBeReceived', e.target.value)}
                                                    placeholder="Same as Sent"
                                                    className="w-full bg-transparent border-b border-transparent group-hover:border-gray-300 focus:border-indigo-500 focus:outline-none py-1.5 transition-colors"
                                                />
                                            </td>
                                            <td className="p-3">
                                                <input
                                                    type="text"
                                                    value={item.processType}
                                                    onChange={e => handleItemChange(idx, 'processType', e.target.value)}
                                                    placeholder="e.g. Machining"
                                                    className="w-full bg-transparent border-b border-transparent group-hover:border-gray-300 focus:border-indigo-500 focus:outline-none py-1.5 transition-colors"
                                                    required
                                                />
                                            </td>
                                            <td className="p-3">
                                                <input
                                                    type="number"
                                                    value={item.quantitySent}
                                                    onChange={e => handleItemChange(idx, 'quantitySent', Number(e.target.value))}
                                                    className="w-full bg-transparent border-b border-transparent group-hover:border-gray-300 focus:border-indigo-500 focus:outline-none py-1.5 transition-colors font-mono"
                                                    min="1"
                                                    required
                                                />
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className="inline-flex items-center justify-center px-2 py-1 rounded bg-gray-100 text-xs font-semibold text-gray-600">
                                                    {item.unit}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                <input
                                                    type="text"
                                                    value={item.description || ''}
                                                    onChange={e => handleItemChange(idx, 'description', e.target.value)}
                                                    placeholder="Optional notes"
                                                    className="w-full bg-transparent border-b border-transparent group-hover:border-gray-300 focus:border-indigo-500 focus:outline-none py-1.5 transition-colors placeholder-gray-300"
                                                />
                                            </td>
                                            <td className="p-3 text-center">
                                                {formData.items.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeItem(idx)}
                                                        className="text-gray-300 hover:text-red-500 transition-colors p-1.5 hover:bg-red-50 rounded-lg"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {formData.items.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="text-center py-8 text-gray-400 italic">
                                                No items added yet. Click "Add Item" to begin.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-8 py-5 border-t border-gray-100 bg-gray-50/50 flex justify-between items-center shrink-0">
                    <div className="text-sm">
                        {formData.items.length > 0 && (
                            <span className="text-gray-500 flex items-center gap-2">
                                <AlertCircle size={16} className="text-indigo-500" />
                                {formData.items.length} item{formData.items.length !== 1 ? 's' : ''} to process
                            </span>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 font-medium transition-all shadow-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all shadow-lg shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-0.5 flex items-center gap-2"
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                    Saving...
                                </span>
                            ) : (
                                <>
                                    <Check size={18} /> Create Challan
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );

    if (isModal) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="w-full max-w-7xl h-[95vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 ring-1 ring-black/5">
                    {content}
                </div>
            </div>
        );
    }

    return <div className="w-full">{content}</div>;
}
