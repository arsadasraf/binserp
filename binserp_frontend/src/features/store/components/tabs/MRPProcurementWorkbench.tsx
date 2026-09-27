import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShoppingCart, RefreshCw, AlertTriangle, CheckCircle2, 
  Layers, Filter, Search, ArrowRight, ArrowLeft, Building2, Truck, 
  Plus, CheckSquare, Square, ChevronDown, ChevronRight, ChevronLeft,
  TrendingDown, FileText, Sparkles, Send, Boxes, GitBranch,
  Factory, Package, Check, Eye, Clock, Calendar, Download, Printer, Tag, X, RotateCcw
} from 'lucide-react';
import { apiGet, apiPost, apiPut, apiPatch } from '@/src/lib/api';
import { generateNestedBOMPDF } from '@/src/utils/generateNestedBOMPDF';
import ConvertToPurchaseBucketModal from '@/src/features/store/components/modals/ConvertToPurchaseBucketModal';
import Swal from 'sweetalert2';

interface MRPProcurementWorkbenchProps {
  token: string;
  onOpenRfqModal?: (items: any[]) => void;
  onOpenPoModal?: (initialData: any) => void;
  onRefreshPlans?: () => void;
}

const STATUS_OPTIONS = [
  'Pending',
  'Raised RFQ',
  'PO Sent',
  'Material Received',
  'Issued for Production',
  'Completed'
];

const PLANNING_STATUS_OPTIONS = [
  { id: 'not_planned', label: 'Not Planned (Pending Purchase)', icon: AlertTriangle, color: 'text-rose-500' },
  { id: 'in_purchase_bucket', label: 'In Purchase Bucket (Converted)', icon: Boxes, color: 'text-indigo-600' },
  { id: 'in_procurement', label: 'In Procurement / PO Sent', icon: Truck, color: 'text-blue-500' },
  { id: 'stock_covered', label: 'Stock Covered', icon: CheckCircle2, color: 'text-emerald-500' },
  { id: 'completed', label: 'Completed', icon: Check, color: 'text-slate-400' },
];

export default function MRPProcurementWorkbench({
  token,
  onOpenRfqModal,
  onOpenPoModal,
  onRefreshPlans
}: MRPProcurementWorkbenchProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<'nested-tree' | 'consolidated-types'>('nested-tree');
  const [workbenchViewMode, setWorkbenchViewMode] = useState<'plans' | 'items'>('plans');
  const [activeTypeTab, setActiveTypeTab] = useState<'rm' | 'bo' | 'component' | 'subassembly' | 'assembly'>('rm');
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyShortages, setOnlyShortages] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedVendorFilter, setSelectedVendorFilter] = useState<string>('all');
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState<string>('all');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  // Filter Tab 1: Planning Status Multi-Select State
  const [selectedPlanningStatuses, setSelectedPlanningStatuses] = useState<string[]>([]);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  // Filter Tab 2: Plan Date Filter State (Created / Plan Date)
  const [planDateFilter, setPlanDateFilter] = useState<'all' | 'today' | 'yesterday' | '7days' | 'thisMonth' | 'custom'>('all');
  const [planStartDate, setPlanStartDate] = useState<string>('');
  const [planEndDate, setPlanEndDate] = useState<string>('');
  const [isPlanDateDropdownOpen, setIsPlanDateDropdownOpen] = useState(false);
  const planDateDropdownRef = useRef<HTMLDivElement>(null);

  // Filter Tab 3: Target / Due Date Filter State (Target / Delivery Date)
  const [targetDateFilter, setTargetDateFilter] = useState<'all' | 'today' | 'yesterday' | '7days' | 'next7days' | 'thisMonth' | 'custom'>('all');
  const [targetStartDate, setTargetStartDate] = useState<string>('');
  const [targetEndDate, setTargetEndDate] = useState<string>('');
  const [isTargetDateDropdownOpen, setIsTargetDateDropdownOpen] = useState(false);
  const targetDateDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(target)) {
        setIsStatusDropdownOpen(false);
      }
      if (planDateDropdownRef.current && !planDateDropdownRef.current.contains(target)) {
        setIsPlanDateDropdownOpen(false);
      }
      if (targetDateDropdownRef.current && !targetDateDropdownRef.current.contains(target)) {
        setIsTargetDateDropdownOpen(false);
      }
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(target)) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [submittingPO, setSubmittingPO] = useState(false);
  const [submittingPPC, setSubmittingPPC] = useState(false);

  // Purchase Bucket State (Mapping BOM cut sizes to standard commercial purchasable items)
  const [procurementSubView, setProcurementSubView] = useState<'cut_sizes' | 'purchase_buckets'>('cut_sizes');
  const [bucketModalItem, setBucketModalItem] = useState<any | null>(null);
  const [bucketModalItems, setBucketModalItems] = useState<any[] | null>(null);
  const [expandedBucketIds, setExpandedBucketIds] = useState<Set<string>>(new Set());

  // Tab scrolling ref & handler for Type Switcher Tabs
  const typeTabsRef = useRef<HTMLDivElement>(null);
  const scrollTypeTabs = (direction: 'left' | 'right') => {
    if (typeTabsRef.current) {
      const scrollAmount = direction === 'left' ? -220 : 220;
      typeTabsRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };
  const [companyInfo, setCompanyInfo] = useState<any>(null);

  const fetchWorkbenchData = async (planId?: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const url = planId 
        ? `/api/purchase/mrp/procurement-workbench?mrpId=${planId}`
        : '/api/purchase/mrp/procurement-workbench';
      const [res, compRes] = await Promise.all([
        apiGet(url, token),
        apiGet('/api/store/company-info', token).catch(() => null)
      ]);

      if (res?.data) {
        setData(res.data);
        if (planId) {
          const found = (res.data.mrpTreeList || []).find((p: any) => p._id === planId);
          if (found) setSelectedPlan(found);
        }
      }
      if (compRes) {
        setCompanyInfo(compRes.companyInfo || compRes);
      } else {
        try {
          const raw = localStorage.getItem("companyInfo") || localStorage.getItem("company");
          if (raw) setCompanyInfo(JSON.parse(raw));
        } catch (e) {}
      }
    } catch (err: any) {
      console.error("Failed to load MRP Procurement Workbench:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkbenchData();
  }, [token]);

  const mrpTreeList = data?.mrpTreeList || [];
  const classifiedLists = data?.classifiedLists || {
    rmList: [],
    boList: [],
    componentList: [],
    subAssemblyList: [],
    assemblyList: []
  };

  const totalWorkbenchMaterialsCount = useMemo(() => {
    return (
      (classifiedLists.rmList?.length || 0) +
      (classifiedLists.boList?.length || 0) +
      (classifiedLists.componentList?.length || 0) +
      (classifiedLists.subAssemblyList?.length || 0) +
      (classifiedLists.assemblyList?.length || 0)
    );
  }, [classifiedLists]);

  // Extract Unique Customers across all active MRP plans
  const availableCustomers = useMemo(() => {
    const custSet = new Set<string>();
    (mrpTreeList || []).forEach((plan: any) => {
      if (plan.customerName && plan.customerName !== 'Internal Demand') {
        custSet.add(plan.customerName.trim());
      }
      if (Array.isArray(plan.customerPOs)) {
        plan.customerPOs.forEach((cpo: any) => {
          if (cpo.customerName) custSet.add(cpo.customerName.trim());
        });
      }
    });
    return Array.from(custSet).filter(Boolean).sort();
  }, [mrpTreeList]);

  // Unified Date preset matching helper
  const matchDatePreset = (
    rawDate: any,
    preset: string = 'all',
    customStart?: string,
    customEnd?: string
  ) => {
    if (!preset || preset === 'all') return true;
    if (!rawDate) return false;
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return false;

    const today = new Date();
    const isSameDay = (d1: Date, d2: Date) =>
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();

    if (preset === 'today') {
      return isSameDay(d, today);
    } else if (preset === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      return isSameDay(d, yesterday);
    } else if (preset === '7days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(today.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      return d >= sevenDaysAgo && d <= today;
    } else if (preset === 'next7days') {
      const nextSevenDays = new Date();
      nextSevenDays.setDate(today.getDate() + 7);
      nextSevenDays.setHours(23, 59, 59, 999);
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      return d >= startOfToday && d <= nextSevenDays;
    } else if (preset === 'thisMonth') {
      return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    } else if (preset === 'custom') {
      if (customStart && customEnd) {
        const s = new Date(customStart);
        s.setHours(0, 0, 0, 0);
        const e = new Date(customEnd);
        e.setHours(23, 59, 59, 999);
        return d >= s && d <= e;
      } else if (customStart) {
        const s = new Date(customStart);
        return isSameDay(d, s) || d >= s;
      } else if (customEnd) {
        const e = new Date(customEnd);
        return isSameDay(d, e) || d <= e;
      }
    }
    return true;
  };

  // Helper function to format preset button label
  const formatPresetLabel = (preset: string, start?: string, end?: string) => {
    if (preset === 'custom') {
      if (start && end) return `${start} → ${end}`;
      if (start) return `From ${start}`;
      if (end) return `Until ${end}`;
      return 'Custom';
    }
    switch (preset) {
      case 'today': return 'Today';
      case 'yesterday': return 'Yesterday';
      case '7days': return 'Last 7 Days';
      case 'next7days': return 'Next 7 Days';
      case 'thisMonth': return 'This Month';
      case 'all':
      default:
        return 'All';
    }
  };

  // Live Status Counts across active MRP Plans
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      not_planned: 0,
      in_procurement: 0,
      stock_covered: 0,
      completed: 0
    };
    (mrpTreeList || []).forEach((plan: any) => {
      const status = plan.planPlanningStatus || 
        (plan.planTotalShortages === 0 ? 'Stock Covered' : (plan.planTotalInTransit >= plan.planTotalShortages ? 'PO In-Transit' : 'Not Planned'));
      if (status === 'Not Planned' || status === 'Partially Planned') counts.not_planned++;
      if (status === 'PO In-Transit' || status === 'Partially Planned' || status === 'In Procurement') counts.in_procurement++;
      if (status === 'Stock Covered') counts.stock_covered++;
      if (status === 'Completed' || plan.status === 'Completed') counts.completed++;
    });
    return counts;
  }, [mrpTreeList]);

  // Filtered MRP list for the initial selection view (Plans)
  const filteredMrpList = useMemo(() => {
    return (mrpTreeList || []).filter((plan: any) => {
      // 1. Plan Date Filter (Created / Plan Date)
      const rawPlanDate = plan.createdAt || plan.planDate || plan.date;
      if (!matchDatePreset(rawPlanDate, planDateFilter, planStartDate, planEndDate)) {
        return false;
      }

      // 2. Target Date Filter (Due / Delivery / Target Date)
      const rawTargetDate = plan.targetDate || plan.deliveryDate;
      if (!matchDatePreset(rawTargetDate, targetDateFilter, targetStartDate, targetEndDate)) {
        return false;
      }

      // 3. Search Term
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const matchesSearch =
          (plan.mrpNumber && plan.mrpNumber.toLowerCase().includes(s)) ||
          (plan.customerName && plan.customerName.toLowerCase().includes(s)) ||
          (plan.customerPoNumber && plan.customerPoNumber.toLowerCase().includes(s)) ||
          (Array.isArray(plan.fgItems) && plan.fgItems.some((fg: any) => 
            (fg.fgItemName && fg.fgItemName.toLowerCase().includes(s)) ||
            (fg.description && fg.description.toLowerCase().includes(s))
          ));
        if (!matchesSearch) return false;
      }

      // 4. Customer Filter
      if (selectedCustomerFilter !== 'all') {
        const planCust = (plan.customerName || '').toLowerCase();
        const targetCust = selectedCustomerFilter.toLowerCase();
        const hasMatchingCPO = Array.isArray(plan.customerPOs) && 
          plan.customerPOs.some((cpo: any) => (cpo.customerName || '').toLowerCase().includes(targetCust));
        if (!planCust.includes(targetCust) && !hasMatchingCPO) return false;
      }

      // 5. Material Planning Status Filter (Multi-select)
      if (selectedPlanningStatuses.length > 0) {
        const status = plan.planPlanningStatus || 
          (plan.planTotalShortages === 0 ? 'Stock Covered' : (plan.planTotalInTransit >= plan.planTotalShortages ? 'PO In-Transit' : 'Not Planned'));
        
        const matchesAny = selectedPlanningStatuses.some(st => {
          if (st === 'not_planned') return status === 'Not Planned' || status === 'Partially Planned';
          if (st === 'in_procurement') return status === 'PO In-Transit' || status === 'Partially Planned' || status === 'In Procurement';
          if (st === 'stock_covered') return status === 'Stock Covered';
          if (st === 'completed') return status === 'Completed' || plan.status === 'Completed';
          return false;
        });
        if (!matchesAny) return false;
      }

      // 6. Shortages Only Toggle
      if (onlyShortages && plan.planTotalShortages <= 0) {
        return false;
      }

      return true;
    });
  }, [
    mrpTreeList, searchTerm,
    planDateFilter, planStartDate, planEndDate,
    targetDateFilter, targetStartDate, targetEndDate,
    selectedCustomerFilter, selectedPlanningStatuses, onlyShortages
  ]);

  // Active items for classification view inside selected MRP
  const currentTypeList = useMemo(() => {
    switch (activeTypeTab) {
      case 'rm': return classifiedLists.rmList || [];
      case 'bo': return classifiedLists.boList || [];
      case 'component': return classifiedLists.componentList || [];
      case 'subassembly': return classifiedLists.subAssemblyList || [];
      case 'assembly': return classifiedLists.assemblyList || [];
      default: return classifiedLists.rmList || [];
    }
  }, [classifiedLists, activeTypeTab]);

  // Available categories for active type tab
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    (currentTypeList || []).forEach((it: any) => {
      if (it.category) cats.add(it.category.trim());
    });
    return Array.from(cats).filter(Boolean).sort();
  }, [currentTypeList]);

  // Available vendors for active type tab
  const availableVendors = useMemo(() => {
    const map = new Map<string, { id: string; name: string; isPreferred?: boolean; count: number }>();
    (currentTypeList || []).forEach((it: any) => {
      const v = it.bestVendor;
      if (v?.vendorId || v?.vendorName) {
        const id = v.vendorId ? String(v.vendorId) : v.vendorName;
        if (!map.has(id)) {
          map.set(id, {
            id,
            name: v.vendorName || "Vendor",
            isPreferred: Boolean(v.isPreferred),
            count: 0
          });
        }
        const entry = map.get(id)!;
        entry.count += 1;
        if (v.isPreferred) entry.isPreferred = true;
      }
    });
    return Array.from(map.values()).sort((a, b) => (b.isPreferred ? 1 : 0) - (a.isPreferred ? 1 : 0) || a.name.localeCompare(b.name));
  }, [currentTypeList]);

  const filteredConsolidatedList = useMemo(() => {
    return currentTypeList.filter((item: any) => {
      // 1. Search Query
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const matchesSearch =
          (item.materialName && item.materialName.toLowerCase().includes(s)) ||
          (item.description && item.description.toLowerCase().includes(s)) ||
          (item.materialCode && item.materialCode.toLowerCase().includes(s)) ||
          (item.category && item.category.toLowerCase().includes(s)) ||
          (item.bestVendor?.vendorName && item.bestVendor.vendorName.toLowerCase().includes(s)) ||
          (Array.isArray(item.mrpSources) && item.mrpSources.some((src: any) =>
            (src.mrpNumber && src.mrpNumber.toLowerCase().includes(s)) ||
            (src.customerName && src.customerName.toLowerCase().includes(s)) ||
            (src.customerPoNumber && src.customerPoNumber.toLowerCase().includes(s))
          ));
        if (!matchesSearch) return false;
      }

      // 2. Shortages Toggle
      if (onlyShortages && item.netShortage <= 0) return false;
      
      // 3. Category Filter
      if (selectedCategoryFilter !== 'all' && item.category !== selectedCategoryFilter) return false;
      
      // 4. Vendor Filter
      if (selectedVendorFilter === 'preferred_only') {
        if (!item.bestVendor?.isPreferred) return false;
      } else if (selectedVendorFilter !== 'all') {
        const vId = item.bestVendor?.vendorId ? String(item.bestVendor.vendorId) : item.bestVendor?.vendorName;
        if (vId !== selectedVendorFilter) return false;
      }

      // 5. Date Filter (Plan Date vs Target Date)
      // 5. Plan Date Filter
      if (planDateFilter !== 'all' || planStartDate || planEndDate) {
        const rawPlanDate = item.latestPlanDate || item.mrpSources?.[0]?.planDate || item.mrpSources?.[0]?.createdAt;
        if (!matchDatePreset(rawPlanDate, planDateFilter, planStartDate, planEndDate)) return false;
      }

      // 6. Target Date Filter
      if (targetDateFilter !== 'all' || targetStartDate || targetEndDate) {
        const rawTargetDate = item.earliestTargetDate || item.mrpSources?.[0]?.targetDate;
        if (!matchDatePreset(rawTargetDate, targetDateFilter, targetStartDate, targetEndDate)) return false;
      }

      // 7. Customer Filter
      if (selectedCustomerFilter !== 'all') {
        const targetCust = selectedCustomerFilter.toLowerCase();
        const matchesCust =
          (Array.isArray(item.customerNames) && item.customerNames.some((c: string) => c.toLowerCase().includes(targetCust))) ||
          (Array.isArray(item.mrpSources) && item.mrpSources.some((src: any) => (src.customerName || '').toLowerCase().includes(targetCust)));
        if (!matchesCust) return false;
      }

      // 8. Material Planning Status Filter (Multi-select)
      if (selectedPlanningStatuses.length > 0) {
        const pStatus = item.materialPlanningStatus || (item.netShortage === 0 ? 'Stock Covered' : 'Not Planned');
        const matchesAny = selectedPlanningStatuses.some(st => {
          if (st === 'not_planned') return pStatus === 'Not Planned' || pStatus === 'Pending';
          if (st === 'in_purchase_bucket') return Boolean(item.purchaseBucket) || pStatus === 'In Purchase Bucket' || pStatus.includes('Converted');
          if (st === 'in_procurement') return ['PO Sent', 'Raised RFQ', 'PO In-Transit', 'Partially In-Transit'].includes(pStatus);
          if (st === 'stock_covered') return pStatus === 'Stock Covered' || item.netShortage === 0;
          if (st === 'completed') return pStatus === 'Completed';
          return false;
        });
        if (!matchesAny) return false;
      }

      return true;
    });
  }, [
    currentTypeList,
    searchTerm,
    onlyShortages,
    selectedCategoryFilter,
    selectedVendorFilter,
    planDateFilter,
    planStartDate,
    planEndDate,
    targetDateFilter,
    targetStartDate,
    targetEndDate,
    selectedCustomerFilter,
    selectedPlanningStatuses
  ]);

  const isAnyFilterActive = useMemo(() => {
    return (
      selectedPlanningStatuses.length > 0 ||
      planDateFilter !== 'all' ||
      Boolean(planStartDate || planEndDate) ||
      targetDateFilter !== 'all' ||
      Boolean(targetStartDate || targetEndDate) ||
      selectedCustomerFilter !== 'all' ||
      selectedCategoryFilter !== 'all' ||
      selectedVendorFilter !== 'all' ||
      onlyShortages ||
      Boolean(searchTerm)
    );
  }, [
    selectedPlanningStatuses,
    planDateFilter, planStartDate, planEndDate,
    targetDateFilter, targetStartDate, targetEndDate,
    selectedCustomerFilter, selectedCategoryFilter, selectedVendorFilter,
    onlyShortages, searchTerm
  ]);

  const handleResetAllFilters = () => {
    setSelectedPlanningStatuses([]);
    setPlanDateFilter('all');
    setPlanStartDate('');
    setPlanEndDate('');
    setTargetDateFilter('all');
    setTargetStartDate('');
    setTargetEndDate('');
    setSelectedCustomerFilter('all');
    setSelectedCategoryFilter('all');
    setSelectedVendorFilter('all');
    setOnlyShortages(false);
    setSearchTerm('');
    setSelectedKeys(new Set());
  };

  // Selection toggle (Exclusively in Types Classification View)
  const toggleSelect = (key: string) => {
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedKeys(next);
  };

  // Whether active view is showing purchase buckets (only for RM and BO)
  const isBucketSubView = (activeTypeTab === 'rm' || activeTypeTab === 'bo') && procurementSubView === 'purchase_buckets';

  // Derived purchase buckets from API data for RM or BO
  const currentBuckets = useMemo(() => {
    if (activeTypeTab === 'rm') {
      return data?.purchaseBuckets?.rmBuckets || [];
    }
    if (activeTypeTab === 'bo') {
      return data?.purchaseBuckets?.boBuckets || [];
    }
    return [];
  }, [data?.purchaseBuckets, activeTypeTab]);

  // Filtered purchase buckets according to search, vendor, and shortages
  const filteredBuckets = useMemo(() => {
    return currentBuckets.filter((bucket: any) => {
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const match =
          (bucket.targetPurchaseItemName && bucket.targetPurchaseItemName.toLowerCase().includes(s)) ||
          (bucket.targetPurchaseItemDescription && bucket.targetPurchaseItemDescription.toLowerCase().includes(s)) ||
          (bucket.targetPurchaseItemCategory && bucket.targetPurchaseItemCategory.toLowerCase().includes(s)) ||
          (bucket.sourceCutSizes && bucket.sourceCutSizes.some((cs: any) => cs.sourceItemName?.toLowerCase().includes(s)));
        if (!match) return false;
      }
      if (selectedVendorFilter && selectedVendorFilter !== 'all') {
        if (selectedVendorFilter === 'preferred_only') {
          if (!bucket.bestVendor?.isPreferred) return false;
        } else {
          if (String(bucket.bestVendor?.vendorId) !== selectedVendorFilter) return false;
        }
      }
      if (onlyShortages && bucket.netShortage <= 0) {
        return false;
      }
      return true;
    });
  }, [currentBuckets, searchTerm, selectedVendorFilter, onlyShortages]);

  const toggleSelectAll = () => {
    if (isBucketSubView) {
      if (selectedKeys.size === filteredBuckets.length && filteredBuckets.length > 0) {
        setSelectedKeys(new Set());
      } else {
        setSelectedKeys(new Set(filteredBuckets.map((b: any, bIdx: number) => b.bucketKey || `bucket_${b.targetPurchaseItemId || bIdx}`)));
      }
      return;
    }

    if (selectedKeys.size === filteredConsolidatedList.length && filteredConsolidatedList.length > 0) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(filteredConsolidatedList.map((i: any, idx: number) => i.materialKey || i.materialId || i._id || `mat_row_${idx}`)));
    }
  };

  const toggleExpandNode = (nodeKey: string) => {
    const next = new Set(expandedNodes);
    if (next.has(nodeKey)) next.delete(nodeKey);
    else next.add(nodeKey);
    setExpandedNodes(next);
  };

  // Reusable Dual-Unit Display Helper Function
  const renderDualUnitQty = (
    qty: number,
    primaryUnit: string = 'PCS',
    item?: any,
    options?: {
      align?: 'center' | 'left' | 'right';
      isShortage?: boolean;
      isInTransit?: boolean;
      isPerFG?: boolean;
      fontClass?: string;
    }
  ) => {
    const isDual = Boolean(item?.hasSecondaryUnit && item?.secondaryUnit && Number(item?.conversionFactor) > 0);
    const convFactor = Number(item?.conversionFactor) || 1;
    const secondaryQty = isDual
      ? parseFloat((qty * convFactor).toFixed(3))
      : null;

    const alignClass = 
      options?.align === 'left' ? 'items-start text-left' :
      options?.align === 'right' ? 'items-end text-right' :
      'items-center text-center';

    if (options?.isShortage) {
      if (qty <= 0) {
        return (
          <div className="flex flex-col items-center">
            <span className="text-emerald-600 font-bold text-[11px]">Covered</span>
          </div>
        );
      }
      return (
        <div className="flex flex-col items-center">
          <span className="font-black text-rose-600 bg-rose-50 dark:bg-rose-950/80 px-2 py-0.5 rounded text-[11px] whitespace-nowrap">
            {qty.toLocaleString('en-IN')} {primaryUnit}
          </span>
          {isDual && secondaryQty !== null && (
            <span className="text-[10px] font-semibold text-rose-500/90 dark:text-rose-400 mt-0.5 whitespace-nowrap">
              ({secondaryQty.toLocaleString('en-IN')} {item.secondaryUnit})
            </span>
          )}
        </div>
      );
    }

    if (options?.isInTransit) {
      if (qty <= 0) {
        return <span className="text-slate-300">-</span>;
      }
      return (
        <div className="flex flex-col items-center">
          <span className="font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/80 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap">
            {qty.toLocaleString('en-IN')} {primaryUnit}
          </span>
          {isDual && secondaryQty !== null && (
            <span className="text-[9px] font-semibold text-blue-500/90 dark:text-blue-400 mt-0.5 whitespace-nowrap">
              ({secondaryQty.toLocaleString('en-IN')} {item.secondaryUnit})
            </span>
          )}
        </div>
      );
    }

    const defaultFont = options?.fontClass || 'font-bold text-slate-800 dark:text-slate-200';

    return (
      <div className={`flex flex-col ${alignClass}`}>
        <span className={`${defaultFont} whitespace-nowrap`}>
          {qty.toLocaleString('en-IN')} {primaryUnit}
        </span>
        {isDual && secondaryQty !== null && (
          <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-0.5 whitespace-nowrap">
            ({secondaryQty.toLocaleString('en-IN')} {item.secondaryUnit})
          </span>
        )}
      </div>
    );
  };

  const selectedItems = useMemo(() => {
    if (isBucketSubView) {
      return filteredBuckets
        .filter((b: any, bIdx: number) => {
          const bKey = b.bucketKey || `bucket_${b.targetPurchaseItemId || bIdx}`;
          return selectedKeys.has(bKey);
        })
        .map((b: any, bIdx: number) => {
          const bKey = b.bucketKey || `bucket_${b.targetPurchaseItemId || bIdx}`;
          const cutSizes = b.sourceCutSizes || b.mappedItems || [];
          const cutSizeNames = cutSizes.map((cs: any) => `${cs.sourceItemName} (${cs.grossRequired} ${b.unit})`).join(', ') || '';
          const bName = b.targetPurchaseItemName || b.materialName || 'Commercial Purchase Item';
          const bDesc = b.targetPurchaseItemDescription || b.description || '';
          const bCat = b.targetPurchaseItemCategory || b.category || '';
          return {
            materialId: b.targetPurchaseItemId || b.materialId,
            materialKey: bKey,
            materialName: bName,
            materialCode: b.targetPurchaseItemCode || b.materialCode || '',
            description: bDesc,
            category: bCat,
            itemType: activeTypeTab,
            unit: b.unit,
            hasSecondaryUnit: Boolean(b.hasSecondaryUnit && b.secondaryUnit),
            secondaryUnit: b.secondaryUnit || '',
            conversionFactor: Number(b.conversionFactor) || 1,
            grossRequired: b.grossRequired,
            secondaryGrossRequired: b.secondaryGrossRequired,
            currentPhysicalStock: b.currentPhysicalStock,
            secondaryCurrentPhysicalStock: b.secondaryCurrentPhysicalStock,
            totalInTransitPO: b.totalInTransitPO,
            secondaryTotalInTransitPO: b.secondaryTotalInTransitPO,
            netShortage: b.netShortage,
            secondaryNetShortage: b.secondaryNetShortage,
            bestVendor: b.bestVendor,
            isBucket: true,
            sourceCutSizes: cutSizes,
            mrpSources: b.mrpSources,
            customPoDescription: `Purchase Bucket: ${bName}. Consolidated for ${cutSizes.length} cut size(s): ${cutSizeNames}`
          };
        });
    }
    return filteredConsolidatedList.filter((item: any, idx: number) => {
      const rowKey = item.materialKey || item.materialId || item._id || `mat_row_${idx}`;
      return selectedKeys.has(rowKey);
    });
  }, [isBucketSubView, filteredBuckets, filteredConsolidatedList, selectedKeys, activeTypeTab]);

  // PDF Export for Multi-Level Nested BOM Tree
  const handleExportBOMPDF = () => {
    if (!selectedPlan) return;
    generateNestedBOMPDF({
      mrpNumber: selectedPlan.mrpNumber,
      customerName: selectedPlan.customerName,
      customerPoNumber: selectedPlan.customerPoNumber,
      targetDate: selectedPlan.targetDate,
      status: selectedPlan.status,
      fgItems: selectedPlan.fgItems || [],
      companyInfo
    });
  };

  // Open Manual Outward PO Modal prefilled with selected items
  const handleOpenManualPO = () => {
    if (selectedItems.length === 0) {
      Swal.fire('No Items Selected', 'Please select items to create an Outward Purchase Order.', 'info');
      return;
    }

    if (onOpenPoModal) {
      const poItems = selectedItems.map((it: any) => {
        const qty = Number(it.netShortage || it.requiredQuantity || it.grossRequired) || 1;
        const rate = Number(it.bestVendor?.rate || it.estimatedRate || 0);
        const lineSub = qty * rate; // pure amount without tax

        // Resolve itemType
        let resolvedItemType: 'rm' | 'bo' | 'consumable' = 'rm';
        const rawType = (it.itemType || '').toLowerCase();
        if (rawType.includes('bo') || rawType.includes('bought')) {
          resolvedItemType = 'bo';
        } else if (rawType.includes('consumable')) {
          resolvedItemType = 'consumable';
        }

        const isDual = Boolean(it.hasSecondaryUnit && it.secondaryUnit);
        const convFactor = Number(it.conversionFactor) || 1;
        const secQty = isDual ? (Number(it.secondaryNetShortage || it.secondaryGrossRequired) || parseFloat((qty * convFactor).toFixed(3))) : undefined;

        return {
          material: it.materialId || '',
          materialName: it.materialName,
          materialCode: it.materialCode || '',
          itemType: resolvedItemType,
          category: it.category || '',
          quantity: qty,
          unit: it.unit || (resolvedItemType === 'rm' ? 'KG' : 'PCS'),
          hasSecondaryUnit: isDual,
          secondaryUnit: it.secondaryUnit || '',
          conversionFactor: convFactor,
          secondaryQuantity: secQty,
          rate: rate,
          amount: lineSub,
          description: it.customPoDescription || it.description || `MRP Requirement for ${it.mrpSources?.map((s: any) => s.mrpNumber).join(', ') || it.parentMRP || selectedPlan?.mrpNumber || 'MRP'}`
        };
      });

      const targetVendorId = (selectedVendorFilter && selectedVendorFilter !== 'all' && selectedVendorFilter !== 'preferred_only')
        ? selectedVendorFilter
        : (selectedItems.find((i: any) => i.bestVendor?.vendorId)?.bestVendor?.vendorId || '');

      onOpenPoModal({
        vendor: targetVendorId,
        items: poItems,
        mrpPlanId: selectedPlan?._id,
        mrpNumber: selectedPlan?.mrpNumber,
        selectedItemKeys: selectedItems.map((i: any) => i.materialKey),
        remarks: `Generated from MRP Procurement Workbench (${selectedPlan?.mrpNumber || 'MRP'}${selectedCategoryFilter !== 'all' ? ` - ${selectedCategoryFilter}` : ''})`
      });
    }
  };

  // 1-Click Auto PO generation
  const handleBulkGeneratePO = async () => {
    if (selectedItems.length === 0) {
      Swal.fire('No Items Selected', 'Please select material shortages to generate Purchase Orders.', 'info');
      return;
    }

    const unassigned = selectedItems.filter((i: any) => !i.bestVendor?.vendorId);
    if (unassigned.length > 0) {
      const result = await Swal.fire({
        title: 'Preferred Vendor Not Mapped',
        html: `<p class="text-xs text-slate-600 dark:text-slate-300"><b>${unassigned.length}</b> selected item(s) do not have a preferred vendor in price lists.<br/><br/>Would you like to open the <b>Outward PO Form</b> to select vendors manually, or create an <b>RFQ</b>?</p>`,
        icon: 'info',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonColor: '#059669',
        denyButtonColor: '#4f46e5',
        confirmButtonText: '📝 Open Outward PO Form',
        denyButtonText: '📑 Create Outward RFQ',
        cancelButtonText: 'Cancel'
      });

      if (result.isConfirmed) {
        handleOpenManualPO();
        return;
      } else if (result.isDenied) {
        handleCreateRFQ();
        return;
      } else {
        return;
      }
    }

    const confirm = await Swal.fire({
      title: 'Generate Consolidated POs?',
      html: `Generate Purchase Orders for <b>${selectedItems.length}</b> shortage item(s) grouped by preferred suppliers.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      confirmButtonText: '⚡ Generate POs'
    });

    if (!confirm.isConfirmed) return;

    setSubmittingPO(true);
    try {
      const payload = {
        items: selectedItems.map((it: any) => ({
          materialName: it.materialName,
          materialCode: it.materialCode,
          itemType: it.itemType,
          orderQuantity: it.netShortage || it.requiredQuantity,
          unit: it.unit,
          hasSecondaryUnit: Boolean(it.hasSecondaryUnit && it.secondaryUnit),
          secondaryUnit: it.secondaryUnit || '',
          conversionFactor: Number(it.conversionFactor) || 1,
          secondaryQuantity: it.hasSecondaryUnit ? (Number(it.secondaryNetShortage) || parseFloat(((it.netShortage || it.requiredQuantity) * (Number(it.conversionFactor) || 1)).toFixed(3))) : undefined,
          rate: it.bestVendor?.rate || it.estimatedRate || 0,
          vendorId: it.bestVendor?.vendorId,
          sourceMRPs: it.mrpSources?.map((s: any) => s.mrpNumber) || [it.parentMRP || selectedPlan?.mrpNumber]
        }))
      };

      const res = await apiPost('/api/purchase/mrp/bulk-generate-po', payload, token);
      Swal.fire({
        icon: 'success',
        title: 'Purchase Orders Created!',
        text: res.message || `Successfully created Purchase Order(s).`,
        timer: 3000
      });

      setSelectedKeys(new Set());
      if (selectedPlan) {
        fetchWorkbenchData(selectedPlan._id);
      } else {
        fetchWorkbenchData();
      }
      if (onRefreshPlans) onRefreshPlans();
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Failed to generate Purchase Orders', 'error');
    } finally {
      setSubmittingPO(false);
    }
  };

  // 1-Click RFQ generation
  const handleCreateRFQ = () => {
    if (selectedItems.length === 0) {
      Swal.fire('No Items Selected', 'Please select material shortages to create an RFQ.', 'info');
      return;
    }

    if (onOpenRfqModal) {
      const rfqItems = selectedItems.map((it: any) => ({
        materialName: it.materialName,
        materialCode: it.materialCode,
        category: it.category,
        itemType: (it.itemType || 'rm').toLowerCase(),
        requiredQuantity: it.netShortage || it.requiredQuantity || it.grossRequired,
        currentStock: it.currentPhysicalStock,
        shortage: it.netShortage || it.requiredQuantity || it.grossRequired,
        unit: it.unit,
        hasSecondaryUnit: Boolean(it.hasSecondaryUnit && it.secondaryUnit),
        secondaryUnit: it.secondaryUnit || '',
        conversionFactor: Number(it.conversionFactor) || 1,
        secondaryQuantity: it.hasSecondaryUnit ? (Number(it.secondaryNetShortage || it.secondaryGrossRequired) || parseFloat(((it.netShortage || it.requiredQuantity || it.grossRequired) * (Number(it.conversionFactor) || 1)).toFixed(3))) : undefined,
        description: it.customPoDescription || it.description || `Consolidated MRP Shortage (${it.mrpSources?.map((s: any) => s.mrpNumber).join(', ') || it.parentMRP || selectedPlan?.mrpNumber || ''})`
      }));
      onOpenRfqModal(rfqItems);
    }
  };

  // 1-Click Send to PPC Intake Bucket (for Components, Sub-Assemblies, Assemblies)
  const handleSendToPPC = async () => {
    if (selectedItems.length === 0) {
      Swal.fire('No Items Selected', 'Please select components or assemblies to send to PPC Order Intake.', 'info');
      return;
    }

    const confirm = await Swal.fire({
      title: 'Send to PPC Intake Bucket?',
      html: `Dispatch <b>${selectedItems.length}</b> component/assembly item(s) to <b>PPC Order Intake</b> for in-house shopfloor manufacturing and route card scheduling.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#7c3aed',
      confirmButtonText: '🏭 ⚡ Yes, Send to PPC'
    });

    if (!confirm.isConfirmed) return;

    setSubmittingPPC(true);
    try {
      const payload = {
        mrpPlanId: selectedPlan?._id,
        mrpNumber: selectedPlan?.mrpNumber,
        customerName: selectedPlan?.customerName,
        customerPoNumber: selectedPlan?.customerPoNumber,
        items: selectedItems.map((it: any) => ({
          materialName: it.materialName,
          materialCode: it.materialCode,
          itemType: it.itemType,
          quantity: it.netShortage || it.requiredQuantity,
          unit: it.unit,
          targetDate: selectedPlan?.targetDate
        }))
      };

      const res = await apiPost('/api/purchase/mrp/send-to-ppc', payload, token);
      Swal.fire({
        icon: 'success',
        title: 'Sent to PPC Intake Bucket!',
        text: res.message || `Dispatched to PPC Order Intake for shopfloor routing.`,
        timer: 3000
      });

      setSelectedKeys(new Set());
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Failed to dispatch to PPC', 'error');
    } finally {
      setSubmittingPPC(false);
    }
  };

  // Manual Status Update (Single or Bulk)
  const handleUpdateItemStatus = async (newStatus: string, specificItem?: any) => {
    if (!selectedPlan) return;
    const targetItems = specificItem ? [specificItem] : selectedItems;
    if (targetItems.length === 0) {
      Swal.fire('No Items Selected', 'Please select items to update status.', 'info');
      return;
    }

    try {
      const payload = {
        items: targetItems.map((i: any) => ({
          materialKey: i.materialKey,
          materialName: i.materialName,
          materialCode: i.materialCode,
          status: newStatus
        })),
        status: newStatus
      };

      await apiPut(`/api/purchase/mrp/plan/${selectedPlan._id}/item-status`, payload, token);
      
      // Update local state instantly for fast UX
      if (data?.classifiedLists) {
        const updateList = (list: any[]) =>
          (list || []).map((item: any) => {
            const isMatch = targetItems.some((ti: any) => ti.materialKey === item.materialKey);
            return isMatch ? { ...item, status: newStatus } : item;
          });

        setData((prev: any) => ({
          ...prev,
          classifiedLists: {
            rmList: updateList(prev?.classifiedLists?.rmList),
            boList: updateList(prev?.classifiedLists?.boList),
            componentList: updateList(prev?.classifiedLists?.componentList),
            subAssemblyList: updateList(prev?.classifiedLists?.subAssemblyList),
            assemblyList: updateList(prev?.classifiedLists?.assemblyList)
          }
        }));
      }

      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: `Status: "${newStatus}"`,
        showConfirmButton: false,
        timer: 2000
      });

      if (!specificItem) setSelectedKeys(new Set());
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Failed to update item status', 'error');
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Raised RFQ':
      case 'RFQ Raised':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300';
      case 'PO Sent':
      case 'PO Raised':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300';
      case 'Material Received':
        return 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-300';
      case 'Issued for Production':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-300';
      case 'Completed':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300';
      case 'Pending':
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300';
    }
  };

  const handleSelectPlan = (plan: any) => {
    setSelectedPlan(plan);
    setSelectedKeys(new Set());
    fetchWorkbenchData(plan._id);
  };

  const handleBackToList = () => {
    setSelectedPlan(null);
    setSelectedKeys(new Set());
    fetchWorkbenchData();
  };

  // Is active tab eligible for PPC dispatch
  const isPpcEligibleTab = activeTypeTab === 'component' || activeTypeTab === 'subassembly' || activeTypeTab === 'assembly';

  // Render Consolidated Types Classification View (Reusable for Single Plan and All Active Plans Consolidated)
  const renderTypesClassificationView = (isConsolidated: boolean = false) => (
    <div className="space-y-3">
      {/* Type Switcher Pills with Arrow Controls & Smooth Touch Scroll */}
      <div className="relative flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/60 shadow-2xs">
        {/* Left Scroll Chevron */}
        <button
          type="button"
          onClick={() => scrollTypeTabs('left')}
          className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white shrink-0 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          title="Scroll tabs left"
          aria-label="Scroll tabs left"
        >
          <ChevronLeft size={15} />
        </button>

        {/* Scrollable Tab Strip with Touch Pan & No Clipping */}
        <div
          ref={typeTabsRef}
          className="flex items-center gap-1 overflow-x-auto scroll-smooth touch-pan-x min-w-0 flex-1 py-0.5 px-1 no-scrollbar"
        >
          <button
            type="button"
            onClick={() => {
              setActiveTypeTab('rm');
              setSelectedCategoryFilter('all');
              setSelectedVendorFilter('all');
              setSelectedKeys(new Set());
            }}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap shrink-0 transition-all flex items-center gap-1.5 cursor-pointer text-xs font-bold ${
              activeTypeTab === 'rm'
                ? 'bg-white dark:bg-slate-900 text-cyan-600 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Package size={13} />
            <span>🔩 Raw Materials</span>
            <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
              activeTypeTab === 'rm' ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              {classifiedLists.rmList?.length || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTypeTab('bo');
              setSelectedCategoryFilter('all');
              setSelectedVendorFilter('all');
              setSelectedKeys(new Set());
            }}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap shrink-0 transition-all flex items-center gap-1.5 cursor-pointer text-xs font-bold ${
              activeTypeTab === 'bo'
                ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Boxes size={13} />
            <span>📦 Bought Out Items</span>
            <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
              activeTypeTab === 'bo' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              {classifiedLists.boList?.length || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTypeTab('component');
              setSelectedCategoryFilter('all');
              setSelectedVendorFilter('all');
              setSelectedKeys(new Set());
            }}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap shrink-0 transition-all flex items-center gap-1.5 cursor-pointer text-xs font-bold ${
              activeTypeTab === 'component'
                ? 'bg-white dark:bg-slate-900 text-purple-600 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Factory size={13} />
            <span>⚙️ Components</span>
            <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
              activeTypeTab === 'component' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              {classifiedLists.componentList?.length || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTypeTab('subassembly');
              setSelectedCategoryFilter('all');
              setSelectedVendorFilter('all');
              setSelectedKeys(new Set());
            }}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap shrink-0 transition-all flex items-center gap-1.5 cursor-pointer text-xs font-bold ${
              activeTypeTab === 'subassembly'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <GitBranch size={13} />
            <span>🧩 Sub-Assemblies</span>
            <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
              activeTypeTab === 'subassembly' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              {classifiedLists.subAssemblyList?.length || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTypeTab('assembly');
              setSelectedCategoryFilter('all');
              setSelectedVendorFilter('all');
              setSelectedKeys(new Set());
            }}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap shrink-0 transition-all flex items-center gap-1.5 cursor-pointer text-xs font-bold ${
              activeTypeTab === 'assembly'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <CheckCircle2 size={13} />
            <span>🏆 Assemblies</span>
            <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
              activeTypeTab === 'assembly' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              {classifiedLists.assemblyList?.length || 0}
            </span>
          </button>
        </div>

        {/* Right Scroll Chevron */}
        <button
          type="button"
          onClick={() => scrollTypeTabs('right')}
          className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white shrink-0 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          title="Scroll tabs right"
          aria-label="Scroll tabs right"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      {/* Sub-view Switcher for RM / BO: [📋 Cut Sizes / BOM Items] vs [📦 Purchase Buckets] */}
      {(activeTypeTab === 'rm' || activeTypeTab === 'bo') && (
        <div className="flex items-center justify-between flex-wrap gap-2 px-1">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/60 shadow-2xs">
            <button
              type="button"
              onClick={() => {
                setProcurementSubView('cut_sizes');
                setSelectedKeys(new Set());
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                procurementSubView === 'cut_sizes'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <span>📋 BOM Cut Sizes</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                procurementSubView === 'cut_sizes' ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200' : 'bg-slate-200/60 dark:bg-slate-700/60 text-slate-500'
              }`}>
                {currentTypeList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setProcurementSubView('purchase_buckets');
                setSelectedKeys(new Set());
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                procurementSubView === 'purchase_buckets'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400'
              }`}
              title="View consolidated commercial purchasable items"
            >
              <Boxes size={13} />
              <span>📦 Consolidated Purchase Buckets</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                procurementSubView === 'purchase_buckets' ? 'bg-white/20 text-white' : 'bg-slate-200/60 dark:bg-slate-700/60 text-slate-500'
              }`}>
                {currentBuckets.length}
              </span>
            </button>
          </div>

          {procurementSubView === 'purchase_buckets' && (
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Sparkles size={13} className="text-amber-500" />
              <span>Multiple BOM cut sizes mapped into standard purchasable item buckets for single RFQ / PO release</span>
            </div>
          )}
        </div>
      )}

      {/* Action Toolbar for Selected Items */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
        <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-start">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {selectedKeys.size} {isBucketSubView ? 'bucket(s)' : 'item(s)'} selected in {activeTypeTab.toUpperCase()}
            </span>
            <span className="text-xs font-semibold text-slate-400">
              ({isBucketSubView ? `${filteredBuckets.length} of ${currentBuckets.length} buckets` : `${filteredConsolidatedList.length} of ${currentTypeList.length} items`})
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (isBucketSubView) {
                const unplannedKeys = filteredBuckets
                  .filter((b: any) => b.netShortage > 0)
                  .map((b: any, bIdx: number) => b.bucketKey || `bucket_${b.targetPurchaseItemId || bIdx}`);
                setSelectedKeys(new Set(unplannedKeys));
              } else {
                const unplannedKeys = filteredConsolidatedList
                  .filter((i: any) => i.netShortage > 0 && (!i.materialPlanningStatus || i.materialPlanningStatus === 'Not Planned' || i.materialPlanningStatus === 'Pending'))
                  .map((i: any, idx: number) => i.materialKey || i.materialId || i._id || `mat_row_${idx}`);
                setSelectedKeys(new Set(unplannedKeys));
              }
            }}
            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-lg font-bold text-xs transition-all flex items-center gap-1 cursor-pointer shrink-0"
            title="Select all items with shortages where PO has not yet been raised"
          >
            <AlertTriangle size={11} className="text-amber-600" />
            <span>Select Unplanned Shortages</span>
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scroll-smooth touch-pan-x flex-nowrap sm:flex-wrap justify-start sm:justify-end no-scrollbar">
          
          {/* Manual Status Bulk Dropdown (Only for cut sizes / BOM items) */}
          {!isBucketSubView && (
            <div className="flex items-center shrink-0">
              <select
                disabled={selectedKeys.size === 0}
                onChange={(e) => {
                  if (e.target.value) {
                    handleUpdateItemStatus(e.target.value);
                    e.target.value = '';
                  }
                }}
                defaultValue=""
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs disabled:opacity-30 transition-all cursor-pointer outline-none border border-slate-200 dark:border-slate-700 shrink-0"
              >
                <option value="" disabled>🏷️ Set Status ({selectedKeys.size})</option>
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          )}

          {/* Common Purchasing Actions: RFQ & PO */}
          <button
            onClick={handleCreateRFQ}
            disabled={selectedKeys.size === 0}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs disabled:opacity-30 transition-all flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
          >
            <FileText size={12} />
            <span>Create RFQ ({selectedKeys.size})</span>
          </button>

          {/* Action: Send to Purchase Bucket (Only for RM & BO in Cut Sizes view) */}
          {(activeTypeTab === 'rm' || activeTypeTab === 'bo') && !isBucketSubView && (
            <button
              onClick={() => {
                if (selectedItems.length === 0) {
                  Swal.fire('No Items Selected', `Please select ${activeTypeTab.toUpperCase()} items to send to a Purchase Bucket.`, 'info');
                  return;
                }
                setBucketModalItems(selectedItems);
              }}
              disabled={selectedKeys.size === 0}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs disabled:opacity-30 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
              title={`Send ${selectedKeys.size} selected cut size(s) into a consolidated commercial purchase bucket`}
            >
              <Boxes size={13} />
              <span>📦 Send to Purchase Bucket ({selectedKeys.size})</span>
            </button>
          )}

          <button
            onClick={handleOpenManualPO}
            disabled={selectedKeys.size === 0}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs disabled:opacity-30 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
            title="Open Outward PO Form prefilled with selected items"
          >
            <ShoppingCart size={12} />
            <span>
              {selectedVendorFilter !== 'all' && selectedVendorFilter !== 'preferred_only'
                ? `📝 Release PO to ${availableVendors.find(v => v.id === selectedVendorFilter)?.name || 'Vendor'} (${selectedKeys.size})`
                : `📝 Create Outward PO (${selectedKeys.size})`}
            </span>
          </button>

          <button
            onClick={handleBulkGeneratePO}
            disabled={selectedKeys.size === 0 || submittingPO}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-bold text-xs rounded-xl shadow-xs disabled:opacity-30 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
            title="1-Click Auto Generate Purchase Orders grouped by vendor"
          >
            <Sparkles size={12} className="text-amber-400 dark:text-amber-600" />
            <span>{submittingPO ? "Generating..." : `⚡ Auto PO (${selectedKeys.size})`}</span>
          </button>

          {/* Dual Action: Send to PPC Intake Bucket (Only for Components, Sub-Assemblies, Assemblies) */}
          {isPpcEligibleTab && (
            <button
              onClick={handleSendToPPC}
              disabled={selectedKeys.size === 0 || submittingPPC}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs disabled:opacity-30 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
              title="Dispatch to PPC Order Intake for in-house manufacturing"
            >
              <Factory size={12} />
              <span>{submittingPPC ? "Sending to PPC..." : `🏭 ⚡ Send to PPC Intake (${selectedKeys.size})`}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tables: Render Consolidated Purchase Buckets OR Cut Sizes BOM Items */}
      {isBucketSubView ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="sm:hidden px-3 py-1.5 bg-cyan-50 dark:bg-cyan-950/80 border-b border-cyan-200 dark:border-cyan-800 text-[10px] font-bold text-cyan-800 dark:text-cyan-300 flex items-center justify-between">
            <span>📦 Consolidated Purchase Buckets</span>
            <span className="text-cyan-600 font-semibold">← Swipe horizontally →</span>
          </div>
          <div className="overflow-x-auto scroll-smooth touch-pan-x">
            <table className="w-full min-w-[960px] text-xs text-left">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700 shadow-2xs backdrop-blur-xs">
                <tr>
                  <th className="p-3 w-8 text-center">
                    <button onClick={toggleSelectAll} className="text-slate-400 hover:text-cyan-600">
                      {selectedKeys.size === filteredBuckets.length && filteredBuckets.length > 0 ? (
                        <CheckSquare size={14} className="text-cyan-600" />
                      ) : (
                        <Square size={14} />
                      )}
                    </button>
                  </th>
                  <th className="p-3 w-8 text-center"></th>
                  <th className="p-3">Commercial Purchase Item (Bucket)</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-center">Consolidated Gross</th>
                  <th className="p-3 text-center">Bucket Live Stock</th>
                  <th className="p-3 text-center">In-Transit PO</th>
                  <th className="p-3 text-center">Net Shortage (To Buy)</th>
                  <th className="p-3">Preferred Supplier</th>
                  <th className="p-3 text-center">Cut Sizes Dumped</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredBuckets.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400">
                      No purchase buckets created yet. Switch to "BOM Cut Sizes" tab and click "+ Convert to Purchase {activeTypeTab === 'rm' ? 'RM' : 'BO'}" on any cut size to create a purchase bucket.
                    </td>
                  </tr>
                ) : (
                  filteredBuckets.map((bucket: any, bIdx: number) => {
                    const bKey = bucket.bucketKey || `bucket_${bucket.targetPurchaseItemId || bIdx}`;
                    const isSelected = selectedKeys.has(bKey);
                    const isExpanded = expandedBucketIds.has(bKey);
                    return (
                      <React.Fragment key={`${bKey}_${bIdx}`}>
                        <tr className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 ${isSelected ? "bg-cyan-50/50 dark:bg-cyan-950/20" : ""}`}>
                          <td className="p-3 text-center">
                            <button onClick={() => toggleSelect(bKey)} className="text-slate-400 hover:text-cyan-600">
                              {isSelected ? <CheckSquare size={14} className="text-cyan-600" /> : <Square size={14} />}
                            </button>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                const next = new Set(expandedBucketIds);
                                if (next.has(bucket.bucketKey)) next.delete(bucket.bucketKey);
                                else next.add(bucket.bucketKey);
                                setExpandedBucketIds(next);
                              }}
                              className="text-slate-400 hover:text-cyan-600 transition-transform cursor-pointer"
                              title={isExpanded ? "Collapse contained cut sizes" : "Expand contained cut sizes"}
                            >
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                              <Boxes size={14} className="text-cyan-600 shrink-0" />
                              <span>{bucket.targetPurchaseItemName || bucket.materialName || 'Commercial Purchase Item'}</span>
                            </div>
                            {(bucket.targetPurchaseItemDescription || bucket.description) && (
                              <span className="block text-[11px] text-slate-500 italic mt-0.5 ml-5">
                                {bucket.targetPurchaseItemDescription || bucket.description}
                              </span>
                            )}
                            <div className="text-[10px] text-slate-400 mt-1 ml-5 flex items-center gap-2">
                              <span>Units: <strong className="font-mono text-slate-600 dark:text-slate-300">{bucket.unit}</strong></span>
                              {bucket.hasSecondaryUnit && bucket.secondaryUnit && (
                                <span>| Sec: <strong className="font-mono text-slate-600 dark:text-slate-300">{bucket.secondaryUnit} (Factor: {bucket.conversionFactor})</strong></span>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold border bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200/80 dark:border-cyan-800/50">
                              {bucket.targetPurchaseItemCategory || (activeTypeTab === 'rm' ? 'Raw Material' : 'Bought Out')}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            {renderDualUnitQty(
                              Number(bucket.grossRequired) || 0,
                              bucket.unit,
                              bucket
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {renderDualUnitQty(
                              Number(bucket.currentPhysicalStock) || 0,
                              bucket.unit,
                              bucket,
                              { fontClass: 'font-semibold text-slate-600 dark:text-slate-400' }
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {renderDualUnitQty(
                              Number(bucket.totalInTransitPO) || 0,
                              bucket.unit,
                              bucket,
                              { isInTransit: true }
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {renderDualUnitQty(
                              Number(bucket.netShortage) || 0,
                              bucket.unit,
                              bucket,
                              { isShortage: true }
                            )}
                          </td>
                          <td className="p-3">
                            {bucket.bestVendor ? (
                              <div className="text-[11px]">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-slate-800 dark:text-slate-200">{bucket.bestVendor.vendorName}</span>
                                  {bucket.bestVendor.isPreferred && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                                      ⭐ Preferred
                                    </span>
                                  )}
                                </div>
                                <span className="text-slate-400 block text-[10px] font-mono">₹{Number(bucket.bestVendor.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })} / {bucket.unit}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[10px]">No vendor quote</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                const next = new Set(expandedBucketIds);
                                if (next.has(bucket.bucketKey)) next.delete(bucket.bucketKey);
                                else next.add(bucket.bucketKey);
                                setExpandedBucketIds(next);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold transition-colors cursor-pointer"
                            >
                              <Layers size={11} />
                              <span>{(bucket.sourceCutSizes || bucket.mappedItems || []).length} Cut Size(s)</span>
                            </button>
                          </td>
                        </tr>

                        {/* Expanded Drawer: List Contained Cut Sizes with Breakdowns */}
                        {isExpanded && (
                          <tr className="bg-slate-50/70 dark:bg-slate-800/40">
                            <td colSpan={10} className="p-3 pl-12 pr-6 border-b border-slate-200 dark:border-slate-700">
                              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 shadow-2xs space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                    <span>Cut Sizes Dumped into</span>
                                    <strong className="text-cyan-600 dark:text-cyan-400">"{bucket.targetPurchaseItemName || bucket.materialName || 'Commercial Purchase Item'}"</strong>:
                                  </span>
                                  <span className="text-[11px] text-slate-400">
                                    Total Contained: {(bucket.sourceCutSizes || bucket.mappedItems || []).length} items
                                  </span>
                                </div>

                                <table className="w-full text-xs text-left">
                                  <thead className="text-[10px] uppercase text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800">
                                    <tr>
                                      <th className="py-1.5 px-2">BOM Cut Size Name & Description</th>
                                      <th className="py-1.5 px-2 text-center">Gross Required</th>
                                      <th className="py-1.5 px-2 text-center">Live Stock</th>
                                      <th className="py-1.5 px-2 text-center">Shortage</th>
                                      <th className="py-1.5 px-2 text-center">Demanded In</th>
                                      <th className="py-1.5 px-2 text-right">Mapping Action</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                    {((bucket.sourceCutSizes || bucket.mappedItems || []) as any[]).map((cs: any, csIdx: number) => {
                                      const matchedSource = currentTypeList.find((i: any) => String(i.materialId) === String(cs.sourceItemId));
                                      return (
                                        <tr key={csIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                          <td className="py-2 px-2">
                                            <div className="font-semibold text-slate-800 dark:text-slate-200">{cs.sourceItemName}</div>
                                            {cs.sourceItemDescription && (
                                              <div className="text-[10px] text-slate-400 italic">{cs.sourceItemDescription}</div>
                                            )}
                                          </td>
                                          <td className="py-2 px-2 text-center font-bold text-slate-700 dark:text-slate-300">
                                            {cs.grossRequired} {bucket.unit}
                                            {bucket.hasSecondaryUnit && bucket.secondaryUnit && (
                                              <div className="text-[10px] font-normal text-slate-400">
                                                ({parseFloat((cs.grossRequired * (Number(bucket.conversionFactor) || 1)).toFixed(2))} {bucket.secondaryUnit})
                                              </div>
                                            )}
                                          </td>
                                          <td className="py-2 px-2 text-center text-slate-500">
                                            {cs.currentPhysicalStock || 0} {bucket.unit}
                                          </td>
                                          <td className="py-2 px-2 text-center font-bold text-rose-600 dark:text-rose-400">
                                            {cs.netShortage || 0} {bucket.unit}
                                          </td>
                                          <td className="py-2 px-2 text-center">
                                            <div className="flex flex-wrap items-center justify-center gap-1">
                                              {(cs.mrpSources || []).map((mrp: any, mIdx: number) => (
                                                <span key={mIdx} className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                  {mrp.mrpNumber || mrp}
                                                </span>
                                              ))}
                                            </div>
                                          </td>
                                          <td className="py-2 px-2 text-right">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (matchedSource) {
                                                  setBucketModalItem(matchedSource);
                                                } else {
                                                  setBucketModalItem({
                                                    materialId: cs.sourceItemId,
                                                    materialName: cs.sourceItemName,
                                                    description: cs.sourceItemDescription,
                                                    category: cs.sourceItemCategory,
                                                    unit: bucket.unit,
                                                    hasSecondaryUnit: bucket.hasSecondaryUnit,
                                                    secondaryUnit: bucket.secondaryUnit,
                                                    conversionFactor: bucket.conversionFactor,
                                                    grossRequired: cs.grossRequired,
                                                    netShortage: cs.netShortage,
                                                    purchaseBucket: {
                                                      targetPurchaseItemId: bucket.targetPurchaseItemId,
                                                      targetPurchaseItemName: bucket.targetPurchaseItemName,
                                                      targetPurchaseItemDescription: bucket.targetPurchaseItemDescription,
                                                      targetPurchaseItemCategory: bucket.targetPurchaseItemCategory
                                                    }
                                                  });
                                                }
                                              }}
                                              className="text-xs text-cyan-600 hover:text-cyan-700 font-bold hover:underline cursor-pointer"
                                            >
                                              Re-map / Unmap
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          {/* Mobile horizontal scroll hint */}
          <div className="sm:hidden px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-500 flex items-center justify-between">
            <span>📋 Material Shortages</span>
            <span className="text-emerald-600 font-semibold">← Swipe horizontally →</span>
          </div>
          <div className="overflow-x-auto scroll-smooth touch-pan-x">
            <table className="w-full min-w-[960px] text-xs text-left">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700 shadow-2xs backdrop-blur-xs">
                <tr>
                  <th className="p-3 w-8 text-center">
                    <button onClick={toggleSelectAll} className="text-slate-400 hover:text-emerald-600">
                      {selectedKeys.size === filteredConsolidatedList.length && filteredConsolidatedList.length > 0 ? (
                        <CheckSquare size={14} className="text-emerald-600" />
                      ) : (
                        <Square size={14} />
                      )}
                    </button>
                  </th>
                  <th className="p-3">Material Name & Description</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-center">Gross Required</th>
                  <th className="p-3 text-center">Live Stock</th>
                  <th className="p-3 text-center">In-Transit PO</th>
                  <th className="p-3 text-center">True Net Shortage</th>
                  <th className="p-3">Preferred Supplier</th>
                  <th className="p-3 text-center">Planning Remark</th>
                  <th className="p-3 text-center">BOM Item Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredConsolidatedList.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400">
                      No {activeTypeTab.toUpperCase()} items found matching the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredConsolidatedList.map((item: any, idx: number) => {
                    const rowKey = item.materialKey || item.materialId || item._id || `mat_row_${idx}`;
                    const isSelected = selectedKeys.has(rowKey);
                    const currentStatus = item.status || 'Pending';

                    return (
                      <tr key={`${rowKey}_${idx}`} className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 ${isSelected ? "bg-emerald-50/50 dark:bg-emerald-950/20" : ""}`}>
                        <td className="p-3 text-center">
                          <button onClick={() => toggleSelect(rowKey)} className="text-slate-400 hover:text-emerald-600">
                            {isSelected ? <CheckSquare size={14} className="text-emerald-600" /> : <Square size={14} />}
                          </button>
                        </td>

                        <td className="p-3">
                          <div className="font-bold text-slate-900 dark:text-white">{item.materialName}</div>
                          {item.description && <span className="block text-[11px] text-slate-500 italic mt-0.5">{item.description}</span>}
                          
                          {/* Purchase Bucket Conversion Indicator & Action for RM and BO */}
                          {(activeTypeTab === 'rm' || activeTypeTab === 'bo') && (
                            <div className="mt-1.5 flex items-center gap-1.5">
                              {item.purchaseBucket ? (
                                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[10px]">
                                  <Boxes size={10} className="text-indigo-500 shrink-0" />
                                  <span>Bucket: <strong className="font-semibold">{item.purchaseBucket.targetPurchaseItemName || item.purchaseBucket.name || 'Commercial Purchase Item'}</strong></span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setBucketModalItem(item);
                                    }}
                                    className="ml-1 text-[9px] underline font-bold hover:text-indigo-900 dark:hover:text-indigo-200 cursor-pointer"
                                    title="Change or unmap purchase bucket"
                                  >
                                    Change
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setBucketModalItem(item);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-cyan-50 dark:bg-slate-800 dark:hover:bg-cyan-950/50 border border-slate-200 hover:border-cyan-300 dark:border-slate-700 dark:hover:border-cyan-700 text-slate-600 hover:text-cyan-700 dark:text-slate-400 dark:hover:text-cyan-300 text-[10px] font-medium transition-colors cursor-pointer"
                                  title={`Convert ${item.materialName} to standard purchasable item bucket`}
                                >
                                  <ArrowRight size={10} />
                                  <span>+ Convert to Purchase {activeTypeTab === 'rm' ? 'RM' : 'BO'}</span>
                                </button>
                              )}
                            </div>
                          )}

                          {/* Target Required Date & Sources */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {item.earliestTargetDate && (
                              <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800/60 inline-flex items-center gap-1">
                                <Calendar size={10} />
                                Due: {new Date(item.earliestTargetDate).toLocaleDateString('en-IN')}
                              </span>
                            )}
                            {Array.isArray(item.mrpSources) && item.mrpSources.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1">
                                <span className="text-[10px] text-slate-400 font-medium">Demanded in:</span>
                                {item.mrpSources.map((src: any, sIdx: number) => {
                                  const mrpNum = src.mrpNumber || src;
                                  const matchedPlan = mrpTreeList.find((p: any) => p.mrpNumber === mrpNum);
                                  return (
                                    <button
                                      key={sIdx}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (matchedPlan) handleSelectPlan(matchedPlan);
                                      }}
                                      className={`px-1.5 py-0.2 rounded text-[10px] font-mono transition-colors ${
                                        matchedPlan 
                                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 cursor-pointer' 
                                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                                      }`}
                                      title={matchedPlan ? `Click to inspect ${mrpNum} Nested BOM` : mrpNum}
                                    >
                                      {mrpNum} {src.requiredQty || src.quantity ? `(${src.requiredQty || src.quantity} ${item.unit}${item.hasSecondaryUnit && item.secondaryUnit ? ` / ${parseFloat(((src.requiredQty || src.quantity) * (Number(item.conversionFactor) || 1)).toFixed(2))} ${item.secondaryUnit}` : ''})` : ''}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                            activeTypeTab === 'rm'
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/50'
                              : activeTypeTab === 'bo'
                              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/50'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}>
                            {item.category || (activeTypeTab === 'rm' ? 'Raw Material' : activeTypeTab === 'bo' ? 'Bought Out' : 'Component')}
                          </span>
                        </td>

                        <td className="p-3 text-center">
                          {renderDualUnitQty(
                            Number(item.grossRequired || item.requiredQuantity) || 0,
                            item.unit,
                            item
                          )}
                        </td>

                        <td className="p-3 text-center">
                          {renderDualUnitQty(
                            Number(item.currentPhysicalStock) || 0,
                            item.unit,
                            item,
                            { fontClass: 'font-semibold text-slate-600 dark:text-slate-400' }
                          )}
                        </td>

                        <td className="p-3 text-center">
                          {renderDualUnitQty(
                            Number(item.totalInTransitPO) || 0,
                            item.unit,
                            item,
                            { isInTransit: true }
                          )}
                        </td>

                        <td className="p-3 text-center">
                          {renderDualUnitQty(
                            Number(item.netShortage) || 0,
                            item.unit,
                            item,
                            { isShortage: true }
                          )}
                        </td>

                        <td className="p-3">
                          {item.bestVendor ? (
                            <div className="text-[11px]">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-800 dark:text-slate-200">{item.bestVendor.vendorName}</span>
                                {item.bestVendor.isPreferred && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                                    ⭐ Preferred
                                  </span>
                                )}
                              </div>
                              <span className="text-slate-400 block text-[10px] font-mono">₹{Number(item.bestVendor.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })} / {item.unit}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[10px]">No vendor quote</span>
                          )}
                        </td>

                        {/* Material Planning Status (Remark) */}
                        <td className="p-3 text-center">
                          {(() => {
                            if (item.purchaseBucket) {
                              return (
                                <div className="inline-flex flex-col items-center">
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-300 inline-flex items-center gap-1 whitespace-nowrap">
                                    <Boxes size={10} className="text-indigo-600" /> Converted
                                  </span>
                                  <span className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-400 mt-0.5 max-w-[140px] truncate" title={`Converted to: ${item.purchaseBucket.targetPurchaseItemName}`}>
                                    → {item.purchaseBucket.targetPurchaseItemName}
                                  </span>
                                </div>
                              );
                            }

                            const pStatus = item.materialPlanningStatus || (item.netShortage === 0 ? 'Stock Covered' : 'Not Planned');
                            if (pStatus === 'Completed') {
                              return (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border border-teal-300 whitespace-nowrap">
                                  ✓ Completed
                                </span>
                              );
                            }
                            if (pStatus === 'PO Sent') {
                              return (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 whitespace-nowrap">
                                  📦 PO Sent
                                </span>
                              );
                            }
                            if (pStatus === 'Raised RFQ') {
                              return (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 whitespace-nowrap">
                                  📑 RFQ Raised
                                </span>
                              );
                            }
                            if (pStatus === 'PO In-Transit') {
                              return (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 border border-cyan-300 whitespace-nowrap">
                                  🚚 PO In-Transit
                                </span>
                              );
                            }
                            if (pStatus === 'Partially In-Transit') {
                              return (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-300 whitespace-nowrap">
                                  ⏳ Partial In-Transit
                                </span>
                              );
                            }
                            if (pStatus === 'Stock Covered' || item.netShortage === 0) {
                              return (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 whitespace-nowrap">
                                  ✅ Stock Covered
                                </span>
                              );
                            }
                            return (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 inline-flex items-center gap-1 whitespace-nowrap">
                                <AlertTriangle size={10} /> ⚠️ Not Planned
                              </span>
                            );
                          })()}
                        </td>

                        {/* Interactive Manual Status Selector (Last Column) */}
                        <td className="p-3 text-center">
                          <div className="inline-block relative">
                            <select
                              value={currentStatus}
                              onChange={(e) => handleUpdateItemStatus(e.target.value, item)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border outline-none cursor-pointer appearance-none pr-5 text-center transition-all ${getStatusBadgeClass(currentStatus)}`}
                            >
                              {STATUS_OPTIONS.map((opt) => (
                                <option key={opt} value={opt} className="text-slate-800 bg-white dark:bg-slate-900 dark:text-slate-200">
                                  {opt}
                                </option>
                              ))}
                            </select>
                            <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full h-full flex-1 min-h-0 flex flex-col overflow-y-auto space-y-4 pb-28 sm:pb-20 pr-1 sm:pr-2 scroll-smooth">
      
      {/* ========================================================================= */}
      {/* VIEW 1: INITIAL MRP NUMBERS LIST (Click on an MRP number to view BOM)     */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* VIEW 1: INITIAL MRP NUMBERS LIST & UNIFIED TOP FILTER BAR                */}
      {/* ========================================================================= */}
      {!selectedPlan && (
        <div className="space-y-3.5">
          
          {/* ========================================================================= */}
          {/* UNIFIED FILTER BAR (Applies to both Plans View and Items Wise View)       */}
          {/* ========================================================================= */}
          {/* Controls Toolbar: Search, View Switcher, 3 Dropdown Filter Tabs, Customer, Toggles, Reset, Refresh in Single Line */}
          <div className="relative z-30 bg-white dark:bg-slate-900 p-2 sm:p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap xl:flex-nowrap items-center justify-between gap-2">
            
            {/* Left Group: Search & View Mode Switcher */}
            <div className="flex items-center gap-2 shrink-0 min-w-0 flex-1 max-w-sm sm:max-w-md">
              {/* Search Box */}
              <div className="relative flex-1 min-w-[130px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder={workbenchViewMode === 'plans' ? "Search MRP #, Customer, FG..." : "Search Material, Vendor, Category..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer p-0.5"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* View Mode Toggle: Plans vs Items */}
              <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs font-semibold shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setWorkbenchViewMode('plans');
                    setSelectedKeys(new Set());
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    workbenchViewMode === 'plans'
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="View MRP Demand Plans"
                >
                  <Layers size={13} />
                  <span>Plans ({filteredMrpList.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWorkbenchViewMode('items');
                    setSelectedKeys(new Set());
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    workbenchViewMode === 'items'
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Consolidated Shortages across Active MRP Plans"
                >
                  <Package size={13} />
                  <span>Items ({filteredConsolidatedList.length})</span>
                </button>
              </div>
            </div>

            {/* Center / Right Group: The Dropdown Filter Tabs + Actions */}
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:flex-nowrap">
              
              {/* TAB 1: Material Planning Status Multi-Select Dropdown */}
              <div className="relative shrink-0" ref={statusDropdownRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsStatusDropdownOpen(prev => !prev);
                    setIsPlanDateDropdownOpen(false);
                    setIsTargetDateDropdownOpen(false);
                    setIsCustomerDropdownOpen(false);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    selectedPlanningStatuses.length > 0
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 shadow-2xs'
                      : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200/70'
                  }`}
                >
                  <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                  <span className="truncate max-w-[130px]">
                    {selectedPlanningStatuses.length === 0
                      ? 'Planning Status'
                      : selectedPlanningStatuses.length === 1
                      ? (PLANNING_STATUS_OPTIONS.find(o => o.id === selectedPlanningStatuses[0])?.label?.split(' ')[0] || '1 Selected')
                      : `Status (${selectedPlanningStatuses.length})`}
                  </span>
                  <ChevronDown size={12} className={`text-slate-400 shrink-0 transition-transform ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isStatusDropdownOpen && (
                  <div onClick={(e) => e.stopPropagation()} className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 p-2.5 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 px-1">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Planning Status</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedPlanningStatuses(PLANNING_STATUS_OPTIONS.map(o => o.id))}
                          className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-bold cursor-pointer"
                        >
                          Select All
                        </button>
                        <span className="text-slate-300 dark:text-slate-600">•</span>
                        <button
                          type="button"
                          onClick={() => setSelectedPlanningStatuses([])}
                          className="text-[11px] text-slate-500 hover:underline font-bold cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {PLANNING_STATUS_OPTIONS.map((opt) => {
                        const isSelected = selectedPlanningStatuses.includes(opt.id);
                        const count = statusCounts[opt.id] || 0;
                        const Icon = opt.icon;
                        return (
                          <div
                            key={opt.id}
                            onClick={() => {
                              setSelectedPlanningStatuses(prev => 
                                prev.includes(opt.id) ? prev.filter(s => s !== opt.id) : [...prev, opt.id]
                              );
                            }}
                            className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/80 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                                isSelected 
                                  ? 'bg-emerald-600 border-emerald-600 text-white' 
                                  : 'border-slate-300 dark:border-slate-600'
                              }`}>
                                {isSelected && <Check size={11} className="stroke-[3]" />}
                              </div>
                              <span className={`text-xs flex items-center gap-1.5 ${isSelected ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                                <Icon size={12} className={opt.color} />
                                {opt.label}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              {count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* TAB 2: Plan Date Dropdown */}
              <div className="relative shrink-0" ref={planDateDropdownRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPlanDateDropdownOpen(prev => !prev);
                    setIsStatusDropdownOpen(false);
                    setIsTargetDateDropdownOpen(false);
                    setIsCustomerDropdownOpen(false);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    planDateFilter !== 'all' || planStartDate || planEndDate
                      ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 shadow-2xs'
                      : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200/70'
                  }`}
                >
                  <Calendar size={13} className="text-blue-500 shrink-0" />
                  <span className="truncate max-w-[130px]">
                    Plan: {formatPresetLabel(planDateFilter, planStartDate, planEndDate)}
                  </span>
                  <ChevronDown size={12} className={`text-slate-400 shrink-0 transition-transform ${isPlanDateDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isPlanDateDropdownOpen && (
                  <div onClick={(e) => e.stopPropagation()} className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 p-3 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Plan Date (Created)</span>
                      {(planDateFilter !== 'all' || planStartDate || planEndDate) && (
                        <button
                          type="button"
                          onClick={() => {
                            setPlanDateFilter('all');
                            setPlanStartDate('');
                            setPlanEndDate('');
                          }}
                          className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-bold cursor-pointer"
                        >
                          Reset
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-1">
                      {[
                        { id: 'all', label: 'All Dates' },
                        { id: 'today', label: 'Today' },
                        { id: 'yesterday', label: 'Yesterday' },
                        { id: '7days', label: 'Last 7 Days' },
                        { id: 'thisMonth', label: 'This Month' },
                        { id: 'custom', label: 'Custom Range' },
                      ].map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setPlanDateFilter(p.id as any);
                            if (p.id !== 'custom') {
                              setPlanStartDate('');
                              setPlanEndDate('');
                              setIsPlanDateDropdownOpen(false);
                            }
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer ${
                            planDateFilter === p.id
                              ? 'bg-blue-600 text-white font-bold shadow-2xs'
                              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    {planDateFilter === 'custom' && (
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block mb-0.5">From Date</span>
                          <input
                            type="date"
                            value={planStartDate}
                            onChange={(e) => setPlanStartDate(e.target.value)}
                            className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none text-slate-700 dark:text-slate-200"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block mb-0.5">To Date</span>
                          <input
                            type="date"
                            value={planEndDate}
                            onChange={(e) => setPlanEndDate(e.target.value)}
                            className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none text-slate-700 dark:text-slate-200"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsPlanDateDropdownOpen(false)}
                          className="w-full py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors mt-1"
                        >
                          Apply Custom
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* TAB 3: Target / Due Date Dropdown */}
              <div className="relative shrink-0" ref={targetDateDropdownRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsTargetDateDropdownOpen(prev => !prev);
                    setIsStatusDropdownOpen(false);
                    setIsPlanDateDropdownOpen(false);
                    setIsCustomerDropdownOpen(false);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    targetDateFilter !== 'all' || targetStartDate || targetEndDate
                      ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 shadow-2xs'
                      : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200/70'
                  }`}
                >
                  <Calendar size={13} className="text-amber-500 shrink-0" />
                  <span className="truncate max-w-[130px]">
                    Due: {formatPresetLabel(targetDateFilter, targetStartDate, targetEndDate)}
                  </span>
                  <ChevronDown size={12} className={`text-slate-400 shrink-0 transition-transform ${isTargetDateDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isTargetDateDropdownOpen && (
                  <div onClick={(e) => e.stopPropagation()} className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 p-3 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Target / Due Date</span>
                      {(targetDateFilter !== 'all' || targetStartDate || targetEndDate) && (
                        <button
                          type="button"
                          onClick={() => {
                            setTargetDateFilter('all');
                            setTargetStartDate('');
                            setTargetEndDate('');
                          }}
                          className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline font-bold cursor-pointer"
                        >
                          Reset
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-1">
                      {[
                        { id: 'all', label: 'All Dates' },
                        { id: 'today', label: 'Today' },
                        { id: 'yesterday', label: 'Yesterday' },
                        { id: '7days', label: 'Last 7 Days' },
                        { id: 'next7days', label: 'Next 7 Days' },
                        { id: 'thisMonth', label: 'This Month' },
                        { id: 'custom', label: 'Custom Range' },
                      ].map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setTargetDateFilter(p.id as any);
                            if (p.id !== 'custom') {
                              setTargetStartDate('');
                              setTargetEndDate('');
                              setIsTargetDateDropdownOpen(false);
                            }
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer ${
                            targetDateFilter === p.id
                              ? 'bg-amber-600 text-white font-bold shadow-2xs'
                              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    {targetDateFilter === 'custom' && (
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block mb-0.5">From Date</span>
                          <input
                            type="date"
                            value={targetStartDate}
                            onChange={(e) => setTargetStartDate(e.target.value)}
                            className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none text-slate-700 dark:text-slate-200"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block mb-0.5">To Date</span>
                          <input
                            type="date"
                            value={targetEndDate}
                            onChange={(e) => setTargetEndDate(e.target.value)}
                            className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none text-slate-700 dark:text-slate-200"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsTargetDateDropdownOpen(false)}
                          className="w-full py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors mt-1"
                        >
                          Apply Custom
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Customer Dropdown */}
              <div className="relative shrink-0" ref={customerDropdownRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCustomerDropdownOpen(prev => !prev);
                    setIsStatusDropdownOpen(false);
                    setIsPlanDateDropdownOpen(false);
                    setIsTargetDateDropdownOpen(false);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    selectedCustomerFilter !== 'all'
                      ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 shadow-2xs'
                      : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200/70'
                  }`}
                >
                  <Building2 size={13} className="text-purple-500 shrink-0" />
                  <span className="truncate max-w-[120px]">
                    {selectedCustomerFilter === 'all' ? 'Customer' : selectedCustomerFilter}
                  </span>
                  <ChevronDown size={12} className={`text-slate-400 shrink-0 transition-transform ${isCustomerDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isCustomerDropdownOpen && (
                  <div onClick={(e) => e.stopPropagation()} className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 p-2.5 space-y-1.5 max-h-72 overflow-y-auto">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 px-1">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Customer</span>
                      {selectedCustomerFilter !== 'all' && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCustomerFilter('all');
                            setIsCustomerDropdownOpen(false);
                          }}
                          className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline font-bold cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      <div
                        onClick={() => {
                          setSelectedCustomerFilter('all');
                          setIsCustomerDropdownOpen(false);
                        }}
                        className={`px-2 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                          selectedCustomerFilter === 'all' ? 'bg-purple-600 text-white font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        All Customers
                      </div>
                      {availableCustomers.map((cust) => (
                        <div
                          key={cust}
                          onClick={() => {
                            setSelectedCustomerFilter(cust);
                            setIsCustomerDropdownOpen(false);
                          }}
                          className={`px-2 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors truncate ${
                            selectedCustomerFilter === cust ? 'bg-purple-600 text-white font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {cust}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Items View Contextual: Category & Supplier */}
              {workbenchViewMode === 'items' && (
                <>
                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => {
                      setSelectedCategoryFilter(e.target.value);
                      setSelectedKeys(new Set());
                    }}
                    className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer max-w-[130px] truncate"
                  >
                    <option value="all">All Categories</option>
                    {availableCategories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>

                  <select
                    value={selectedVendorFilter}
                    onChange={(e) => {
                      setSelectedVendorFilter(e.target.value);
                      setSelectedKeys(new Set());
                    }}
                    className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer max-w-[130px] truncate"
                  >
                    <option value="all">All Suppliers</option>
                    <option value="preferred_only">⭐ Preferred</option>
                    {availableVendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.isPreferred ? "⭐ " : ""}{v.name}</option>
                    ))}
                  </select>
                </>
              )}

              {/* Quick Toggle: Shortages Only */}
              <button
                type="button"
                onClick={() => setOnlyShortages(prev => !prev)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border shrink-0 flex items-center gap-1 ${
                  onlyShortages
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-700 shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200/70'
                }`}
                title="Show only items with shortages"
              >
                <span>{onlyShortages ? '✓ Shortages' : 'Shortages'}</span>
              </button>

              {/* Reset All Filters Button */}
              {isAnyFilterActive && (
                <button
                  type="button"
                  onClick={handleResetAllFilters}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl cursor-pointer border border-slate-200 dark:border-slate-700 shrink-0 flex items-center gap-1"
                  title="Reset All Filters"
                >
                  <RotateCcw size={11} />
                  <span>Reset</span>
                </button>
              )}

              {/* Refresh Button */}
              <button
                type="button"
                onClick={() => fetchWorkbenchData()}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors bg-white dark:bg-slate-900 cursor-pointer shrink-0"
                title="Refresh Workbench Data"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {/* Conditional View: Consolidated Items vs Plans List */}
          {workbenchViewMode === 'items' ? (
            renderTypesClassificationView(true)
          ) : (
            <>
              {/* MRP Numbers Table */}
              {loading ? (
                <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-400 font-semibold">Loading MRP Demand Plans...</p>
                </div>
              ) : filteredMrpList.length === 0 ? (
                <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <Package className="w-10 h-10 text-slate-300 mx-auto mb-2 opacity-60" />
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">No MRP Plans Found</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Adjust your date or status filters, or create an MRP Demand Plan in Tab 1 to start procurement.</p>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                  {/* Mobile horizontal scroll hint */}
                  <div className="sm:hidden px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-500 flex items-center justify-between">
                    <span>📑 Demand Plans</span>
                    <span className="text-emerald-600 font-semibold">← Swipe horizontally →</span>
                  </div>
                  <div className="overflow-x-auto scroll-smooth touch-pan-x">
                    <table className="w-full min-w-[880px] text-xs text-left">
                      <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700 shadow-2xs backdrop-blur-xs">
                        <tr>
                          <th className="p-3.5">MRP Number</th>
                          <th className="p-3.5">Customer & PO Ref</th>
                          <th className="p-3.5">Dates (Plan / Due)</th>
                          <th className="p-3.5">Finished Goods (FG) Demand</th>
                          <th className="p-3.5 text-center">Live Shortages</th>
                          <th className="p-3.5 text-center">In-Transit POs</th>
                          <th className="p-3.5 text-center">Material Planning Status</th>
                          <th className="p-3.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredMrpList.map((plan: any, pIdx: number) => {
                          const planKey = plan._id ? String(plan._id) : (plan.mrpNumber || `plan_${pIdx}`);
                          const fgCount = (plan.fgItems || []).length;
                          const firstFG = (plan.fgItems || [])[0];

                          return (
                            <tr 
                              key={planKey}
                              onClick={() => handleSelectPlan(plan)}
                              className="hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 cursor-pointer transition-colors"
                            >
                              {/* MRP Number */}
                              <td className="p-3.5">
                                <span className="font-mono text-xs font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                  {plan.mrpNumber}
                                </span>
                              </td>

                              {/* Customer & PO */}
                              <td className="p-3.5">
                                <strong className="text-slate-900 dark:text-white block">{plan.customerName || "Internal Demand"}</strong>
                                {plan.customerPoNumber && (
                                  <span className="font-mono text-[10px] text-slate-400">PO: {plan.customerPoNumber}</span>
                                )}
                              </td>

                              {/* Dates: Plan Date & Due Date */}
                              <td className="p-3.5">
                                <div className="text-[11px] space-y-0.5">
                                  {plan.planDate && (
                                    <div className="text-slate-600 dark:text-slate-400">
                                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Plan: </span>
                                      {new Date(plan.planDate).toLocaleDateString('en-IN')}
                                    </div>
                                  )}
                                  {plan.targetDate && (
                                    <div className="text-amber-700 dark:text-amber-400 font-semibold">
                                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Due: </span>
                                      {new Date(plan.targetDate).toLocaleDateString('en-IN')}
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* FG Summary */}
                              <td className="p-3.5">
                                <div className="font-semibold text-slate-800 dark:text-slate-200">
                                  {firstFG?.fgItemName || "Finished Good"}
                                  {fgCount > 1 && <span className="text-slate-400 font-normal ml-1">+{fgCount - 1} more</span>}
                                </div>
                                <span className="text-[10px] text-slate-400 block font-mono">
                                  {fgCount} FG Item{fgCount > 1 ? 's' : ''} planned
                                </span>
                              </td>

                              {/* Live Shortages */}
                              <td className="p-3.5 text-center">
                                {plan.planTotalShortages > 0 ? (
                                  <span className="inline-flex items-center gap-1 font-bold text-red-600 bg-red-50 dark:bg-red-950 px-2 py-0.5 rounded text-[11px]">
                                    <AlertTriangle size={11} /> {plan.planTotalShortages} Shortage Units
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded text-[11px]">
                                    <CheckCircle2 size={11} /> Stock Covered
                                  </span>
                                )}
                              </td>

                              {/* In-Transit POs */}
                              <td className="p-3.5 text-center">
                                {plan.planTotalInTransit > 0 ? (
                                  <span className="font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded text-[11px]">
                                    {plan.planTotalInTransit} Units In-Transit
                                  </span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>

                              {/* Material Planning Status */}
                              <td className="p-3.5 text-center">
                                {plan.planTotalShortages === 0 ? (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 whitespace-nowrap">
                                    ✅ Material Planned / Covered
                                  </span>
                                ) : plan.planTotalInTransit >= plan.planTotalShortages ? (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 whitespace-nowrap">
                                    🚚 PO In-Transit
                                  </span>
                                ) : plan.planTotalInTransit > 0 ? (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-300 whitespace-nowrap">
                                    ⏳ Partially In-Transit
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 inline-flex items-center gap-1 whitespace-nowrap">
                                    <AlertTriangle size={10} /> ⚠️ Not Planned
                                  </span>
                                )}
                              </td>

                              {/* Open BOM Trigger Button */}
                              <td className="p-3.5 text-right">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectPlan(plan);
                                  }}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1 ml-auto cursor-pointer"
                                >
                                  <span>View Nested BOM</span>
                                  <ChevronRight size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: SELECTED MRP PLAN WORKBENCH WITH NESTED BOM & CLASSIFICATIONS     */}
      {/* ========================================================================= */}
      {selectedPlan && (
        <div className="space-y-4">
          
          {/* Top Header Bar with Navigation and PDF Export */}
          <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
            
            <div className="flex items-center gap-3">
              <button
                onClick={handleBackToList}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1 text-xs font-bold cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span>All MRPs</span>
              </button>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-mono font-black">
                    {selectedPlan.mrpNumber}
                  </span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {selectedPlan.customerName}
                  </span>
                  {selectedPlan.customerPoNumber && (
                    <span className="text-[10px] text-slate-400 font-mono">PO: {selectedPlan.customerPoNumber}</span>
                  )}
                </div>
              </div>
            </div>

            {/* View Mode Switcher & Top Actions */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scroll-smooth touch-pan-x flex-nowrap sm:flex-wrap justify-between sm:justify-end no-scrollbar">
              
              {/* Mode Toggle: Nested Tree vs Type Classification */}
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold shrink-0">
                <button
                  onClick={() => {
                    setViewMode('nested-tree');
                    setSelectedKeys(new Set());
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                    viewMode === 'nested-tree'
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <GitBranch size={13} />
                  <span>Nested BOM Tree</span>
                </button>

                <button
                  onClick={() => {
                    setViewMode('consolidated-types');
                    setSelectedKeys(new Set());
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                    viewMode === 'consolidated-types'
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Layers size={13} />
                  <span>Type Classification</span>
                </button>
              </div>

              {/* PDF Export Button (Visible on Tree view) */}
              {viewMode === 'nested-tree' && (
                <button
                  onClick={handleExportBOMPDF}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
                  title="Export Multi-Level BOM PDF"
                >
                  <Download size={13} />
                  <span>Export BOM PDF</span>
                </button>
              )}

              <button
                onClick={() => fetchWorkbenchData(selectedPlan._id)}
                className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl cursor-pointer shrink-0"
                title="Refresh Live Stock"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Finished Goods</span>
              <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                {(selectedPlan.fgItems || []).length} <span className="text-xs font-semibold text-slate-400">items</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-500">Net Shortages</span>
              <div className="text-xl font-black text-red-600 dark:text-red-400 mt-0.5">
                {selectedPlan.planTotalShortages} <span className="text-xs font-semibold text-slate-400">units</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-500">In-Transit Open POs</span>
              <div className="text-xl font-black text-blue-600 mt-0.5">
                {selectedPlan.planTotalInTransit} <span className="text-xs font-semibold text-slate-400">units</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">Procurement Status</span>
              <div className="mt-1">
                {selectedPlan.isProcurementFulfilled ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    ✅ Fulfilled
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    ⏳ Shortages Pending
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: NESTED MULTI-LEVEL BOM TREE VIEW (CLEAN HIERARCHY - NO SELECTION)  */}
          {/* ========================================================================= */}
          {viewMode === 'nested-tree' && (
            <div className="space-y-3">
              {(selectedPlan.fgItems || []).map((fg: any, fgIdx: number) => {
                const fgKey = `${selectedPlan._id}_fg_${fgIdx}`;
                const isExpanded = expandedNodes.has(fgKey) || true;

                return (
                  <div key={fgIdx} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                    
                    {/* Level 1: Finished Good / Assembly Header */}
                    <div 
                      onClick={() => toggleExpandNode(fgKey)}
                      className="p-3.5 bg-slate-50 dark:bg-slate-800/60 flex justify-between items-center cursor-pointer hover:bg-slate-100/60 transition-colors border-b border-slate-200 dark:border-slate-700"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="p-1 rounded bg-emerald-600 text-white text-[9px] font-black uppercase">
                          Level 1: Assembly / FG
                        </span>
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {fg.fgItemName}
                        </span>
                        {fg.description && <span className="text-xs text-slate-500 italic font-normal">({fg.description})</span>}
                        {fg.bomNumber && (
                          <span className="px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono text-[9px]">
                            {fg.bomNumber}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        <span className="font-bold text-slate-600 dark:text-slate-300">
                          Order Target: <strong>{fg.quantity} {fg.unit}</strong>
                          {fg.hasSecondaryUnit && fg.secondaryUnit && (
                            <span className="text-[10px] text-slate-400 font-medium ml-1">
                              ({parseFloat((fg.quantity * (Number(fg.conversionFactor) || 1)).toFixed(2))} {fg.secondaryUnit})
                            </span>
                          )}
                        </span>
                        <span className="font-bold text-teal-600">
                          GRN Received: <strong>{fg.receivedQuantity} {fg.unit}</strong>
                          {fg.hasSecondaryUnit && fg.secondaryUnit && (
                            <span className="text-[10px] text-teal-500/80 font-medium ml-1">
                              ({parseFloat((fg.receivedQuantity * (Number(fg.conversionFactor) || 1)).toFixed(2))} {fg.secondaryUnit})
                            </span>
                          )}
                        </span>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </div>
                    </div>

                    {/* Level 2, 3, 4: Nested Child Materials Table (Clean View) */}
                    {isExpanded && (
                      <div className="overflow-x-auto scroll-smooth touch-pan-x">
                        <table className="w-full min-w-[780px] text-xs text-left">
                          <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700 shadow-2xs backdrop-blur-xs">
                            <tr>
                              <th className="p-3">Nested Component / Material</th>
                              <th className="p-3">Classification Type</th>
                              <th className="p-3 text-center">Req / FG</th>
                              <th className="p-3 text-center">Total Req</th>
                              <th className="p-3 text-center">Live Stock</th>
                              <th className="p-3 text-center">In-Transit PO</th>
                              <th className="p-3 text-center">True Net Shortage</th>
                              <th className="p-3">Best Vendor Quote</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {(fg.nestedMaterials || []).map((nMat: any, nIdx: number) => {
                              const levelIndent = nMat.level ? (nMat.level - 1) * 16 : 0;

                              return (
                                <tr key={nIdx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                                  <td className="p-3">
                                    <div style={{ paddingLeft: `${levelIndent}px` }} className="flex items-center gap-1.5">
                                      {nMat.level > 1 && <span className="text-slate-300 font-mono">↳</span>}
                                      <div>
                                        <span className="font-bold text-slate-800 dark:text-slate-200">{nMat.materialName}</span>
                                        {nMat.description && <span className="block text-[10px] text-slate-500 italic mt-0.5">{nMat.description}</span>}
                                      </div>
                                    </div>
                                  </td>

                                  <td className="p-3">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                      nMat.itemType === 'SubAssembly' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' :
                                      nMat.itemType === 'Component' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' :
                                      nMat.itemType === 'BO' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' :
                                      nMat.itemType === 'Assembly' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' :
                                      'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300'
                                    }`}>
                                      {nMat.itemType || "RM"}
                                    </span>
                                  </td>

                                  <td className="p-3 text-center">
                                    {renderDualUnitQty(
                                      Number(nMat.quantityPerFG) || 1,
                                      nMat.unit,
                                      nMat,
                                      { isPerFG: true, fontClass: 'font-mono text-slate-600 dark:text-slate-400' }
                                    )}
                                  </td>

                                  <td className="p-3 text-center">
                                    {renderDualUnitQty(
                                      Number(nMat.totalRequired || nMat.requiredQuantity) || 0,
                                      nMat.unit,
                                      nMat
                                    )}
                                  </td>

                                  <td className="p-3 text-center">
                                    {renderDualUnitQty(
                                      Number(nMat.currentPhysicalStock) || 0,
                                      nMat.unit,
                                      nMat,
                                      { fontClass: 'font-semibold text-slate-600 dark:text-slate-400' }
                                    )}
                                  </td>

                                  <td className="p-3 text-center">
                                    {renderDualUnitQty(
                                      Number(nMat.totalInTransitPO) || 0,
                                      nMat.unit,
                                      nMat,
                                      { isInTransit: true }
                                    )}
                                  </td>

                                  <td className="p-3 text-center">
                                    {renderDualUnitQty(
                                      Number(nMat.netShortage) || 0,
                                      nMat.unit,
                                      nMat,
                                      { isShortage: true }
                                    )}
                                  </td>

                                  <td className="p-3">
                                    {nMat.bestVendor ? (
                                      <div className="text-[11px]">
                                        <span className="font-bold text-slate-700 dark:text-slate-300">{nMat.bestVendor.vendorName}</span>
                                        <span className="text-slate-400 block text-[10px]">₹{nMat.bestVendor.rate}/{nMat.unit}</span>
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 italic text-[10px]">No vendor quote</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: TYPES CLASSIFICATION VIEW (SELECTION, MANUAL STATUS & ACTIONS)      */}
          {/* ========================================================================= */}
          {viewMode === 'consolidated-types' && renderTypesClassificationView(false)}
        </div>
      )}

      {/* Modal: Convert Cut Size to Purchasable Item Bucket */}
      {(bucketModalItem || (bucketModalItems && bucketModalItems.length > 0)) && (
        <ConvertToPurchaseBucketModal
          isOpen={Boolean(bucketModalItem || (bucketModalItems && bucketModalItems.length > 0))}
          onClose={() => {
            setBucketModalItem(null);
            setBucketModalItems(null);
          }}
          item={bucketModalItem}
          items={bucketModalItems || undefined}
          token={token}
          onSuccess={() => {
            fetchWorkbenchData(selectedPlan?._id);
            setSelectedKeys(new Set());
          }}
        />
      )}
    </div>
  );
}
