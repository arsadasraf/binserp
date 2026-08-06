import React from 'react';
import { X, Calendar, User, FileText } from 'lucide-react';

interface MaterialRequestDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    request: any;
}

export default function MaterialRequestDetailsModal({ isOpen, onClose, request }: MaterialRequestDetailsModalProps) {
    if (!isOpen || !request) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-xl">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50/50 sticky top-0 z-10 backdrop-blur-md">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-bold text-gray-800">Request Details</h2>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold
                                ${request.status === 'Approved' ? 'bg-green-100 text-green-700' :
                                    request.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                                        request.status === 'Issued' ? 'bg-purple-100 text-purple-700' :
                                            'bg-yellow-100 text-yellow-700'}`}>
                                {request.status}
                            </span>
                        </div>
                        <p className="text-gray-500 text-sm mt-1">{request.requestNumber}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Metadata Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-wider font-semibold mb-1">
                                <Calendar size={14} /> Created Date
                            </div>
                            <div className="text-gray-900 font-medium">
                                {new Date(request.createdAt).toLocaleDateString()}
                            </div>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-wider font-semibold mb-1">
                                <User size={14} /> Requested By
                            </div>
                            <div className="text-gray-900 font-medium truncate" title={request.requestedBy?.name || 'Unknown'}>
                                {request.requestedBy?.name || 'Unknown'}
                            </div>
                        </div>
                        {/* Removed Department & Priority from display as per user request */}
                    </div>

                    {/* Items List */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <FileText size={16} className="text-blue-500" />
                            Requested Materials
                        </h3>
                        <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold text-gray-700">Material</th>
                                        <th className="px-4 py-3 font-semibold text-gray-700 text-center">Qty</th>
                                        <th className="px-4 py-3 font-semibold text-gray-700">Purpose</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {request.items.map((item: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-gray-900">{item.materialName}</div>
                                                <div className="text-xs text-gray-500 font-mono">{item.materialCode}</div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="font-semibold text-gray-900">{item.quantity}</span>
                                                <span className="text-xs text-gray-500 ml-1">{item.unit}</span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 truncate max-w-[200px]" title={item.purpose}>
                                                {item.purpose || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl flex justify-end sticky bottom-0 backdrop-blur-md">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white border border-gray-300 shadow-sm text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
