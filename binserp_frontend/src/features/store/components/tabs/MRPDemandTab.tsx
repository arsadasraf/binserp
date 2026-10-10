"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Layers, Search, Filter, CheckCircle2, Clock, 
  ArrowRight, ArrowLeft, RefreshCw, ChevronDown, ChevronUp,
  Building2, FileText, CheckSquare, Square, Package, Eye,
  ExternalLink, Sparkles, TrendingUp, AlertCircle, ShoppingCart,
  FileCheck, Printer, Paperclip, ChevronRight, Check, LayoutGrid
} from 'lucide-react';
import { apiGet } from '@/src/lib/api';
import { isSpaceFreeMatch } from '@/src/utils/spaceFreeSearchHelper';
import { useExchangeRates } from '@/src/hooks/useExchangeRates';
import { getCurrencySymbol } from '@/src/utils/currencyHelper';
import { getPoOaNumber } from '@/src/utils/oaHelper';
import SearchableMultiSelect, { MultiSelectOption } from '../SearchableMultiSelect';

export interface MRPDemandTabProps {
  token?: string | null;
  mrpPlans?: any[];
  onPlanSinglePo: (po: any) => void;
  onPlanConsolidatedPos: (poIds: string[]) => void;
  onPlanMatrixDemand?: (payload: {
    poIds: string[];
    selectedMonths: string[];
    initialPlanData: any;
  }) => void;
  onViewPlanDetails?: (plan: any) => void;
  onViewCustomerPoDetails?: (po: any) => void;
  onError?: (msg: string) => void;
  onSuccess?: (msg: string) => void;
}

interface MonthBucket {
  key: string; // 'YYYY-MM'
  label: string; // 'October 2026'
  shortLabel: string; // 'Oct 2026'
  year: number;
  monthIndex: number; // 0-11
}

interface MatrixItemRow {
  fgId: string;
  name: string;
  code?: string;
  description: string;
  unit: string;
  hsnCode?: string;
  monthlyQuantities: Record<string, number>;
  totalDemandQty: number;
  plannedQty: number;
  balanceQty: number;
  linkedMrpNumbers?: string[];
  contributingPOs: Array<{
    poId: string;
    poNumber: string;
    customerName: string;
    poDate?: string;
    deliveryDate?: string;
    monthKey: string;
    quantity: number;
    unit: string;
    isPlanned: boolean;
    mrpNumber?: string;
    mrpPlanId?: string;
    poRaw: any;
  }>;
}

export default function MRPDemandTab({
  token: propToken,
  mrpPlans = [],
  onPlanSinglePo,
  onPlanConsolidatedPos,
  onPlanMatrixDemand,
  onViewPlanDetails,
  onViewCustomerPoDetails,
  onError,
  onSuccess
}: MRPDemandTabProps) {
  const token = propToken || (typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '');
  const { convertToINR } = useExchangeRates(token);

  const [loading, setLoading] = useState(true);
  const [customerPOs, setCustomerPOs] = useState<any[]>([]);
  const [fgItems, setFgItems] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [showDashboard, setShowDashboard] = useState<boolean>(false);

  // Sub-view Toggle: 'pos' (Customer POs list) vs 'monthMatrix' (Month-Wise Item matrix)
  const [activeView, setActiveView] = useState<'pos' | 'monthMatrix'>('pos');

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unplanned' | 'partially_planned' | 'mrp_done'>('all');
  const [filterCustomers, setFilterCustomers] = useState<string[]>([]);
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('all');

  // Multi-PO Selection for Consolidated MRP Planning (in 'pos' sub-tab)
  const [selectedPoIds, setSelectedPoIds] = useState<string[]>([]);

  // Multi-Item & Multi-Month Selection for Matrix MRP Planning (in 'monthMatrix' sub-tab)
  // Format of key: `${fgId}::${monthKey}`
  const [selectedMatrixCells, setSelectedMatrixCells] = useState<Set<string>>(new Set());

  // Expandable Row States
  const [expandedPoIds, setExpandedPoIds] = useState<Set<string>>(new Set());
  const [expandedMatrixItems, setExpandedMatrixItems] = useState<Set<string>>(new Set());

  // Month-Wise Rolling 6 Months Navigation (offset in 6-month steps)
  const [monthStepOffset, setMonthStepOffset] = useState<number>(0);

  // Fetch Demand Data (Customer POs, FG items, Customers)
  const fetchDemandData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [poRes, fgRes, custRes] = await Promise.all([
        apiGet('/api/sales/incoming-po', token).catch(() => ({ pos: [] })),
        apiGet('/api/store/fg-item', token).catch(() => []),
        apiGet('/api/store/customer', token).catch(() => [])
      ]);

      const rawPOs = Array.isArray(poRes?.pos)
        ? poRes.pos
        : Array.isArray(poRes?.data)
        ? poRes.data
        : Array.isArray(poRes)
        ? poRes
        : [];
      const rawFGs = Array.isArray(fgRes?.fgItems)
        ? fgRes.fgItems
        : Array.isArray(fgRes)
        ? fgRes
        : [];
      const rawCusts = Array.isArray(custRes?.customers)
        ? custRes.customers
        : Array.isArray(custRes)
        ? custRes
        : [];

      setCustomerPOs(rawPOs);
      setFgItems(rawFGs);
      setCustomers(rawCusts);
    } catch (err: any) {
      console.error('Failed to load demand data:', err);
      onError?.(err.message || 'Failed to fetch customer POs for MRP demand');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDemandData();
  }, [token]);

  // Formatted Customer options for SearchableMultiSelect (from master & loaded POs)
  const customerOptions: MultiSelectOption[] = useMemo(() => {
    const map = new Map<string, MultiSelectOption>();

    // 1. From customers master
    (Array.isArray(customers) ? customers : []).forEach((c: any) => {
      const id = (c._id || c.id)?.toString();
      if (id) {
        map.set(id, {
          value: id,
          label: c.name || c.companyName || 'Customer',
          subLabel: c.code ? `Code: ${c.code}` : undefined
        });
      }
    });

    // 2. Fallback from customerPOs for comprehensive coverage
    (Array.isArray(customerPOs) ? customerPOs : []).forEach((po: any) => {
      const id = (po.customer?._id || po.customer?.id || po.customer)?.toString();
      if (id && !map.has(id)) {
        const name = po.customerName || po.customer?.name || po.customer?.companyName || 'Customer';
        map.set(id, {
          value: id,
          label: name,
          subLabel: po.customer?.code ? `Code: ${po.customer.code}` : undefined
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [customers, customerPOs]);

  // Compute 6-month calendar buckets starting from current month + offset
  const monthBuckets: MonthBucket[] = useMemo(() => {
    const buckets: MonthBucket[] = [];
    const baseDate = new Date();
    // Start of current month
    const startMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + monthStepOffset * 6, 1);

    for (let i = 0; i < 6; i++) {
      const d = new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const key = `${yyyy}-${mm}`;
      const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const shortLabel = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      buckets.push({
        key,
        label,
        shortLabel,
        year: yyyy,
        monthIndex: d.getMonth()
      });
    }
    return buckets;
  }, [monthStepOffset]);

  // Helper to determine PO's planning status relative to active MRP plans
  const getPoMRPStatus = (po: any): { status: 'Unplanned' | 'Partially Planned' | 'MRP Generated'; mrpNumber?: string; planId?: string } => {
    if (po.status === 'Cancelled') {
      return { status: 'Unplanned' };
    }

    // Check direct link in PO document
    if (po.mrpNumber || po.status === 'MRP Done') {
      const pId = typeof po.mrpPlan === 'object' ? po.mrpPlan?._id : (typeof po.mrpPlan === 'string' ? po.mrpPlan : undefined);
      return {
        status: 'MRP Generated',
        mrpNumber: po.mrpNumber || po.mrpPlan?.mrpNumber || 'MRP Linked',
        planId: pId
      };
    }

    // Check if referenced in any active MRP Plans
    const matchedPlan = (mrpPlans || []).find((p: any) => {
      if (p.customerPo && String(p.customerPo) === String(po._id)) return true;
      if (p.customerPoNumber && p.customerPoNumber === po.poNumber) return true;
      if (Array.isArray(p.customerPOs) && p.customerPOs.some((cp: any) => String(cp.customerPo || cp._id) === String(po._id) || cp.customerPoNumber === po.poNumber)) {
        return true;
      }
      return false;
    });

    if (matchedPlan) {
      return {
        status: 'MRP Generated',
        mrpNumber: matchedPlan.mrpNumber,
        planId: matchedPlan._id
      };
    }

    return { status: 'Unplanned' };
  };

  // Filtered Customer POs
  const filteredCustomerPOs = useMemo(() => {
    return (Array.isArray(customerPOs) ? customerPOs : []).filter((po) => {
      if (po.status === 'Cancelled') return false;

      // Status Filter
      const mrpInfo = getPoMRPStatus(po);
      if (statusFilter === 'unplanned' && mrpInfo.status !== 'Unplanned') return false;
      if (statusFilter === 'mrp_done' && mrpInfo.status !== 'MRP Generated') return false;
      if (statusFilter === 'partially_planned' && mrpInfo.status !== 'Partially Planned') return false;

      // Customer Multi-Select Filter
      if (filterCustomers.length > 0 && !filterCustomers.includes('All') && !filterCustomers.includes('all')) {
        const custId = (po.customer?._id || po.customer?.id || po.customer)?.toString();
        if (!filterCustomers.includes(custId)) return false;
      }

      // Delivery Month Filter
      if (selectedMonthFilter !== 'all') {
        const poDate = po.committedDispatchDate || po.date;
        const poMonth = poDate ? new Date(poDate).toISOString().slice(0, 7) : '';
        const itemHasMonth = (po.items || []).some((it: any) => {
          const itDate = it.expectedDeliveryDate || poDate;
          return itDate && new Date(itDate).toISOString().slice(0, 7) === selectedMonthFilter;
        });
        if (poMonth !== selectedMonthFilter && !itemHasMonth) return false;
      }

      // Space-Free Search Query across PO #, Customer, and Line Items
      if (searchTerm.trim()) {
        const custName = po.customerName || po.customer?.name || po.customer?.companyName || '';
        const custCode = po.customer?.code || '';
        const poNum = po.poNumber || '';
        const oaNum = getPoOaNumber(po) || '';

        const itemMatches = (po.items || []).some((it: any) => {
          const fgObj = it.fgItem && typeof it.fgItem === 'object' ? it.fgItem : null;
          const pName = it.productName || fgObj?.name || '';
          const pDesc = it.description || fgObj?.description || fgObj?.descriptions || '';
          return isSpaceFreeMatch(pName, searchTerm) || isSpaceFreeMatch(pDesc, searchTerm);
        });

        const headerMatch =
          isSpaceFreeMatch(poNum, searchTerm) ||
          isSpaceFreeMatch(custName, searchTerm) ||
          isSpaceFreeMatch(custCode, searchTerm) ||
          isSpaceFreeMatch(oaNum, searchTerm);

        if (!headerMatch && !itemMatches) return false;
      }

      return true;
    });
  }, [customerPOs, statusFilter, filterCustomers, selectedMonthFilter, searchTerm, mrpPlans]);

  // Financials & KPI Stats (dynamically reflected for selected customers)
  const kpiStats = useMemo(() => {
    let totalDemandedQty = 0;
    let totalDemandValuationInr = 0;
    let unplannedCount = 0;
    let plannedCount = 0;
    const distinctItemKeys = new Set<string>();

    const targetPOs = (Array.isArray(customerPOs) ? customerPOs : []).filter((po) => {
      if (po.status === 'Cancelled') return false;
      if (filterCustomers.length > 0 && !filterCustomers.includes('All') && !filterCustomers.includes('all')) {
        const custId = (po.customer?._id || po.customer?.id || po.customer)?.toString();
        if (!filterCustomers.includes(custId)) return false;
      }
      return true;
    });

    targetPOs.forEach((po) => {
      const mrpInfo = getPoMRPStatus(po);
      if (mrpInfo.status === 'MRP Generated') {
        plannedCount++;
      } else {
        unplannedCount++;
      }

      const poAmt = Number(po.totalAmount || po.subtotal || 0);
      const curr = (po.currency || 'INR').trim().toUpperCase();
      const inrConv = convertToINR(poAmt, curr);
      totalDemandValuationInr += inrConv.inrAmount;

      (po.items || []).forEach((it: any) => {
        const q = Number(it.quantity || 0);
        totalDemandedQty += q;

        const fgObj = it.fgItem && typeof it.fgItem === 'object' ? it.fgItem : null;
        const fgId = fgObj?._id || (typeof it.fgItem === 'string' ? it.fgItem : null);
        const rawName = (it.productName || fgObj?.name || '').trim();
        const key = fgId || (rawName ? `name_${rawName.toLowerCase()}` : null);
        if (key) distinctItemKeys.add(String(key));
      });
    });

    return {
      totalOpenPOs: targetPOs.length,
      unplannedCount,
      plannedCount,
      totalDemandedQty,
      uniqueItemCount: distinctItemKeys.size,
      totalDemandValuationInr,
      formattedValuation: `₹${Math.round(totalDemandValuationInr).toLocaleString('en-IN')}`
    };
  }, [customerPOs, filterCustomers, mrpPlans, convertToINR]);

  // Selected POs Summary for Floating Bulk Action Bar
  const selectedFinancials = useMemo(() => {
    const selectedList = customerPOs.filter((p) => selectedPoIds.includes(p._id));
    let inrSum = 0;
    let itemsSum = 0;

    selectedList.forEach((po) => {
      const amt = Number(po.totalAmount || po.subtotal || 0);
      const curr = (po.currency || 'INR').trim().toUpperCase();
      inrSum += convertToINR(amt, curr).inrAmount;
      itemsSum += (po.items || []).reduce((acc: number, it: any) => acc + Number(it.quantity || 0), 0);
    });

    return {
      count: selectedList.length,
      totalItemsQty: itemsSum,
      inrFormatted: `₹${Math.round(inrSum).toLocaleString('en-IN')}`
    };
  }, [customerPOs, selectedPoIds, convertToINR]);

  // Month-Wise Planning Matrix Aggregation (Items x Months Grid)
  const monthMatrixData: MatrixItemRow[] = useMemo(() => {
    const map = new Map<string, MatrixItemRow>();

    // Map of FG items from master for descriptions and metadata
    const masterFgMap = new Map<string, any>();
    (Array.isArray(fgItems) ? fgItems : []).forEach((fg) => {
      if (fg._id) masterFgMap.set(String(fg._id), fg);
    });

    (Array.isArray(customerPOs) ? customerPOs : []).forEach((po) => {
      if (po.status === 'Cancelled') return;

      // Customer Multi-Select Filter applied to Month-Wise Item Matrix
      if (filterCustomers.length > 0 && !filterCustomers.includes('All') && !filterCustomers.includes('all')) {
        const custId = (po.customer?._id || po.customer?.id || po.customer)?.toString();
        if (!filterCustomers.includes(custId)) return;
      }

      const poMRP = getPoMRPStatus(po);
      const defaultPoDate = po.committedDispatchDate || po.date;

      (po.items || []).forEach((it: any) => {
        const fgObj = it.fgItem && typeof it.fgItem === 'object' ? it.fgItem : null;
        const rawFgId = String(fgObj?._id || (typeof it.fgItem === 'string' ? it.fgItem : ''));
        const isValidHex = /^[0-9a-fA-F]{24}$/.test(rawFgId);
        let fgId = isValidHex ? rawFgId : '';

        // If fgId is not a valid ObjectId, try lookup in fgItems catalog by item name or code
        const name = it.productName || fgObj?.name || 'Finished Good';
        if (!fgId) {
          const matchByName = fgItems.find((f: any) =>
            (f.name && f.name.toLowerCase().trim() === name.toLowerCase().trim()) ||
            (f.code && f.code.toLowerCase().trim() === (it.productCode || '').toLowerCase().trim())
          );
          if (matchByName?._id && /^[0-9a-fA-F]{24}$/.test(String(matchByName._id))) {
            fgId = String(matchByName._id);
          }
        }
        const masterFg = fgId ? masterFgMap.get(fgId) : null;

        // Resolve Item Name & Technical Description strictly per workspace rule
        const description =
          it.description ||
          fgObj?.description ||
          fgObj?.descriptions ||
          masterFg?.description ||
          masterFg?.descriptions ||
          '';
        const unit = it.unit || fgObj?.unit || masterFg?.unit || 'PCS';
        const hsnCode = it.hsnCode || fgObj?.hsnCode || masterFg?.hsnCode || '';

        const key = fgId || `item_${name.toLowerCase().trim()}`;
        const qty = Number(it.quantity || 0);

        // Determine month key (YYYY-MM)
        const itemDate = it.expectedDeliveryDate || defaultPoDate;
        let monthKey = '';
        if (itemDate) {
          const d = new Date(itemDate);
          if (!isNaN(d.getTime())) {
            monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          }
        }
        if (!monthKey) {
          // Fallback to current month if unscheduled
          const now = new Date();
          monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }

        if (!map.has(key)) {
          map.set(key, {
            fgId: fgId || key,
            name,
            code: it.productCode || fgObj?.code || masterFg?.code || '',
            description,
            unit,
            hsnCode,
            monthlyQuantities: {},
            totalDemandQty: 0,
            plannedQty: 0,
            balanceQty: 0,
            contributingPOs: []
          });
        }

        const entry = map.get(key)!;
        entry.monthlyQuantities[monthKey] = (entry.monthlyQuantities[monthKey] || 0) + qty;
        entry.totalDemandQty += qty;

        if (poMRP.status === 'MRP Generated') {
          entry.plannedQty += qty;
        }

        entry.contributingPOs.push({
          poId: po._id,
          poNumber: po.poNumber,
          customerName: po.customerName || po.customer?.name || 'Customer',
          poDate: po.date,
          deliveryDate: itemDate,
          monthKey,
          quantity: qty,
          unit,
          isPlanned: poMRP.status === 'MRP Generated',
          mrpNumber: poMRP.mrpNumber,
          mrpPlanId: poMRP.planId,
          poRaw: po
        });
      });
    });

    // Compute balance quantities & resolve all linked MRP Plan numbers prominently
    const rows = Array.from(map.values()).map((row) => {
      // 1. MRP numbers from contributing POs
      const mrpNumsFromPOs = row.contributingPOs.map((c) => c.mrpNumber).filter(Boolean) as string[];
      // 2. MRP numbers from mrpPlans directly referencing this item
      const mrpNumsFromPlans = (mrpPlans || [])
        .filter((p: any) =>
          Array.isArray(p.fgItems) &&
          p.fgItems.some(
            (f: any) =>
              String(f.fgItem?._id || f.fgItem) === String(row.fgId) ||
              (f.fgItemName && f.fgItemName.trim().toLowerCase() === row.name.trim().toLowerCase())
          )
        )
        .map((p: any) => p.mrpNumber)
        .filter(Boolean) as string[];

      const allUniqueMrpNumbers = Array.from(new Set([...mrpNumsFromPOs, ...mrpNumsFromPlans]));

      return {
        ...row,
        balanceQty: Math.max(0, row.totalDemandQty - row.plannedQty),
        linkedMrpNumbers: allUniqueMrpNumbers
      };
    });

    // Filter matrix rows based on search
    if (searchTerm.trim()) {
      return rows.filter((r) => isSpaceFreeMatch(r.name, searchTerm) || isSpaceFreeMatch(r.description, searchTerm));
    }

    return rows;
  }, [customerPOs, fgItems, mrpPlans, searchTerm, filterCustomers]);

  // Selection handlers
  const toggleSelectPo = (poId: string) => {
    setSelectedPoIds((prev) => (prev.includes(poId) ? prev.filter((id) => id !== poId) : [...prev, poId]));
  };

  const toggleSelectAllFiltered = () => {
    const allIds = filteredCustomerPOs.map((p) => p._id);
    const areAllSelected = allIds.length > 0 && allIds.every((id) => selectedPoIds.includes(id));
    if (areAllSelected) {
      setSelectedPoIds((prev) => prev.filter((id) => !allIds.includes(id)));
    } else {
      setSelectedPoIds((prev) => Array.from(new Set([...prev, ...allIds])));
    }
  };

  // Toggle PO row expansion for line items preview
  const togglePoExpand = (poId: string) => {
    setExpandedPoIds((prev) => {
      const next = new Set(prev);
      if (next.has(poId)) next.delete(poId);
      else next.add(poId);
      return next;
    });
  };

  // Toggle Matrix item row expansion
  const toggleMatrixItemExpand = (itemKey: string) => {
    setExpandedMatrixItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemKey)) next.delete(itemKey);
      else next.add(itemKey);
      return next;
    });
  };

  // Matrix Multi-Item & Multi-Month Selection Helpers
  const isMonthFullySelected = (monthKey: string) => {
    const demandingRows = monthMatrixData.filter((r) => (r.monthlyQuantities[monthKey] || 0) > 0);
    return (
      demandingRows.length > 0 &&
      demandingRows.every((r) => selectedMatrixCells.has(`${r.fgId}::${monthKey}`))
    );
  };

  const isMonthPartiallySelected = (monthKey: string) => {
    const demandingRows = monthMatrixData.filter((r) => (r.monthlyQuantities[monthKey] || 0) > 0);
    return (
      demandingRows.some((r) => selectedMatrixCells.has(`${r.fgId}::${monthKey}`)) &&
      !demandingRows.every((r) => selectedMatrixCells.has(`${r.fgId}::${monthKey}`))
    );
  };

  const toggleMatrixCell = (fgId: string, monthKey: string) => {
    const key = `${fgId}::${monthKey}`;
    setSelectedMatrixCells((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleMatrixRow = (fgId: string, monthlyQuantities: Record<string, number>) => {
    const activeMonthKeys = Object.entries(monthlyQuantities)
      .filter(([_, q]) => q > 0)
      .map(([mKey]) => mKey);

    if (activeMonthKeys.length === 0) return;

    setSelectedMatrixCells((prev) => {
      const next = new Set(prev);
      const allSelected = activeMonthKeys.every((mKey) => next.has(`${fgId}::${mKey}`));

      if (allSelected) {
        activeMonthKeys.forEach((mKey) => next.delete(`${fgId}::${mKey}`));
      } else {
        activeMonthKeys.forEach((mKey) => next.add(`${fgId}::${mKey}`));
      }
      return next;
    });
  };

  const toggleMatrixMonthColumn = (monthKey: string) => {
    const demandingRows = monthMatrixData.filter((r) => (r.monthlyQuantities[monthKey] || 0) > 0);
    if (demandingRows.length === 0) return;

    setSelectedMatrixCells((prev) => {
      const next = new Set(prev);
      const allSelected = demandingRows.every((r) => next.has(`${r.fgId}::${monthKey}`));

      if (allSelected) {
        demandingRows.forEach((r) => next.delete(`${r.fgId}::${monthKey}`));
      } else {
        demandingRows.forEach((r) => next.add(`${r.fgId}::${monthKey}`));
      }
      return next;
    });
  };

  const toggleSelectAllMatrix = () => {
    const allCells: string[] = [];
    monthMatrixData.forEach((row) => {
      Object.entries(row.monthlyQuantities).forEach(([mKey, q]) => {
        if (q > 0) allCells.push(`${row.fgId}::${mKey}`);
      });
    });

    if (allCells.length === 0) return;

    const areAllSelected = allCells.every((k) => selectedMatrixCells.has(k));
    if (areAllSelected) {
      setSelectedMatrixCells(new Set());
    } else {
      setSelectedMatrixCells(new Set(allCells));
    }
  };

  const clearMatrixSelection = () => {
    setSelectedMatrixCells(new Set());
  };

  // Aggregated Summary of Selected Matrix Cells for Planning
  const matrixSelectedSummary = useMemo(() => {
    if (selectedMatrixCells.size === 0) {
      return {
        distinctItemCount: 0,
        distinctMonthsCount: 0,
        distinctMonthsList: [] as string[],
        totalQuantity: 0,
        totalValuationInr: 0,
        inrFormatted: '₹0',
        contributingPoIds: [] as string[],
        contributingPOsList: [] as any[],
        consolidatedFGItems: [] as any[]
      };
    }

    const itemMap = new Map<string, any>();
    const monthSet = new Set<string>();
    const poMap = new Map<string, any>();
    let totalQty = 0;
    let totalValuation = 0;

    monthMatrixData.forEach((row) => {
      Object.entries(row.monthlyQuantities).forEach(([mKey, qty]) => {
        if (qty > 0 && selectedMatrixCells.has(`${row.fgId}::${mKey}`)) {
          monthSet.add(mKey);
          totalQty += qty;

          if (!itemMap.has(row.fgId)) {
            let validFgObjectId = /^[0-9a-fA-F]{24}$/.test(String(row.fgId || '')) ? row.fgId : '';
            if (!validFgObjectId) {
              const matchedMaster = fgItems.find((f: any) =>
                (f.name && f.name.toLowerCase().trim() === row.name.toLowerCase().trim()) ||
                (f.code && row.code && f.code.toLowerCase().trim() === row.code.toLowerCase().trim())
              );
              if (matchedMaster?._id && /^[0-9a-fA-F]{24}$/.test(String(matchedMaster._id))) {
                validFgObjectId = String(matchedMaster._id);
              }
            }

            itemMap.set(row.fgId, {
              fgItem: validFgObjectId || undefined,
              fgItemName: row.name,
              description: row.description,
              unit: row.unit,
              quantity: 0,
              sellingPrice: 0,
              totalPrice: 0,
              hsnCode: row.hsnCode,
              earliestDate: '',
              sourceCustomerPOs: new Set<string>(),
              sourceBreakdown: [] as any[]
            });
          }

          const itemEntry = itemMap.get(row.fgId)!;
          itemEntry.quantity += qty;

          // Find contributing POs for this item & month
          const matchedPOs = row.contributingPOs.filter((c) => c.monthKey === mKey);
          matchedPOs.forEach((c) => {
            if (c.poId) {
              poMap.set(String(c.poId), c.poRaw || { _id: c.poId, poNumber: c.poNumber, customerName: c.customerName });
              itemEntry.sourceCustomerPOs.add(String(c.poId));
            }
            if (c.deliveryDate) {
              if (!itemEntry.earliestDate || c.deliveryDate < itemEntry.earliestDate) {
                itemEntry.earliestDate = c.deliveryDate;
              }
            }

            const poItemMatch = (c.poRaw?.items || []).find((it: any) => {
              const fId = it.fgItem?._id || it.fgItem;
              return String(fId) === String(row.fgId) || it.productName === row.name;
            });
            const rate = Number(poItemMatch?.rate || 0);
            const curr = (c.poRaw?.currency || 'INR').trim().toUpperCase();
            const inrVal = convertToINR(rate * c.quantity, curr).inrAmount;
            totalValuation += inrVal;

            itemEntry.sourceBreakdown.push({
              customerPo: /^[0-9a-fA-F]{24}$/.test(String(c.poId || '')) ? c.poId : undefined,
              customerPoNumber: c.poNumber,
              customerName: c.customerName,
              quantity: c.quantity,
              monthKey: mKey,
              currency: curr,
              originalRate: rate
            });
          });
        }
      });
    });

    const consolidatedFGItems = Array.from(itemMap.values()).map((it) => ({
      fgItem: it.fgItem,
      fgItemName: it.fgItemName,
      description: it.description,
      unit: it.unit,
      quantity: it.quantity,
      sellingPrice: it.quantity > 0 ? Math.round((totalValuation / totalQty) * 100) / 100 : 0,
      totalPrice: Math.round((it.quantity * (it.quantity > 0 ? totalValuation / totalQty : 0)) * 100) / 100,
      targetDate: it.earliestDate || new Date().toISOString().slice(0, 10),
      sourceCustomerPOs: Array.from(it.sourceCustomerPOs),
      sourceBreakdown: it.sourceBreakdown
    }));

    const contributingPoIds = Array.from(poMap.keys());
    const contributingPOsList = Array.from(poMap.values());
    const monthsSorted = Array.from(monthSet).sort();

    return {
      distinctItemCount: itemMap.size,
      distinctMonthsCount: monthSet.size,
      distinctMonthsList: monthsSorted,
      totalQuantity: totalQty,
      totalValuationInr: totalValuation,
      inrFormatted: `₹${Math.round(totalValuation).toLocaleString('en-IN')}`,
      contributingPoIds,
      contributingPOsList,
      consolidatedFGItems
    };
  }, [selectedMatrixCells, monthMatrixData, convertToINR]);

  const handlePlanMatrixDemand = () => {
    if (matrixSelectedSummary.distinctItemCount === 0) return;

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);

    const validPoIds = matrixSelectedSummary.contributingPoIds.filter((id) => /^[0-9a-fA-F]{24}$/.test(String(id)));

    const payload = {
      poIds: validPoIds,
      selectedMonths: matrixSelectedSummary.distinctMonthsList,
      initialPlanData: {
        isConsolidated: true,
        mrpNumber: `MRP-DEMAND-${dateStr}-${randomSuffix}`,
        customerPOs: matrixSelectedSummary.contributingPOsList,
        customerPoIds: validPoIds,
        fgItems: matrixSelectedSummary.consolidatedFGItems,
        remarks: `Planned from Month-Wise Item Matrix for months: ${matrixSelectedSummary.distinctMonthsList.join(', ')}`
      }
    };

    if (onPlanMatrixDemand) {
      onPlanMatrixDemand(payload);
    } else {
      onPlanConsolidatedPos(matrixSelectedSummary.contributingPoIds);
    }
  };

  return (
    <div className="w-full h-full flex-1 min-h-0 flex flex-col overflow-hidden space-y-3">
      {/* 1. TOP VIEW MODE SWITCHER & DASHBOARD TOGGLE BAR */}
      <div className="shrink-0 bg-white dark:bg-slate-900 p-2 sm:p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto scroll-smooth py-0.5 no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveView('pos')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeView === 'pos'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FileText size={14} />
            <span>Customer POs</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] ${activeView === 'pos' ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
              {filteredCustomerPOs.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('monthMatrix')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeView === 'monthMatrix'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Calendar size={14} />
            <span>Month-Wise Item Matrix</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] ${activeView === 'monthMatrix' ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
              {monthMatrixData.length}
            </span>
            {selectedMatrixCells.size > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-violet-200 text-violet-800 dark:bg-violet-900 dark:text-violet-200 animate-pulse">
                {matrixSelectedSummary.distinctItemCount} selected
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            type="button"
            onClick={() => setShowDashboard((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              showDashboard
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800 shadow-2xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60'
            }`}
            title={showDashboard ? 'Hide KPI Dashboard' : 'Show KPI Dashboard'}
          >
            <LayoutGrid size={14} />
            <span>{showDashboard ? 'Hide Dashboard' : 'Dashboard'}</span>
          </button>

          <button
            type="button"
            onClick={fetchDemandData}
            title="Refresh Customer POs & MRP status"
            disabled={loading}
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-indigo-600' : ''} />
          </button>
        </div>
      </div>

      {/* 2. SUMMARY KPI OVERVIEW CARDS (Hidden by default, shown via Dashboard button) */}
      {showDashboard && (
        <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="bg-white dark:bg-slate-900 p-3 sm:p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
              <span className="uppercase text-[10px] tracking-wider">Open Customer POs</span>
              <FileText size={14} className="text-blue-500" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
                {kpiStats.totalOpenPOs}
              </span>
              <span className="text-[11px] font-semibold text-slate-500">Orders</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-3 sm:p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
              <span className="uppercase text-[10px] tracking-wider">Total Demanded Qty</span>
              <Package size={14} className="text-indigo-500" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                {kpiStats.totalDemandedQty.toLocaleString()}
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                Across {kpiStats.uniqueItemCount} Items
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-3 sm:p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
              <span className="uppercase text-[10px] tracking-wider">Demand Valuation</span>
              <TrendingUp size={14} className="text-emerald-500" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {kpiStats.formattedValuation}
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-3 sm:p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
              <span className="uppercase text-[10px] tracking-wider">Planning Progress</span>
              <Sparkles size={14} className="text-amber-500" />
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200">
                {kpiStats.unplannedCount} Unplanned
              </span>
              <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200">
                {kpiStats.plannedCount} In MRP
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. SEARCH & FILTER TOOLBAR */}
      <div className="shrink-0 bg-white dark:bg-slate-900 p-2.5 sm:p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by PO #, Customer, or FG Item Name / Description..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs px-1"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
          >
            <option value="all">All Planning Statuses</option>
            <option value="unplanned">⚪ Unplanned Only</option>
            <option value="mrp_done">🟢 MRP Generated</option>
          </select>

          {/* Customer Multi-Select Filter */}
          <SearchableMultiSelect
            options={customerOptions}
            selectedValues={filterCustomers}
            onChange={setFilterCustomers}
            placeholder="All Customers"
            searchPlaceholder="Search customer..."
            className="w-44 sm:w-52"
          />

          {/* Month Filter */}
          <select
            value={selectedMonthFilter}
            onChange={(e) => setSelectedMonthFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
          >
            <option value="all">All Delivery Months</option>
            {monthBuckets.map((m) => (
              <option key={m.key} value={m.key}>
                {m.shortLabel}
              </option>
            ))}
          </select>

          {/* Reset Filters */}
          {(searchTerm || statusFilter !== 'all' || filterCustomers.length > 0 || selectedMonthFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setFilterCustomers([]);
                setSelectedMonthFilter('all');
              }}
              className="px-2.5 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* 4. MAIN CONTENT AREA: POS VIEW vs MONTH-WISE MATRIX */}
      <div className="flex-1 min-h-0 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <span className="text-xs font-bold text-slate-500">Loading demand intake data...</span>
            </div>
          </div>
        ) : activeView === 'pos' ? (
          /* ========================================================= */
          /* VIEW 1: CUSTOMER POs TABLE & PREVIEW                      */
          /* ========================================================= */
          <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
            {filteredCustomerPOs.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  No Customer POs match criteria
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Adjust filters or log incoming customer orders from Sales module.
                </p>
              </div>
            ) : (
              <table className="w-full text-xs text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 shadow-2xs">
                  <tr>
                    <th className="px-3 py-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          filteredCustomerPOs.length > 0 &&
                          filteredCustomerPOs.every((p) => selectedPoIds.includes(p._id))
                        }
                        onChange={toggleSelectAllFiltered}
                        title="Select all Customer POs for consolidated MRP"
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4"
                      />
                    </th>
                    <th className="px-4 py-3">Customer PO #</th>
                    <th className="px-4 py-3">Customer Name</th>
                    <th className="px-4 py-3 text-center">Order Date</th>
                    <th className="px-4 py-3 text-center">OA & Committed Date</th>
                    <th className="px-4 py-3 text-center">Ordered Items</th>
                    <th className="px-4 py-3 text-center">MRP Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredCustomerPOs.map((po) => {
                    const isSelected = selectedPoIds.includes(po._id);
                    const isExpanded = expandedPoIds.has(po._id);
                    const mrpInfo = getPoMRPStatus(po);
                    const hasOA = Boolean(po.acknowledgementNumber || po.committedDispatchDate);
                    const oaNumber = getPoOaNumber(po);
                    const commitDate = po.committedDispatchDate;
                    const itemsCount = (po.items || []).length;
                    const totalQty = (po.items || []).reduce((acc: number, it: any) => acc + Number(it.quantity || 0), 0);

                    return (
                      <React.Fragment key={po._id}>
                        <tr
                          className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${
                            isSelected ? 'bg-indigo-50/60 dark:bg-indigo-950/30' : ''
                          }`}
                        >
                          <td className="px-3 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectPo(po._id)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4"
                            />
                          </td>

                          {/* Customer PO # */}
                          <td className="px-4 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{po.poNumber}</span>
                              {(po.pdf || (Array.isArray(po.photos) && po.photos.length > 0)) && (
                                <a
                                  href={po.pdf || po.photos[0]}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200"
                                >
                                  <Paperclip size={9} />
                                  <span>Doc</span>
                                </a>
                              )}
                            </div>
                          </td>

                          {/* Customer Name */}
                          <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">
                            <div className="flex items-center gap-1.5">
                              <Building2 size={13} className="text-blue-500 shrink-0" />
                              <span className="truncate max-w-[200px]">
                                {po.customerName || po.customer?.name || po.customer?.companyName || 'Customer'}
                              </span>
                            </div>
                          </td>

                          {/* PO Date */}
                          <td className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {po.date ? new Date(po.date).toLocaleDateString('en-GB') : 'N/A'}
                          </td>

                          {/* OA & Committed Date */}
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            {hasOA && commitDate ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="font-bold text-indigo-600 dark:text-indigo-400 text-[11px] flex items-center gap-1">
                                  <Calendar size={11} />
                                  {new Date(commitDate).toLocaleDateString('en-GB')}
                                </span>
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200">
                                  ✓ OA: {oaNumber || 'Accepted'}
                                </span>
                              </div>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200">
                                ⏳ Pending OA
                              </span>
                            )}
                          </td>

                          {/* Ordered Items Summary */}
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => togglePoExpand(po._id)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[11px] cursor-pointer"
                            >
                              <Package size={11} className="text-indigo-500" />
                              <span>{itemsCount} Item{itemsCount !== 1 ? 's' : ''} ({totalQty})</span>
                              {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                            </button>
                          </td>

                          {/* MRP Status Badge */}
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            {mrpInfo.status === 'MRP Generated' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  if (mrpInfo.planId && onViewPlanDetails) {
                                    const fullPlan = (mrpPlans || []).find((p) => p._id === mrpInfo.planId);
                                    if (fullPlan) onViewPlanDetails(fullPlan);
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 cursor-pointer"
                                title="Click to view linked MRP plan details"
                              >
                                <CheckCircle2 size={11} />
                                <span>{mrpInfo.mrpNumber || 'MRP Done'}</span>
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200">
                                <Clock size={10} />
                                <span>Ready to Plan</span>
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => onPlanSinglePo(po)}
                                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded-lg shadow-2xs flex items-center gap-1 transition-all transform hover:scale-[1.02] cursor-pointer"
                                title="Generate MRP Demand Plan directly for this Customer PO"
                              >
                                <Sparkles size={11} />
                                <span>Plan MRP</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => togglePoExpand(po._id)}
                                className="p-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                title="Toggle Line Items Preview"
                              >
                                {isExpanded ? <ChevronUp size={14} /> : <Eye size={14} />}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* LINE ITEMS PREVIEW (ACCORDION DRAWER) */}
                        {isExpanded && (
                          <tr className="bg-slate-50/60 dark:bg-slate-900/40">
                            <td colSpan={8} className="p-3 sm:p-4">
                              <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700 p-3 space-y-2">
                                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/80 pb-2">
                                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                                    <Package size={13} />
                                    <span>Demanded Line Items & Delivery Schedule (PO #{po.poNumber})</span>
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-semibold">
                                    {itemsCount} item{itemsCount !== 1 ? 's' : ''} total
                                  </span>
                                </div>

                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs">
                                    <thead>
                                      <tr className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-100 dark:border-slate-700">
                                        <th className="py-1.5 px-2">#</th>
                                        <th className="py-1.5 px-2">Item Name & Technical Description</th>
                                        <th className="py-1.5 px-2 text-center">Delivery Month / Date</th>
                                        <th className="py-1.5 px-2 text-right">Ordered Qty</th>
                                        <th className="py-1.5 px-2 text-right">Rate</th>
                                        <th className="py-1.5 px-2 text-right">Amount</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                      {(po.items || []).map((it: any, idx: number) => {
                                        const fgObj = it.fgItem && typeof it.fgItem === 'object' ? it.fgItem : null;
                                        const itemName = it.productName || fgObj?.name || 'Finished Good';
                                        const itemDesc =
                                          it.description ||
                                          fgObj?.description ||
                                          fgObj?.descriptions ||
                                          '';
                                        const delDate = it.expectedDeliveryDate || po.committedDispatchDate || po.date;
                                        const delMonthStr = delDate
                                          ? new Date(delDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                                          : 'Unspecified';

                                        return (
                                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                                            <td className="py-2 px-2 font-mono text-slate-400 text-[10px]">
                                              {idx + 1}
                                            </td>

                                            {/* Item Name prominently, Technical Description directly below in subtle italic per rule */}
                                            <td className="py-2 px-2">
                                              <div className="font-bold text-xs text-slate-900 dark:text-white">
                                                {itemName}
                                              </div>
                                              {itemDesc && (
                                                <div className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-0.5 line-clamp-2">
                                                  {itemDesc}
                                                </div>
                                              )}
                                            </td>

                                            <td className="py-2 px-2 text-center whitespace-nowrap">
                                              <span className="font-bold text-indigo-600 dark:text-indigo-400 text-[11px]">
                                                {delMonthStr}
                                              </span>
                                              {delDate && (
                                                <div className="text-[10px] text-slate-400">
                                                  {new Date(delDate).toLocaleDateString('en-GB')}
                                                </div>
                                              )}
                                            </td>

                                            <td className="py-2 px-2 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                                              {Number(it.quantity || 0).toLocaleString()} {it.unit || 'PCS'}
                                            </td>

                                            <td className="py-2 px-2 text-right font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                                              {getCurrencySymbol(po.currency)}{Number(it.rate || 0).toLocaleString()}
                                            </td>

                                            <td className="py-2 px-2 text-right font-mono font-bold text-slate-900 dark:text-white text-[11px]">
                                              {getCurrencySymbol(po.currency)}{Number(it.amount || (it.quantity * it.rate) || 0).toLocaleString()}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          /* ========================================================= */
          /* VIEW 2: MONTH-WISE ITEM PLANNING MATRIX                   */
          /* ========================================================= */
          <div className="flex-1 flex flex-col min-h-0">
            {/* Matrix Calendar Navigation Bar */}
            <div className="shrink-0 p-2.5 sm:p-3 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMonthStepOffset((prev) => prev - 1)}
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft size={13} />
                  <span>Prev 6 Months</span>
                </button>

                <div className="px-3 py-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-xs text-indigo-600 dark:text-indigo-400 shadow-2xs">
                  {monthBuckets[0]?.label} – {monthBuckets[monthBuckets.length - 1]?.label}
                </div>

                <button
                  type="button"
                  onClick={() => setMonthStepOffset((prev) => prev + 1)}
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center gap-1 cursor-pointer"
                >
                  <span>Next 6 Months</span>
                  <ArrowRight size={13} />
                </button>
              </div>

              {monthStepOffset !== 0 && (
                <button
                  type="button"
                  onClick={() => setMonthStepOffset(0)}
                  className="px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Reset to Current
                </button>
              )}
            </div>

            {/* Matrix Table */}
            <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
              {monthMatrixData.length === 0 ? (
                <div className="p-12 text-center">
                  <Calendar className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    No Demanded Items Found in Planning Schedule
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Log Customer POs with expected delivery dates to view month-by-month demand breakdown.
                  </p>
                </div>
              ) : (
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 shadow-2xs">
                    <tr>
                      {/* Master Checkbox */}
                      <th className="px-3 py-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            monthMatrixData.length > 0 &&
                            monthMatrixData.some((r) => Object.values(r.monthlyQuantities).some((q) => q > 0)) &&
                            monthMatrixData.every((r) =>
                              Object.entries(r.monthlyQuantities).every(
                                ([mKey, q]) => q === 0 || selectedMatrixCells.has(`${r.fgId}::${mKey}`)
                              )
                            )
                          }
                          onChange={toggleSelectAllMatrix}
                          title="Select / deselect all demanding items & active months"
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4"
                        />
                      </th>
                      <th className="px-4 py-3 min-w-[280px]">Finished Good & Description</th>
                      {monthBuckets.map((b) => {
                        const isColFullySelected = isMonthFullySelected(b.key);
                        const isColPartially = isMonthPartiallySelected(b.key);
                        return (
                          <th key={b.key} className="px-2 py-2 text-center min-w-[110px]">
                            <button
                              type="button"
                              onClick={() => toggleMatrixMonthColumn(b.key)}
                              className={`w-full py-1 px-1.5 rounded-lg text-[10px] font-black transition-all cursor-pointer flex items-center justify-center gap-1 border ${
                                isColFullySelected
                                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs ring-1 ring-indigo-400'
                                  : isColPartially
                                  ? 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300'
                                  : 'bg-white/90 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-200'
                              }`}
                              title={`Click to select/deselect ${b.label} for all demanding items`}
                            >
                              <span>{b.shortLabel}</span>
                            </button>
                          </th>
                        );
                      })}
                      <th className="px-3 py-3 text-right min-w-[100px]">Total Demand</th>
                      <th className="px-3 py-3 text-right min-w-[110px]">In MRP</th>
                      <th className="px-3 py-3 text-right min-w-[100px]">Net Balance</th>
                      <th className="px-3 py-3 text-center min-w-[70px]">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {monthMatrixData.map((row) => {
                      const isExpanded = expandedMatrixItems.has(row.fgId);
                      const isFullyPlanned = row.balanceQty === 0 && row.totalDemandQty > 0;
                      const activeMonthKeys = Object.entries(row.monthlyQuantities)
                        .filter(([_, q]) => q > 0)
                        .map(([mKey]) => mKey);
                      const isRowFullySelected =
                        activeMonthKeys.length > 0 &&
                        activeMonthKeys.every((mKey) => selectedMatrixCells.has(`${row.fgId}::${mKey}`));
                      const isRowPartiallySelected =
                        activeMonthKeys.some((mKey) => selectedMatrixCells.has(`${row.fgId}::${mKey}`)) &&
                        !isRowFullySelected;

                      return (
                        <React.Fragment key={row.fgId}>
                          <tr className={`transition-colors ${isRowFullySelected ? 'bg-indigo-50/50 dark:bg-indigo-950/30' : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/50'}`}>
                            {/* Row Checkbox */}
                            <td className="px-3 py-3 w-10 text-center">
                              <input
                                type="checkbox"
                                checked={isRowFullySelected}
                                ref={(el) => {
                                  if (el) el.indeterminate = isRowPartiallySelected;
                                }}
                                onChange={() => toggleMatrixRow(row.fgId, row.monthlyQuantities)}
                                title={`Select / deselect all active months for ${row.name}`}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4"
                              />
                            </td>

                            {/* Item Identity - Name prominently + Technical Description in italic + Prominent MRP Badges */}
                            <td className="px-4 py-3">
                              <div className="font-bold text-xs text-slate-900 dark:text-white">
                                {row.name}
                              </div>
                              {row.description && (
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-0.5 line-clamp-2">
                                  {row.description}
                                </div>
                              )}
                              <div className="flex items-center gap-2 flex-wrap mt-1.5">
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                  UOM: {row.unit}
                                </span>
                                {/* Prominently Visible MRP Number Badges on Item */}
                                {row.linkedMrpNumbers && row.linkedMrpNumbers.length > 0 ? (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span className="text-[10px] font-bold text-slate-400">MRP:</span>
                                    {row.linkedMrpNumbers.map((mNum) => {
                                      const planObj = (mrpPlans || []).find((p) => p.mrpNumber === mNum);
                                      return (
                                        <button
                                          key={mNum}
                                          type="button"
                                          onClick={() => {
                                            if (planObj && onViewPlanDetails) onViewPlanDetails(planObj);
                                          }}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-mono font-black bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/70 dark:hover:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700 shadow-2xs cursor-pointer transition-colors"
                                          title="Linked MRP Demand Plan - Click to view plan details"
                                        >
                                          <Sparkles size={9} className="text-indigo-500 shrink-0" />
                                          <span>{mNum}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic font-medium">Unplanned</span>
                                )}
                              </div>
                            </td>

                            {/* 6 Month Columns with Selectable Badges & MRP Status Tag */}
                            {monthBuckets.map((b) => {
                              const qty = row.monthlyQuantities[b.key] || 0;
                              const isCellSelected = selectedMatrixCells.has(`${row.fgId}::${b.key}`);
                              const monthPOs = row.contributingPOs.filter((c) => c.monthKey === b.key);
                              const isMonthPlanned = monthPOs.length > 0 && monthPOs.every((c) => c.isPlanned);
                              const monthMrpNumbers = Array.from(new Set(monthPOs.map((c) => c.mrpNumber).filter(Boolean)));

                              return (
                                <td key={b.key} className="px-2 py-3 text-center">
                                  {qty > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => toggleMatrixCell(row.fgId, b.key)}
                                      className={`inline-flex flex-col items-center justify-center px-2 py-1 rounded-xl font-mono text-[11px] font-black border transition-all cursor-pointer ${
                                        isCellSelected
                                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-md ring-2 ring-indigo-400/40 transform scale-105'
                                          : isMonthPlanned
                                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300'
                                          : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 hover:border-indigo-400'
                                      }`}
                                      title={`Click to select/deselect ${qty.toLocaleString()} ${row.unit} for ${b.shortLabel}${monthMrpNumbers.length > 0 ? ` (Linked: ${monthMrpNumbers.join(', ')})` : ''}`}
                                    >
                                      <div className="flex items-center gap-1">
                                        {isCellSelected && <Check size={11} strokeWidth={3} />}
                                        <span>{qty.toLocaleString()}</span>
                                      </div>
                                      {monthMrpNumbers.length > 0 && (
                                        <span className={`text-[8px] font-mono leading-none mt-0.5 truncate max-w-[70px] ${isCellSelected ? 'text-indigo-100' : 'text-indigo-600 dark:text-indigo-400 font-extrabold'}`}>
                                          {monthMrpNumbers[0]}
                                        </span>
                                      )}
                                    </button>
                                  ) : (
                                    <span className="text-slate-300 dark:text-slate-600 font-mono">-</span>
                                  )}
                                </td>
                              );
                            })}

                            {/* Total Demand */}
                            <td className="px-3 py-3 text-right font-mono font-bold text-slate-900 dark:text-white text-xs">
                              {row.totalDemandQty.toLocaleString()} {row.unit}
                            </td>

                            {/* In MRP with Primary Linked Plan Number */}
                            <td className="px-3 py-3 text-right">
                              <div className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                                {row.plannedQty.toLocaleString()} {row.unit}
                              </div>
                              {row.linkedMrpNumbers && row.linkedMrpNumbers.length > 0 && (
                                <div className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-extrabold truncate max-w-[110px] ml-auto mt-0.5" title={row.linkedMrpNumbers.join(', ')}>
                                  {row.linkedMrpNumbers[0]}
                                  {row.linkedMrpNumbers.length > 1 && ` (+${row.linkedMrpNumbers.length - 1})`}
                                </div>
                              )}
                            </td>

                            {/* Net Balance */}
                            <td className="px-3 py-3 text-right font-mono font-bold text-xs">
                              {row.balanceQty > 0 ? (
                                <span className="text-amber-600 dark:text-amber-400 font-extrabold">
                                  {row.balanceQty.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-400">0</span>
                              )}
                            </td>

                            {/* Drilldown Expander */}
                            <td className="px-3 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => toggleMatrixItemExpand(row.fgId)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                                title="View contributing Customer POs"
                              >
                                {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                              </button>
                            </td>
                          </tr>

                          {/* Matrix Contributing POs Breakdown */}
                          {isExpanded && (
                            <tr className="bg-slate-50/70 dark:bg-slate-900/50">
                              <td colSpan={12} className="p-3 sm:p-4">
                                <div className="bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                                    <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                                      Customer POs Demanding: {row.name}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      {row.contributingPOs.length} PO demand commitment(s)
                                    </span>
                                  </div>

                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                      <thead>
                                        <tr className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-100 dark:border-slate-700">
                                          <th className="py-1 px-2">Customer PO #</th>
                                          <th className="py-1 px-2">Customer</th>
                                          <th className="py-1 px-2 text-center">Scheduled Month</th>
                                          <th className="py-1 px-2 text-right">Committed Qty</th>
                                          <th className="py-1 px-2 text-center">MRP Status</th>
                                          <th className="py-1 px-2 text-right">Quick Plan</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                        {row.contributingPOs.map((cPo, cIdx) => (
                                          <tr key={cIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                                            <td className="py-1.5 px-2 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                              {cPo.poNumber}
                                            </td>
                                            <td className="py-1.5 px-2 font-semibold text-slate-800 dark:text-slate-200">
                                              {cPo.customerName}
                                            </td>
                                            <td className="py-1.5 px-2 text-center font-bold text-slate-600 dark:text-slate-300">
                                              {cPo.monthKey}
                                            </td>
                                            <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-900 dark:text-white">
                                              {cPo.quantity.toLocaleString()} {cPo.unit}
                                            </td>
                                            <td className="py-1.5 px-2 text-center">
                                              {cPo.isPlanned ? (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    if (cPo.mrpPlanId && onViewPlanDetails) {
                                                      const p = (mrpPlans || []).find((mp) => mp._id === cPo.mrpPlanId || mp.mrpNumber === cPo.mrpNumber);
                                                      if (p) onViewPlanDetails(p);
                                                    }
                                                  }}
                                                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 cursor-pointer shadow-2xs"
                                                  title="Click to view linked MRP plan details"
                                                >
                                                  <CheckCircle2 size={10} className="text-emerald-600" />
                                                  <span>{cPo.mrpNumber || 'Planned'}</span>
                                                </button>
                                              ) : (
                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                  Unplanned
                                                </span>
                                              )}
                                            </td>
                                            <td className="py-1.5 px-2 text-right">
                                              <button
                                                type="button"
                                                onClick={() => onPlanSinglePo(cPo.poRaw)}
                                                className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 rounded font-bold text-[10px] border border-indigo-200 cursor-pointer"
                                              >
                                                ⚡ Plan PO
                                              </button>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 5. FLOATING CONSOLIDATED ACTION BAR (When 1+ POs selected in 'pos' view) */}
      {activeView === 'pos' && selectedPoIds.length > 0 && (
        <div className="shrink-0 bg-slate-900/95 dark:bg-slate-800/95 text-white border border-slate-700 shadow-2xl backdrop-blur-md px-4 py-3 rounded-2xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse"></span>
            <div>
              <span className="text-xs font-black text-white">
                {selectedFinancials.count} Customer PO{selectedFinancials.count > 1 ? 's' : ''} Selected
              </span>
              <div className="text-[11px] text-slate-300 font-mono">
                Valuation: <strong className="text-indigo-300">{selectedFinancials.inrFormatted}</strong> • Total Items: <strong className="text-white">{selectedFinancials.totalItemsQty}</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPlanConsolidatedPos(selectedPoIds)}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all transform hover:scale-[1.02] cursor-pointer"
            >
              <Sparkles size={14} />
              <span>Create Consolidated MRP ({selectedFinancials.count})</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedPoIds([])}
              className="px-3 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* 6. FLOATING ACTION BAR FOR MONTH-WISE MATRIX DEMAND PLANNING (When 1+ cells selected) */}
      {activeView === 'monthMatrix' && selectedMatrixCells.size > 0 && (
        <div className="shrink-0 bg-slate-900/95 dark:bg-slate-800/95 text-white border border-slate-700 shadow-2xl backdrop-blur-md px-4 py-3 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-400 animate-pulse shrink-0"></span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black text-white">
                  {matrixSelectedSummary.distinctItemCount} Finished Good{matrixSelectedSummary.distinctItemCount !== 1 ? 's' : ''} Selected
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-violet-500/30 text-violet-200 border border-violet-400/40">
                  {matrixSelectedSummary.distinctMonthsCount} Month{matrixSelectedSummary.distinctMonthsCount !== 1 ? 's' : ''} ({matrixSelectedSummary.distinctMonthsList.join(', ')})
                </span>
              </div>
              <div className="text-[11px] text-slate-300 font-mono mt-0.5">
                Total Qty: <strong className="text-white">{matrixSelectedSummary.totalQuantity.toLocaleString()}</strong> • Valuation: <strong className="text-emerald-300">{matrixSelectedSummary.inrFormatted}</strong> • From <strong className="text-indigo-300">{matrixSelectedSummary.contributingPoIds.length}</strong> Customer PO{matrixSelectedSummary.contributingPoIds.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={handlePlanMatrixDemand}
              className="px-4 py-2 bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all transform hover:scale-[1.02] cursor-pointer"
              title="Generate MRP Demand Plan directly for the selected items and months"
            >
              <Sparkles size={14} />
              <span>Generate MRP Plan ({matrixSelectedSummary.distinctItemCount} Item{matrixSelectedSummary.distinctItemCount !== 1 ? 's' : ''})</span>
            </button>

            <button
              type="button"
              onClick={clearMatrixSelection}
              className="px-3 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
