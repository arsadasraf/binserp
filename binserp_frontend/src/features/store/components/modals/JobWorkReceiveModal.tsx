import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { JobWorkChallan } from '../../types/store.types';
import { apiPut } from '@/src/lib/api';

interface JobWorkReceiveModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    onError: (msg: string) => void;
    challan: JobWorkChallan;
    token: string | null;
}

export default function JobWorkReceiveModal({ isOpen, onClose, onSuccess, onError, challan, token }: JobWorkReceiveModalProps) {
    const [loading, setLoading] = useState(false);
    const [receiveData, setReceiveData] = useState<{ itemId: string; quantity: number }[]>([]);

    const handleQuantityChange = (itemId: string, value: string) => {
        const qty = Number(value);
        const existing = receiveData.find(d => d.itemId === itemId);
        if (existing) {
            setReceiveData(receiveData.map(d => d.itemId === itemId ? { ...d, quantity: qty } : d));
        } else {
            setReceiveData([...receiveData, { itemId, quantity: qty }]);
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            // Filter out zero quantities
            const itemsToReceive = receiveData.filter(d => d.quantity > 0);

            if (itemsToReceive.length === 0) {
                onError('Please enter quantity for at least one item');
                setLoading(false);
                return;
            }

            await apiPut(`/api/store/jobwork/receive/${challan._id}`, { items: itemsToReceive }, token);

            onSuccess();
        } catch (error: any) {
            onError(error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Receive Items</h2>
                        <p className="text-sm text-gray-500">Challan: {challan.challanNumber} | Vendor: {challan.vendor?.name || 'Unknown Vendor'}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                <div className="p-6">
                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left">Item Name</th>
                                    <th className="px-4 py-3 text-center">Process</th>
                                    <th className="px-4 py-3 text-center">Sent</th>
                                    <th className="px-4 py-3 text-center">Received</th>
                                    <th className="px-4 py-3 text-center">Pending</th>
                                    <th className="px-4 py-3 text-left w-32">Receive Now</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {challan.items.map((item, idx) => {
                                    const pending = item.quantitySent - item.quantityReceived;
                                    const inputValue = receiveData.find(d => d.itemId === item._id || d.itemId === item.item)?.quantity || '';

                                    if (item.status === 'Completed' || pending <= 0) return null;

                                    return (
                                        <tr key={idx}>
                                            <td className="px-4 py-3 font-medium text-gray-900">{item.itemName}</td>
                                            <td className="px-4 py-3 text-center text-gray-500">{item.processType}</td>
                                            <td className="px-4 py-3 text-center text-gray-500">{item.quantitySent}</td>
                                            <td className="px-4 py-3 text-center text-green-600 font-medium">{item.quantityReceived}</td>
                                            <td className="px-4 py-3 text-center text-amber-600 font-bold">{pending}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={pending}
                                                        value={inputValue}
                                                        onChange={(e) => handleQuantityChange(item._id || item.item, e.target.value)}
                                                        placeholder="Qty"
                                                        className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-green-500 outline-none"
                                                    />
                                                    <span className="text-gray-400 text-xs">{item.unit}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {challan.items.every(i => i.status === 'Completed') && (
                        <div className="text-center py-8 text-green-600 font-medium">
                            All items have been received for this challan.
                        </div>
                    )}

                    <div className="mt-6 flex justify-end gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading || receiveData.length === 0}
                            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 shadow-sm"
                        >
                            <Check size={18} />
                            {loading ? 'Processing...' : 'Confirm Receipt'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
