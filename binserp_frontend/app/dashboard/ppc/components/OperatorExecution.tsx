"use client";

import { useState } from "react";
import { Play, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { 
    useGetMachinesQuery, 
    useGetMachineScheduleQuery, 
    useStartJobProcessMutation, 
    useCompleteJobProcessMutation 
} from "@/src/store/services/ppcService";

export default function OperatorExecution() {
    const [selectedMachine, setSelectedMachine] = useState("");
    const { data: machines = [] } = useGetMachinesQuery();
    const { data: scheduleData, isFetching: loading } = useGetMachineScheduleQuery(
        { machineId: selectedMachine }, 
        { skip: !selectedMachine }
    );
    const tasks = scheduleData?.assignments || [];

    const [startProcess] = useStartJobProcessMutation();
    const [completeProcess] = useCompleteJobProcessMutation();


    const handleStart = async (task: any) => {
        try {
            await startProcess({ jobId: task.jobId, processId: task._id }).unwrap();
        } catch (e: any) { 
            console.error(e);
            alert(e?.data?.message || "Failed to start"); 
        }
    };

    const handleComplete = async (task: any) => {
        const qty = prompt("Enter Produced Quantity:", "1");
        if (!qty) return;

        try {
            const res = await completeProcess({
                jobId: task.jobId,
                processId: task._id,
                producedQty: Number(qty),
                rejectedQty: 0
            }).unwrap();
            
            if (res.message?.includes("QC")) alert("Job Sent for QC Inspection!");
        } catch (e: any) { 
            console.error(e);
            alert(e?.data?.message || "Failed to complete"); 
        }
    };

    return (
        <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100 min-h-[500px]">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">Operator Console</h2>
                <select
                    value={selectedMachine}
                    onChange={(e) => setSelectedMachine(e.target.value)}
                    className="p-2 border rounded-lg bg-gray-50 font-medium"
                >
                    <option value="">Select Machine Station...</option>
                    {machines.map((m: any) => <option key={m._id} value={m._id}>{m.machineName} ({m.machineCode})</option>)}
                </select>
            </div>

            {loading ? (
                <div className="text-center py-10 text-gray-500">Loading schedule...</div>
            ) : !selectedMachine ? (
                <div className="text-center py-10 text-gray-400">Select a machine to view assigned tasks</div>
            ) : tasks.length === 0 ? (
                <div className="text-center py-10 text-gray-400">No scheduled tasks for this machine</div>
            ) : (
                <div className="grid gap-4">
                    {tasks.map((task: any) => (
                        <div key={task._id} className="border rounded-xl p-4 flex justify-between items-center hover:shadow-md transition-all">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${task.status === 'InProgress' ? 'bg-blue-100 text-blue-700' :
                                            task.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                                task.status === 'QC_Pending' ? 'bg-yellow-100 text-yellow-700' :
                                                    'bg-gray-100 text-gray-600'
                                        }`}>
                                        {task.status}
                                    </span>
                                    <span className="font-mono text-gray-500 text-xs">#{task.jobNumber}</span>
                                </div>
                                <h3 className="font-bold text-gray-800">{task.partName} - {task.processName}</h3>
                                <div className="text-xs text-gray-500 mt-1">
                                    {new Date(task.start).toLocaleTimeString()} - {new Date(task.end).toLocaleTimeString()}
                                </div>
                            </div>

                            <div className="flex gap-2">
                                {task.status === 'Scheduled' && (
                                    <button
                                        onClick={() => handleStart(task)}
                                        className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700"
                                    >
                                        <Play size={16} /> Start
                                    </button>
                                )}
                                {task.status === 'InProgress' && (
                                    <button
                                        onClick={() => handleComplete(task)}
                                        className="flex items-center gap-1 bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700"
                                    >
                                        <CheckCircle size={16} /> Complete
                                    </button>
                                )}
                                {task.status === 'QC_Pending' && (
                                    <div className="flex items-center gap-1 text-yellow-600 bg-yellow-50 px-3 py-1.5 rounded-lg border border-yellow-200">
                                        <AlertTriangle size={16} />
                                        Waiting for QC
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
