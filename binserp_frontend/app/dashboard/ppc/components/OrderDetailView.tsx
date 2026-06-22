"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, ChevronRight, Package, Calendar, User, Truck, FileText } from "lucide-react";
import { API_BASE_URL } from "@/src/utils/config";
import JobDetailView from "./JobDetailView";

interface OrderDetailViewProps {
    orderId: string;
    onBack: () => void;
}

export default function OrderDetailView({ orderId, onBack }: OrderDetailViewProps) {
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

    useEffect(() => {
        const fetchOrder = async () => {
            try {
                const token = localStorage.getItem("token");
                const res = await fetch(`${API_BASE_URL}/api/ppc/order/${orderId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (!res.ok) throw new Error("Failed to fetch order");
                const data = await res.json();
                console.log("OrderDetailView Fetched Data:", data);
                console.log("data.order:", data.order);
                console.log("data itself:", data);

                // Try different response structures
                const fetchedOrder = data.order || data;
                console.log("Final order to set:", fetchedOrder);

                setOrder(fetchedOrder);
                setLoading(false);
            } catch (err: any) {
                setError(err.message);
                setLoading(false);
            }
        };

        if (orderId) fetchOrder();
    }, [orderId]);

    if (loading) return <div className="p-8 text-center text-2xl font-bold bg-blue-500 text-white">LOADING ORDER DETAILS...</div>;
    if (error) return <div className="p-8 text-center text-2xl font-bold bg-red-500 text-white">ERROR: {error}</div>;
    if (!order) return <div className="p-8 text-center text-2xl font-bold bg-orange-500 text-white">NO ORDER DATA</div>;

    // If a product is selected, show JobDetailView for that product (Level 3)
    if (selectedProduct) {
        return (
            <JobDetailView
                // We pass the "order" context but filtered for this product's jobs
                // JobDetailView expects "order" prop but uses order.jobs.
                // We construct a pseudo-order object containing only relevant jobs
                order={{
                    ...order,
                    productName: selectedProduct.componentName, // Show component Name in header
                    quantity: selectedProduct.quantity,
                    jobs: order.jobs.filter((j: any) => j.masterProduct === selectedProduct._id || j.partName === selectedProduct.componentName)
                }}
                onBack={() => setSelectedProduct(null)}
                onSelectJob={(job) => {
                    // Propagate up or handle View 4 here? 
                    // Ideally JobDetailView handles the drill down to ProcessHistory or passes it up.
                    // IMPORTANT: JobDetailView current implementation just selects a job.
                    // We need to decide where ProcessHistoryView lives.
                    // Let's assume JobDetailView has an `onSelectJob` that we can use to show ProcessHistory 
                    // OR JobDetailView handles showing ProcessHistory internally?
                    // Checking JobDetailView implementation... earlier user showed code.
                    // Currently checking `ProcessHistoryView` implementation plan.
                    // Let's pass the job up to a handler if needed or let JobDetailView evolve.
                    console.log("Job Selected", job);
                    // For now, let's just log. The earlier plan was Level 4.
                }}
            />
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4 p-1">
                {/* 
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 transition-colors"
                >
                    <ArrowLeft size={20} />
                </button> 
                */}
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Package className="text-indigo-600" />
                        {order.orderNumber}
                        <span className={`text-sm px-3 py-1 rounded-full font-medium ${order.status === 'Completed' ? 'bg-green-100 text-green-700' :
                            order.status === 'InProgress' ? 'bg-blue-100 text-blue-700' :
                                'bg-amber-100 text-amber-700'
                            }`}>
                            {order.status}
                        </span>
                    </h2>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center gap-1.5"><User size={14} /> {order.customerName}</div>
                        <div className="flex items-center gap-1.5"><FileText size={14} /> PO: {order.poReference || "N/A"}</div>
                        <div className="flex items-center gap-1.5"><Calendar size={14} /> Due: {new Date(order.dispatchDate).toLocaleDateString()}</div>
                    </div>
                </div>
            </div>

            {/* Product List (Components) */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Order Items</h3>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {order.components && order.components.length > 0 ? (
                        order.components.map((comp: any) => (
                            <button
                                key={comp._id || comp.componentCode}
                                onClick={() => setSelectedProduct(comp)}
                                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                                        {comp.quantity}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                                            {comp.componentName}
                                        </p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                                            {comp.componentCode}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right hidden sm:block">
                                        <p className="text-xs text-gray-500 mb-1">Status</p>
                                        <span className="text-xs font-medium px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
                                            {comp.status || "Pending"}
                                        </span>
                                    </div>
                                    <ChevronRight size={20} className="text-gray-300 group-hover:text-indigo-600 transition-colors" />
                                </div>
                            </button>
                        ))
                    ) : (
                        <div className="p-8 text-center text-gray-500">
                            No product items found for this order.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
