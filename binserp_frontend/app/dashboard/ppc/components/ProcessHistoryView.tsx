import React from 'react';
import {
    CheckCircle2,
    Clock,
    AlertTriangle,
    ArrowLeft,
    MessageSquare,
    Activity
} from 'lucide-react';

interface ProcessStep {
    operationName: string;
    sequence: number;
    status: 'Pending' | 'InProgress' | 'Completed';
    startTime?: string;
    endTime?: string;
    issues?: { description: string; reportedBy: string; createdAt: string }[];
    feedback?: string;
}

interface ProcessHistoryViewProps {
    job: any; // Full Job Object
    onBack: () => void;
}

export default function ProcessHistoryView({ job, onBack }: ProcessHistoryViewProps) {
    // Mock Data if processHistory is empty (for visualization until backend populates)
    const history: ProcessStep[] = job.processHistory && job.processHistory.length > 0
        ? job.processHistory
        : [
            { operationName: "Cutting", sequence: 1, status: "Completed", startTime: "2024-01-20T10:00:00", endTime: "2024-01-20T11:30:00" },
            { operationName: "Milling", sequence: 2, status: "InProgress", startTime: "2024-01-20T12:00:00", issues: [{ description: "Tool vibration detected", reportedBy: "Op-1", createdAt: "2024-01-20T12:15:00" }] },
            { operationName: "Drilling", sequence: 3, status: "Pending" }
        ];

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
                    <h3 className="text-lg font-bold text-gray-900">{job.jobNumber}</h3>
                    <p className="text-sm text-gray-500">Live Process Timeline</p>
                </div>
                <div className="ml-auto flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                    <Activity size={14} />
                    Live
                </div>
            </div>

            <div className="relative pl-8 space-y-8 before:absolute before:left-3.5 before:top-2 before:bottom-0 before:w-0.5 before:bg-gray-200">
                {history.map((step, idx) => (
                    <div key={idx} className="relative">
                        {/* Status Dot */}
                        <div className={`absolute -left-[1.85rem] top-1 w-7 h-7 rounded-full border-4 border-white flex items-center justify-center shadow-sm ${step.status === 'Completed' ? 'bg-green-500' :
                                step.status === 'InProgress' ? 'bg-blue-500 animate-pulse' :
                                    'bg-gray-200'
                            }`}>
                            {step.status === 'Completed' && <CheckCircle2 size={14} className="text-white" />}
                            {step.status === 'InProgress' && <Clock size={14} className="text-white" />}
                        </div>

                        {/* Content Card */}
                        <div className={`p-4 rounded-xl border ${step.status === 'InProgress' ? 'bg-blue-50/50 border-blue-100' : 'bg-white border-gray-100 shadow-sm'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-semibold text-gray-900">{step.operationName}</h4>
                                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${step.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                        step.status === 'InProgress' ? 'bg-blue-100 text-blue-700' :
                                            'bg-gray-100 text-gray-500'
                                    }`}>
                                    {step.status}
                                </span>
                            </div>

                            {/* Times */}
                            {(step.startTime || step.endTime) && (
                                <div className="text-xs text-gray-500 mb-3 flex gap-4">
                                    {step.startTime && <span>Started: {new Date(step.startTime).toLocaleTimeString()}</span>}
                                    {step.endTime && <span>Ended: {new Date(step.endTime).toLocaleTimeString()}</span>}
                                </div>
                            )}

                            {/* Issues Section */}
                            {step.issues && step.issues.length > 0 && (
                                <div className="mt-3 bg-red-50 p-3 rounded-lg border border-red-100">
                                    <h5 className="text-xs font-bold text-red-800 flex items-center gap-1.5 mb-2">
                                        <AlertTriangle size={12} />
                                        Reported Issues
                                    </h5>
                                    <ul className="space-y-2">
                                        {step.issues.map((issue, i) => (
                                            <li key={i} className="text-xs text-red-700">
                                                <span className="font-medium">[{issue.reportedBy}]:</span> {issue.description}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Feedback Section */}
                            {step.feedback && (
                                <div className="mt-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                    <h5 className="text-xs font-bold text-gray-700 flex items-center gap-1.5 mb-1">
                                        <MessageSquare size={12} />
                                        Operator Feedback
                                    </h5>
                                    <p className="text-xs text-gray-600 italic">"{step.feedback}"</p>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
