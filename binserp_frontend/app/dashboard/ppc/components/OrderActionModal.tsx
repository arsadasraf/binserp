import React from 'react';
import { X } from 'lucide-react';
import OrderDetailView from './OrderDetailView';

interface OrderActionModalProps {
    order: any;
    isOpen: boolean;
    onClose: () => void;
    onUpdateStatus: (id: string, status: string) => void;
}

export default function OrderActionModal({ order, isOpen, onClose }: OrderActionModalProps) {
    if (!isOpen || !order) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200">
                {/* Close Button Top Right */}
                <div className="absolute top-4 right-4 z-10">
                    <button
                        onClick={onClose}
                        className="p-2 bg-white/90 hover:bg-gray-100 rounded-full transition-colors text-gray-500 shadow-sm border border-gray-100"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content Area */}
                <div className="p-6 overflow-y-auto flex-1 bg-gray-50/30">
                    <OrderDetailView
                        orderId={order._id}
                        onBack={onClose}
                    />
                </div>
            </div>
        </div>
    );
}
