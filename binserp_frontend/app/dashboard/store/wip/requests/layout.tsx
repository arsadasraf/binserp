"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Layers, ShoppingCart, Package, Boxes, History, Plus } from 'lucide-react';
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
  const { data: rawMaterialsData = [] } = useGetStoreDataQuery('raw-material', { skip: !token });
  const { data: boughtOutsData = [] } = useGetStoreDataQuery('bought-out', { skip: !token });
  const { data: materialsData = [] } = useGetStoreDataQuery('rm-bo-item', { skip: !token });
  const { data: consumablesData = [] } = useGetStoreDataQuery('consumable-item', { skip: !token });
  const { data: fgItemsData = [] } = useGetStoreDataQuery('fg-item', { skip: !token });
  const { data: inventoryData = [] } = useGetStoreDataQuery('inventory', { skip: !token });
  const { data: inHouseComponents = [] } = useGetPpcComponentsQuery({ isInventoryItem: false }, { skip: !token });

  const [createRecord, { isLoading: isCreating }] = useCreateStoreRecordMutation();

  // Compute pending counts per individual category
  const pendingRequests = (materialRequests as any[]).filter((r: any) => r.status === 'Pending' || r.status === 'Approved');
  
  const rmPendingCount = pendingRequests.filter((r: any) => {
    const t = (r.type || 'rm').toLowerCase();
    return t === 'rm' || t === 'raw-material';
  }).length;

  const boPendingCount = pendingRequests.filter((r: any) => {
    const t = (r.type || '').toLowerCase();
    return t === 'bo' || t === 'bought-out';
  }).length;

  const consumablePendingCount = pendingRequests.filter((r: any) => 
    (r.type || '').toLowerCase() === 'consumable'
  ).length;

  const fgPendingCount = pendingRequests.filter((r: any) => {
    const t = (r.type || '').toLowerCase();
    return t === 'inhouse' || t === 'fg';
  }).length;

  const historyCount = (materialIssues as any[]).length;

  const requestTabs = [
    { 
      name: 'RM Requests', 
      href: '/dashboard/store/wip/requests/rm', 
      icon: Layers, 
      count: rmPendingCount,
      color: 'blue'
    },
    { 
      name: 'BO Requests', 
      href: '/dashboard/store/wip/requests/bo', 
      icon: ShoppingCart, 
      count: boPendingCount,
      color: 'emerald'
    },
    { 
      name: 'Consumables Requests', 
      href: '/dashboard/store/wip/requests/consumables', 
      icon: Package, 
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
    if (pathname.includes('/bo')) return 'bo';
    return 'rm';
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
            const isActive = pathname === tab.href || (pathname === '/dashboard/store/wip/requests' && tab.href.endsWith('/rm')) || (pathname === '/dashboard/store/wip/requests/rm-bo' && tab.href.endsWith('/rm'));
            const Icon = tab.icon;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Icon size={14} className={isActive ? (
                  tab.color === 'blue' ? 'text-blue-600' :
                  tab.color === 'emerald' ? 'text-emerald-600' :
                  tab.color === 'amber' ? 'text-amber-500' :
                  tab.color === 'purple' ? 'text-purple-600' : 'text-slate-600'
                ) : 'text-slate-400'} />
                <span>{tab.name}</span>
                {tab.count > 0 && (
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-black rounded-full leading-none transition-colors ${
                      isActive
                        ? (tab.color === 'blue' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300' :
                           tab.color === 'emerald' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300' :
                           tab.color === 'amber' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300' :
                           tab.color === 'purple' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300' :
                           'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300')
                        : 'bg-slate-200/70 text-slate-500 dark:bg-slate-700/60 dark:text-slate-400'
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
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg hover:shadow-blue-200 dark:hover:shadow-none transition-all font-bold text-xs active:scale-95 shadow-sm shrink-0 cursor-pointer"
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
        rawMaterials={rawMaterialsData}
        boughtOuts={boughtOutsData}
        materials={materialsData}
        consumables={consumablesData}
        fgItems={fgItemsData}
        inventoryList={inventoryData}
        inHouseComponents={inHouseComponents}
        loading={isCreating}
        defaultType={getDefaultType() as any}
      />
    </div>
  );
}
