"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Package, Sparkles, Boxes, History, Plus } from 'lucide-react';
import { 
  useGetStoreDataQuery, 
  useCreateStoreRecordMutation 
} from '@/src/store/services/storeService';
import { useGetPpcComponentsQuery } from '@/src/store/services/ppcService';
import MaterialRequestModal from '@/src/features/store/components/modals/MaterialRequestModal';

export default function MaterialRequestsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [token, setToken] = useState<string | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setToken(localStorage.getItem("token"));
    }
  }, []);

  const { data: materialRequests = [] } = useGetStoreDataQuery('material-request', { skip: !token });
  const { data: materialIssues = [] } = useGetStoreDataQuery('material-issue', { skip: !token });
  const { data: materialsData = [] } = useGetStoreDataQuery('rm-bo-item', { skip: !token });
  const { data: consumablesData = [] } = useGetStoreDataQuery('consumable-item', { skip: !token });
  const { data: inventoryData = [] } = useGetStoreDataQuery('inventory', { skip: !token });
  const { data: inHouseComponents = [] } = useGetPpcComponentsQuery({ isInventoryItem: false }, { skip: !token });

  const [createRecord, { isLoading: isCreating }] = useCreateStoreRecordMutation();

  // Compute pending counts per category
  const pendingRequests = (materialRequests as any[]).filter((r: any) => r.status === 'Pending' || r.status === 'Approved');
  
  const rmBoPendingCount = pendingRequests.filter((r: any) => 
    r.type === 'bo' || r.type === 'rm-bo' || (!r.type && r.type !== 'consumable' && r.type !== 'inhouse')
  ).length;

  const consumablePendingCount = pendingRequests.filter((r: any) => 
    r.type === 'consumable'
  ).length;

  const fgPendingCount = pendingRequests.filter((r: any) => 
    r.type === 'inhouse' || r.type === 'fg'
  ).length;

  const historyCount = (materialIssues as any[]).length;

  const requestTabs = [
    { 
      name: 'RM / BO Requests', 
      href: '/dashboard/store/wip/requests/rm-bo', 
      icon: Package, 
      count: rmBoPendingCount,
      color: 'blue'
    },
    { 
      name: 'Consumables Requests', 
      href: '/dashboard/store/wip/requests/consumables', 
      icon: Sparkles, 
      count: consumablePendingCount,
      color: 'amber'
    },
    { 
      name: 'FG / In-House Requests', 
      href: '/dashboard/store/wip/requests/fg', 
      icon: Boxes, 
      count: fgPendingCount,
      color: 'purple'
    },
    { 
      name: 'Issue History', 
      href: '/dashboard/store/wip/requests/history', 
      icon: History, 
      count: historyCount,
      color: 'slate'
    },
  ];

  const getDefaultType = () => {
    if (pathname.includes('/consumables')) return 'consumable';
    if (pathname.includes('/fg')) return 'inhouse';
    return 'bo';
  };

  const handleCreateRequest = async (formData: any) => {
    try {
      await createRecord({ tab: 'material-request' as any, body: formData }).unwrap();
      setIsRequestModalOpen(false);
    } catch (error) {
      console.error("Create request failed", error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Category Sub-Tabs with Notification Badges & New Request Button on Right Side */}
      <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl gap-1 overflow-x-auto no-scrollbar flex-1 sm:flex-none">
          {requestTabs.map((tab) => {
            const isActive = pathname === tab.href || (pathname === '/dashboard/store/wip/requests' && tab.href.endsWith('/rm-bo'));
            const Icon = tab.icon;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-200 dark:shadow-none'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700/50'
                }`}
              >
                <Icon size={15} />
                <span>{tab.name}</span>
                {tab.count > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : tab.color === 'amber'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : tab.color === 'purple'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                        : tab.color === 'blue'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Right Side: + New Request Button */}
        <div className="flex items-center gap-3 px-1 justify-end">
          <button
            onClick={() => setIsRequestModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg hover:shadow-blue-200 dark:hover:shadow-none transition-all font-bold text-xs active:scale-95 shadow-sm shrink-0"
          >
            <Plus size={16} />
            <span>New Request</span>
          </button>
        </div>
      </div>

      {/* Nested Page Content */}
      <div>
        {children}
      </div>

      {/* Shared Material Request Modal */}
      <MaterialRequestModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        onSubmit={handleCreateRequest}
        materials={materialsData}
        consumables={consumablesData}
        inventoryList={inventoryData}
        inHouseComponents={inHouseComponents}
        loading={isCreating}
        defaultType={getDefaultType()}
      />
    </div>
  );
}
