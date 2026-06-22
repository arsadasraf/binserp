import { Loader2, Cog, AlertCircle } from 'lucide-react';
import { useGetJobsByOrderQuery } from "@/src/store/services/ppcService";

export default function ProductionJobsTab({ orderId }: { orderId: string }) {
    const { data: jobs = [], isLoading: loading } = useGetJobsByOrderQuery(orderId);


    if (loading) return <div className="flex-1 flex items-center justify-center min-h-[300px]"><Loader2 className="animate-spin text-indigo-500" /></div>;

    if (jobs.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] text-gray-500">
                <Cog size={48} className="mb-4 opacity-20" />
                <p>No Jobs generated yet.</p>
                <p className="text-xs mt-2">Confirm the order to generate production jobs.</p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto w-full p-0 bg-gray-50 dark:bg-gray-900/50">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 font-medium sticky top-0 border-b border-gray-200 dark:border-gray-700 z-10">
                    <tr>
                        <th className="px-6 py-3">Job Number</th>
                        <th className="px-6 py-3">Part Name</th>
                        <th className="px-6 py-3 text-right">Qty</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3">Current Process</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                    {jobs.map((job: any, idx: number) => {
                        const currentProcess = job.processHistory.find((p: any) => p.status === 'InProgress') ||
                            job.processHistory.find((p: any) => p.status === 'Pending');

                        return (
                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                    {job.jobNumber}
                                </td>
                                <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                                    {job.partName}
                                </td>
                                <td className="px-6 py-4 text-right">{job.quantity}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${job.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                            job.status === 'InProgress' ? 'bg-blue-100 text-blue-700' :
                                                'bg-gray-100 text-gray-700'
                                        }`}>
                                        {job.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-xs text-gray-500">
                                    {currentProcess ? `${currentProcess.operationName} (${currentProcess.status})` : 'Buffered'}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
