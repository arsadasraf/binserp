import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Truck, Package, Save } from 'lucide-react';
import { useCreateStoreDispatchMutation } from "@/src/store/services/storeService";

interface StoreCreateDispatchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (message: string) => void;
    order: any;
}

export default function StoreCreateDispatchModal({ isOpen, onClose, onSuccess, order }: StoreCreateDispatchModalProps) {
    const [createDispatch] = useCreateStoreDispatchMutation();
    const galleryInputRef = useRef<HTMLInputElement>(null);

    const [dispatchData, setDispatchData] = useState({
        dispatchDate: new Date().toISOString().split('T')[0],
        vehicleNumber: "",
        driverName: "",
        remarks: "",
    });

    const [items, setItems] = useState<any[]>([]);
    const [photos, setPhotos] = useState<File[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (order && order.items) {
            setItems(order.items.map((item: any) => ({
                fgItem: item.fgItem._id || item.fgItem,
                name: item.name || (item.fgItem && item.fgItem.name) || 'Unknown',
                ordered: item.quantity,
                dispatchedAlready: item.dispatchedQuantity || 0,
                remaining: item.quantity - (item.dispatchedQuantity || 0),
                dispatchingNow: 0
            })));
        }
    }, [order]);

    if (!isOpen || !order) return null;

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const filesArray = Array.from(e.target.files);
            setPhotos(prev => [...prev, ...filesArray].slice(0, 4)); // max 3 photos + 1 pdf = 4 files limit check loosely
        }
    };

    const handleQuantityChange = (index: number, val: string) => {
        const num = Number(val);
        setItems(prev => {
            const newItems = [...prev];
            if (num > newItems[index].remaining) {
                newItems[index].dispatchingNow = newItems[index].remaining;
            } else if (num < 0) {
                newItems[index].dispatchingNow = 0;
            } else {
                newItems[index].dispatchingNow = num;
            }
            return newItems;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        
        const dispatchItems = items
            .filter(item => item.dispatchingNow > 0)
            .map(item => ({
                fgItem: item.fgItem,
                dispatchedQuantity: item.dispatchingNow
            }));

        if (dispatchItems.length === 0) {
            setError("Please enter a dispatch quantity for at least one item.");
            return;
        }

        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('dispatchDate', dispatchData.dispatchDate);
            formData.append('vehicleNumber', dispatchData.vehicleNumber);
            formData.append('driverName', dispatchData.driverName);
            formData.append('remarks', dispatchData.remarks);
            formData.append('items', JSON.stringify(dispatchItems));

            let pdfCount = 0;
            let photoCount = 0;
            photos.forEach((file) => {
                if (file.type === 'application/pdf') {
                    if (pdfCount === 0) {
                        formData.append('pdf', file);
                        pdfCount++;
                    }
                } else if (file.type.startsWith('image/')) {
                    if (photoCount < 3) {
                        formData.append('photos', file);
                        photoCount++;
                    }
                }
            });

            await createDispatch({ orderId: order._id, body: formData }).unwrap();
            onSuccess("Order dispatched successfully!");
            onClose();
        } catch (err: any) {
            console.error("Failed to create dispatch:", err);
            setError(err?.data?.message || err?.message || "Failed to create dispatch");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[105] transition-opacity" onClick={onClose} />
            <div className="fixed inset-0 flex items-center justify-center z-[110] p-4 sm:p-6">
                <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-6xl w-full max-h-[95vh] flex flex-col border border-white/50">
                    
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-white/50">
                        <div>
                            <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                Create Dispatch
                            </h2>
                            <p className="text-sm text-gray-500 font-medium mt-1">
                                Order: {order.orderNumber} • Customer: {order.customer?.name || order.customerName}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                        {error && (
                            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100 font-medium">
                                {error}
                            </div>
                        )}

                        <form id="dispatch-form" onSubmit={handleSubmit} className="space-y-6">
                            
                            {/* Dispatch Details */}
                            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-indigo-500"></div>
                                <h3 className="text-sm uppercase tracking-wider font-bold text-gray-400 mb-5 pl-2 flex items-center gap-2">
                                    <Truck size={16} className="text-blue-500" />
                                    Dispatch Information
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-1.5">
                                        <label className="block text-sm font-semibold text-gray-700">Dispatch Date</label>
                                        <input
                                            type="date"
                                            required
                                            value={dispatchData.dispatchDate}
                                            onChange={(e) => setDispatchData({ ...dispatchData, dispatchDate: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-700"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="block text-sm font-semibold text-gray-700">Vehicle Number</label>
                                        <input
                                            type="text"
                                            value={dispatchData.vehicleNumber}
                                            onChange={(e) => setDispatchData({ ...dispatchData, vehicleNumber: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-700 uppercase"
                                            placeholder="e.g. MH-12-AB-1234"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="block text-sm font-semibold text-gray-700">Driver Name</label>
                                        <input
                                            type="text"
                                            value={dispatchData.driverName}
                                            onChange={(e) => setDispatchData({ ...dispatchData, driverName: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-700"
                                            placeholder="Name"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Items to Dispatch */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-purple-500"></div>
                                <div className="p-6 border-b border-gray-50 flex items-center gap-2 pl-8">
                                    <Package size={18} className="text-indigo-500" />
                                    <h3 className="text-lg font-bold text-gray-800">Items to Dispatch</h3>
                                </div>
                                <div className="p-6 overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-500 font-medium">
                                            <tr>
                                                <th className="px-4 py-3">Product Name</th>
                                                <th className="px-4 py-3 text-center">Ordered</th>
                                                <th className="px-4 py-3 text-center">Prev. Dispatched</th>
                                                <th className="px-4 py-3 text-center">Remaining</th>
                                                <th className="px-4 py-3 text-center bg-blue-50 text-blue-700 rounded-t-lg">Dispatching Now</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 border-t border-gray-100">
                                            {items.map((item, index) => (
                                                <tr key={index} className={item.remaining === 0 ? "bg-gray-50/50 opacity-60" : ""}>
                                                    <td className="px-4 py-4 font-medium text-gray-900">{item.name}</td>
                                                    <td className="px-4 py-4 text-center text-gray-600">{item.ordered}</td>
                                                    <td className="px-4 py-4 text-center text-green-600 font-medium">{item.dispatchedAlready}</td>
                                                    <td className="px-4 py-4 text-center text-amber-600 font-medium">{item.remaining}</td>
                                                    <td className="px-4 py-4 bg-blue-50/30">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max={item.remaining}
                                                            value={item.dispatchingNow}
                                                            onChange={(e) => handleQuantityChange(index, e.target.value)}
                                                            disabled={item.remaining === 0}
                                                            className="w-full px-3 py-2 text-center bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-blue-700 disabled:bg-gray-100 disabled:text-gray-400"
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Remarks & Attachments */}
                            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-purple-500 to-pink-500"></div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-2">
                                    <div className="space-y-1.5">
                                        <label className="block text-sm font-semibold text-gray-700">Remarks</label>
                                        <textarea
                                            value={dispatchData.remarks}
                                            onChange={(e) => setDispatchData({ ...dispatchData, remarks: e.target.value })}
                                            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-gray-700 resize-none"
                                            rows={2}
                                            placeholder="Enter any additional instructions..."
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="block text-sm font-semibold text-gray-700">Attachments (PDF/Photos)</label>
                                        <div className="flex items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={() => galleryInputRef.current?.click()}
                                                className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700 h-[60px]"
                                            >
                                                <Camera size={16} className="text-purple-500" />
                                                Upload
                                            </button>
                                            <input
                                                ref={galleryInputRef}
                                                type="file"
                                                className="hidden"
                                                accept="image/*,application/pdf"
                                                multiple
                                                onChange={handlePhotoChange}
                                            />
                                            {photos.length > 0 && (
                                                <div className="flex gap-2 flex-wrap">
                                                    {photos.map((file, index) => (
                                                        <div key={index} className="relative w-14 h-14 rounded-lg overflow-hidden border border-gray-200 group">
                                                            {file.type === 'application/pdf' ? (
                                                                <div className="w-full h-full bg-gray-50 flex items-center justify-center">
                                                                    <span className="text-[10px] font-bold text-red-500">PDF</span>
                                                                </div>
                                                            ) : (
                                                                <img src={URL.createObjectURL(file)} alt="Preview" className="w-full h-full object-cover" />
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => setPhotos(prev => prev.filter((_, i) => i !== index))}
                                                                className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-gray-100 bg-white/80">
                        <div className="flex gap-4 justify-end">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-8 py-3 bg-white text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors border border-gray-200 shadow-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="dispatch-form"
                                disabled={submitting}
                                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex items-center gap-2"
                            >
                                <Save size={18} />
                                {submitting ? "Processing..." : "Confirm Dispatch"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
