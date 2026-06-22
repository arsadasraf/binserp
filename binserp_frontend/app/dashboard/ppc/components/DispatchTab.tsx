"use client";

import { useState } from "react";
import { Loader2, Truck, CheckCircle, PackageCheck, AlertCircle } from "lucide-react";
import { 
    useGetDispatchQueueQuery, 
    useConfirmDispatchMutation 
} from "@/src/store/services/ppcService";

export default function DispatchTab() {
    const { data: orders = [], isLoading: loading } = useGetDispatchQueueQuery();
    const [confirmDispatch] = useConfirmDispatchMutation();
    const [processing, setProcessing] = useState<string | null>(null);

    const handleDispatch = async (orderId: string) => {
        if (!confirm("Are you sure you want to mark this order as Dispatched? This will close the order.")) return;
        setProcessing(orderId);
        try {
            const res = await confirmDispatch({ orderId }).unwrap();
            alert("Order Dispatched Successfully");
        } catch (e: any) {
            console.error(e);
            alert(e?.data?.message || "Error dispatching order");
        } finally {
            setProcessing(null);
        }
    };

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-500" /></div>;

    return (
        <div className="space-y-6">
            {/* Header Card */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10">
                    <h2 className="text-blue-100 font-medium text-lg mb-2 flex items-center gap-2">
                        <Truck size={24} /> Dispatch Control
                    </h2>
                    <div className="text-4xl font-bold tracking-tight mb-2">
                        {orders.length} Orders Ready
                    </div>
                    <p className="text-blue-100/80">
                        Orders where all production jobs are completed and quality checked.
                    </p>
                </div>
                <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-10 translate-y-10">
                    <PackageCheck size={200} />
                </div>
            </div>

            {/* List */}
            <div className="grid gap-4">
                {orders.length === 0 ? (
                    <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
                        <CheckCircle className="mx-auto text-green-500 mb-2" size={32} />
                        <h3 className="text-gray-900 dark:text-white font-medium">All Clear!</h3>
                        <p className="text-gray-500 text-sm">No orders currently pending dispatch.</p>
                    </div>
                ) : (
                    orders.map(order => (
                        <div key={order._id} className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 flex justify-between items-center group hover:border-blue-300 transition-colors">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{order.customerName}</h3>
                                    <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium border border-green-200">
                                        Ready to Ship
                                    </span>
                                </div>
                                <div className="text-gray-500 text-sm flex gap-4">
                                    <span>Order #: <span className="font-mono text-gray-700 dark:text-gray-300">{order.orderNumber}</span></span>
                                    <span>Part: <span className="font-medium text-gray-700 dark:text-gray-300">{order.productCode}</span></span>
                                    <span>Qty: <span className="font-medium text-gray-700 dark:text-gray-300">{order.quantity}</span></span>
                                </div>
                            </div>

                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <div className="text-xs text-gray-400">Total Produced</div>
                                    <div className="font-bold text-xl text-indigo-600">{order.totalProduced}</div>
                                </div>

                                <button
                                    onClick={() => handleDispatch(order._id)}
                                    disabled={processing === order._id}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium shadow-md transition-all flex items-center gap-2"
                                >
                                    {processing === order._id ? <Loader2 className="animate-spin" size={18} /> : <Truck size={18} />}
                                    Dispatch Order
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
