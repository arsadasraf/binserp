import React from 'react';
import { Plus } from 'lucide-react';
import LoadingSpinner from '@/src/components/LoadingSpinner';

interface PendingProductsTableProps {
    data: any[];
    loading: boolean;
    onAdd: (item: any) => void;
}

export default function PendingProductsTable({ data, loading, onAdd }: PendingProductsTableProps) {
    if (loading) return <div className="p-8 flex justify-center"><LoadingSpinner /></div>;
    if (!data || data.length === 0) return <div className="p-8 text-center text-gray-500">No pending products found.</div>;

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800/50">
                    <tr>
                        <th className="px-6 py-3 font-medium">Code</th>
                        <th className="px-6 py-3 font-medium">Name</th>
                        <th className="px-6 py-3 font-medium">Type</th>
                        <th className="px-6 py-3 font-medium">Unit</th>
                        <th className="px-6 py-3 font-medium text-right">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {data.map((item) => (
                        <tr key={item._id} className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            <td className="px-6 py-4 font-mono text-gray-600 dark:text-gray-400">{item.componentCode}</td>
                            <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{item.componentName}</td>
                            <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{item.type}</td>
                            <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{item.unit}</td>
                            <td className="px-6 py-4 text-right">
                                <button
                                    onClick={() => onAdd(item)}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 rounded-lg transition-colors"
                                >
                                    <Plus size={14} />
                                    Add to Inventory
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
