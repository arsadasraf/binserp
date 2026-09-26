"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Layers, ShoppingCart, Package, Boxes, History, Plus, LayoutGrid } from 'lucide-react';
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
  
  const allPendingCount = pendingRequests.length;

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
      name: 'All Requests', 
      href: '/dashboard/store/wip/requests/all', 
      icon: LayoutGrid, 
      count: allPendingCount,
      color: 'indigo',
      checkActive: (path: string) => 
        path === '/dashboard/store/wip/requests/all' || 
        path === '/dashboard/store/wip/requests' || 
        path.startsWith('/dashboard/store/wip/requests/rm') ||
        path.startsWith('/dashboard/store/wip/requests/bo') ||
        path.startsWith('/dashboard/store/wip/requests/consumables') ||
        path.startsWith('/dashboard/store/wip/requests/fg')
    },
    { 
      name: 'Issue History', 
      href: '/dashboard/store/wip/requests/history', 
      icon: History, 
      count: historyCount,
      color: 'slate',
      checkActive: (path: string) => path === '/dashboard/store/wip/requests/history'
    },
  ];

  const getDefaultType = () => {
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
    <div className="space-y-4 pb-20 sm:pb-0">
      {/* Two Main Tabs Header (Mobile App-Like Segmented Control) */}
      <div className="bg-white dark:bg-slate-900 p-1.5 sm:p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-3">
        {/* Mobile Full-Width 2-Segment Control / Desktop Tab Switcher */}
        <div className="grid grid-cols-2 sm:flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1 w-full sm:w-auto">
          {requestTabs.map((tab) => {
            const isActive = tab.checkActive(pathname);
            const Icon = tab.icon;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center justify-center gap-2 px-4 py-2 sm:py-2.5 rounded-lg text-xs font-bold transition-all text-center whitespace-nowrap active:scale-[0.98] ${
                  isActive
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Icon size={15} className={isActive ? (
                  tab.color === 'indigo' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'
                ) : 'text-slate-400'} />
                <span>{tab.name}</span>
                {tab.count > 0 && (
                  <span
                    className={`px-2 py-0.5 text-[10px] font-black rounded-full leading-none transition-colors ${
                      isActive
                        ? (tab.color === 'indigo' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300' :
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

        {/* Right Side: + New Request Button (Desktop) */}
        <div className="hidden sm:flex items-center gap-3 px-1 justify-end">
          <button
            onClick={() => setIsRequestModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg hover:shadow-blue-200 dark:hover:shadow-none transition-all font-bold text-xs active:scale-95 shadow-sm shrink-0 cursor-pointer"
          >
            <Plus size={16} />
            <span>New Request</span>
          </button>
        </div>
      </div>

      {/* Floating Action Button (FAB) for Mobile App Feel */}
      <div className="sm:hidden fixed bottom-5 right-4 z-40">
        <button
          onClick={() => setIsRequestModalOpen(true)}
          className="flex items-center gap-2 px-5 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-xl shadow-blue-500/30 hover:shadow-blue-500/50 transition-all font-extrabold text-xs active:scale-90 cursor-pointer"
        >
          <Plus size={18} strokeWidth={2.5} />
          <span>New Request</span>
        </button>
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
