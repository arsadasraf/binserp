import React from 'react';
import {
    ArrowLeft,
    ChevronRight,
    Hash,
    Monitor
} from 'lucide-react';

import ProcessHistoryView from './ProcessHistoryView';

interface JobDetailViewProps {
    order: any; // Full Order Object (populated with jobs)
    onBack: () => void;
    onSelectJob: (job: any) => void;
}

export default function JobDetailView({ order, onBack, onSelectJob }: JobDetailViewProps) {
    const jobs = order.jobs || [];
    const [selectedJobForGeneric, setSelectedJobForGeneric] = React.useState<any>(null);

    if (selectedJobForGeneric) {
        return (
            <ProcessHistoryView
                job={selectedJobForGeneric}
                onBack={() => setSelectedJobForGeneric(null)}
            />
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h3 className="text-lg font-bold text-gray-900">{order.productName}</h3>
                    <p className="text-sm text-gray-500">Unit List - {order.quantity} Items</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-2">
                {jobs.length === 0 ? (
                    <p className="text-center py-8 text-gray-500 italic">No job units generated yet.</p>
                ) : (
                    jobs.map((job: any, idx: number) => (
                        <button
                            key={idx}
                            onClick={() => setSelectedJobForGeneric(job)}
                            className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-xl hover:border-indigo-500 hover:shadow-md transition-all group text-left"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                                    #{job.index || idx + 1}
                                </div>
                                <div>
                                    <p className="font-mono text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                                        {job.jobNumber}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${job.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                            job.status === 'InProgress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            {job.status}
                                        </span>
                                        {job.assignedMachine && (
                                            <span className="flex items-center gap-1 text-[10px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                                                <Monitor size={10} />
                                                {job.assignedMachine.machineName}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <ChevronRight size={18} className="text-gray-300 group-hover:text-indigo-600 transition-colors" />
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}
