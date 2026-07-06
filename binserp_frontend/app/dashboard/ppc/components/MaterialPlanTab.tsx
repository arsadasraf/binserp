import { Loader2, AlertTriangle, CheckCircle, Package } from 'lucide-react';
import { 
    useGetMaterialPlanQuery, 
    useUpdateMaterialRequirementStatusMutation 
} from "@/src/store/services/ppcService";
import { useCreateStoreRecordMutation } from "@/src/store/services/storeService";

export default function MaterialPlanTab({ orderId }: { orderId: string }) {
    const { data: plan, isLoading: loading } = useGetMaterialPlanQuery(orderId);
    const [createMaterialRequest] = useCreateStoreRecordMutation();
    const [updateStatus] = useUpdateMaterialRequirementStatusMutation();


    if (loading) return <div className="flex-1 flex items-center justify-center min-h-[300px]"><Loader2 className="animate-spin text-indigo-500" /></div>;

    if (!plan || !plan.items || plan.items.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] text-gray-500">
                <Package size={48} className="mb-4 opacity-20" />
                <p>No Material Plan generated yet.</p>
                <p className="text-xs mt-2">Confirm the order to generate plan.</p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto w-full p-0 bg-gray-50 dark:bg-gray-900/50">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 font-medium sticky top-0 border-b border-gray-200 dark:border-gray-700 z-10">
                    <tr>
                        <th className="px-6 py-3">Material</th>
                        <th className="px-6 py-3 text-right">Required</th>
                        <th className="px-6 py-3 text-right">Stock</th>
                        <th className="px-6 py-3 text-right">Shortage</th>
                        <th className="px-6 py-3">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                    {plan.items.map((item: any, idx: number) => {
                        const hasShortage = item.shortage > 0;
                        return (
                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                    {item.materialName}
                                    <div className="text-xs text-gray-400 font-normal">{item.unit}</div>
                                </td>
                                <td className="px-6 py-4 text-right">{item.requiredQuantity}</td>
                                <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">{item.stockAvailable}</td>
                                <td className={`px-6 py-4 text-right font-bold ${hasShortage ? 'text-red-500' : 'text-green-500'}`}>
                                    {item.shortage}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.status === 'Fulfilled' ? 'bg-green-100 text-green-700' :
                                                item.status === 'PR Raised' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-red-100 text-red-700'
                                            }`}>
                                            {item.status}
                                        </span>
                                        {hasShortage && item.status !== 'PR Raised' && item.status !== 'Fulfilled' && (
                                            <button
                                                onClick={async () => {
                                                    if (!confirm(`Raise Purchase Request for ${item.shortage} ${item.unit} of ${item.materialName}?`)) return;
                                                    try {
                                                        const extractId = (val: any) => (typeof val === 'object' && val !== null) ? (val._id || val.id) : val;
                                                        
                                                        const prRes = await createMaterialRequest({
                                                            tab: 'material-request',
                                                            body: {
                                                                type: item.component ? 'inhouse' : 'bo',
                                                                items: [{
                                                                    material: extractId(item.material),
                                                                    component: extractId(item.component),
                                                                    materialName: item.materialName,
                                                                    quantity: item.shortage,
                                                                    unit: item.unit,
                                                                    purpose: `Production Order #${orderId}`
                                                                }],
                                                                priority: "High"
                                                            }
                                                        }).unwrap();

                                                        await updateStatus({
                                                            planId: plan._id,
                                                            itemId: item._id,
                                                            body: { status: 'PR Raised' }
                                                        }).unwrap();

                                                        alert("PR Raised Successfully");
                                                    } catch (e: any) {
                                                        const errStr = JSON.stringify(e, Object.getOwnPropertyNames(e));
                                                        console.error("PR creation error:", errStr);
                                                        const errMsg = e?.data?.message || e?.message || e?.error || errStr;
                                                        alert(`PR Failed: ${errMsg}`);
                                                    }
                                                }}
                                                className="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2 py-1.5 rounded border border-indigo-200 transition-colors"
                                            >
                                                Raise PR
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
