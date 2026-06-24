import React, { useState } from 'react';
import { 
  useGetProductionOrdersQuery, 
  useAutoScheduleMutation 
} from "@/src/store/services/ppcService";
import { ClipboardList, Sliders, Calendar } from 'lucide-react';
import MachineAssignmentBoard from './MachineAssignmentBoard';
import PlanningBoard from './PlanningBoard';

type PlanningSubTab = "auto" | "board" | "assignments";

export default function PPCPlanningTab() {
  const [subTab, setSubTab] = useState<PlanningSubTab>("assignments");
  const [schedulingId, setSchedulingId] = useState<string | null>(null);

  const { data: allOrders = [], isLoading: loading } = useGetProductionOrdersQuery();
  const [autoSchedule] = useAutoScheduleMutation();

  const pendingOrders = allOrders.filter((o: any) => o.status === "Pending" || o.status === "Planning");

  const handleAutoPlan = async (orderId: string) => {
    setSchedulingId(orderId);
    try {
      const res = await autoSchedule({ orderId }).unwrap();
      alert("Order scheduled successfully!");
      setSubTab("board");
    } catch (e: any) {
      console.error(e);
      alert(e?.data?.message || "Error scheduling order");
    } finally {
      setSchedulingId(null);
    }
  };

  const tabs = [
    { id: "assignments" as PlanningSubTab, label: "Assignments",   icon: ClipboardList },
    { id: "auto"        as PlanningSubTab, label: "Auto-Planning", icon: Sliders },
    { id: "board"       as PlanningSubTab, label: "Planning Board",icon: Calendar },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Tab strip */}
      <div className="flex gap-2 flex-wrap items-center bg-white dark:bg-gray-900 p-1.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 w-fit">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 ${
              subTab === id
                ? "bg-indigo-600 text-white shadow-md"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800"
            }`}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-4 sm:p-6">

        {/* ASSIGNMENTS TAB */}
        {subTab === "assignments" && <MachineAssignmentBoard />}

        {/* AUTO-PLANNING TAB */}
        {subTab === "auto" && (
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">Auto-Schedule Orders</h3>
            <p className="text-sm text-gray-500 mb-6">
              Select an order to automatically assign machine and manpower resources based on raw material availability and process constraints.
            </p>
            {loading ? (
              <div className="py-8 text-center text-gray-500">Loading orders...</div>
            ) : pendingOrders.length === 0 ? (
              <div className="py-8 text-center bg-gray-50 dark:bg-gray-800 rounded-xl text-gray-500">
                No pending orders for planning.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border rounded-xl overflow-hidden">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 font-medium border-b">
                    <tr>
                      <th className="px-4 py-3">Order #</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Target Date</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {pendingOrders.map(o => (
                      <tr key={o._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{o.orderNumber}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{o.customerName}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                          {o.dispatchDate ? new Date(o.dispatchDate).toLocaleDateString() : "N/A"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleAutoPlan(o._id)}
                            disabled={schedulingId === o._id}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                          >
                            {schedulingId === o._id ? "Planning..." : "Auto Plan"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* PLANNING BOARD TAB */}
        {subTab === "board" && (
          <div className="min-h-[600px]">
            <PlanningBoard />
          </div>
        )}
      </div>
    </div>
  );
}
