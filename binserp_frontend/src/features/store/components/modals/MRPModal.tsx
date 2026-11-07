import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    X,
    Plus,
    Trash2,
    Layers,
    Calendar,
    User,
    FileText,
    CheckCircle2,
    Sparkles,
    Search,
    ChevronDown,
    AlertTriangle,
    Package,
    Building,
    Boxes,
    Check,
    CheckSquare,
    Square,
    Filter,
    ListFilter,
    Target,
    RefreshCw,
    Calculator,
    SlidersHorizontal,
    Edit3
} from 'lucide-react';
import { useExchangeRates } from '@/src/hooks/useExchangeRates';
import { getExchangeRateToINR, getCurrencySymbol } from '@/src/utils/currencyHelper';
import { apiGet, apiPost, apiPut } from '@/src/lib/api';
import VendorPriceListModal from './VendorPriceListModal';
import Swal from 'sweetalert2';

interface MRPModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    token: string;
    initialData?: any;
    preselectedPoIds?: string[];
    preselectedMonth?: string;
    initialFgItems?: any[];
    initialMrpPlans?: any[];
}

interface FGRow {
    fgItem: string;
    fgItemName: string;
    fgItemCode: string;
    description: string;
    quantity: number;
    unit: string;
    sellingPrice?: number;
    totalPrice?: number;
    priceSource?: string;
    currency?: string;
    originalSellingPrice?: number;
    exchangeRate?: number;
    poDeliveryDate?: string;
    targetDate: string;
    bomId?: string;
    bomNumber?: string;
    isFromOA?: boolean;
    customerPo?: string;
    customerPoNumber?: string;
    customerName?: string;
    totalDemanded?: number;
    alreadyPlannedQty?: number;
    previousMrpNumbers?: string[];
    sourceBreakdown?: Array<{
        customerPo?: string;
        customerPoNumber: string;
        customerName: string;
        quantity: number;
        currency?: string;
        originalRate?: number;
        exchangeRate?: number;
        rateInINR?: number;
        amountInINR?: number;
    }>;
    sourceCustomerPOs?: string[];
}

interface BOMLineMaterial {
    materialKey: string;
    materialId?: string;
    materialName: string;
    materialCode?: string;
    description?: string;
    itemType: 'RM' | 'BO';
    unit: string;
    hasSecondaryUnit?: boolean;
    secondaryUnit?: string;
    conversionFactor?: number;
    quantityPerFG: number;
    requiredQuantity: number;
    secondaryRequiredQuantity?: number;
    unitCost: number;
    rawPrice?: number;
    pricingUnit?: string;
    isSecondaryUnit?: boolean;
    priceListId?: string;
    vendorId?: string;
    isPreferred?: boolean;
    taxRate?: number;
    remarks?: string;
    updatedByName?: string;
    updatedAt?: string;
    grossCost: number;
    costSource?: string;
    preferredVendorName?: string;
}

interface BOMCostSummary {
    totalRmCost: number;
    totalBoCost: number;
    totalBOMCost: number;
    rmCount: number;
    boCount: number;
    fgLineCosts?: Array<{
        index?: number;
        fgItem?: string;
        fgItemName?: string;
        fgItemCode?: string;
        quantity: number;
        rmUnitCost: number;
        rmTotalCost: number;
        rmOnlyCost: number;
        boOnlyCost: number;
        materials?: BOMLineMaterial[];
    }>;
}

export default function MRPModal({ isOpen, onClose, onSuccess, token, initialData, preselectedPoIds, preselectedMonth, initialFgItems, initialMrpPlans }: MRPModalProps) {
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const presentMonthKey = useMemo(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }, []);

    const formatMonthKeyLabel = (mKey: string) => {
        if (!mKey || !/^\d{4}-\d{2}$/.test(mKey)) return mKey;
        const [y, m] = mKey.split('-').map(Number);
        const d = new Date(y, m - 1, 1);
        return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    };

    const [selectedPlanningMonth, setSelectedPlanningMonth] = useState<string>(preselectedMonth || presentMonthKey);

    useEffect(() => {
        if (preselectedMonth) {
            setSelectedPlanningMonth(preselectedMonth);
        } else if (initialData?.planningMonth) {
            setSelectedPlanningMonth(initialData.planningMonth);
        } else {
            setSelectedPlanningMonth(presentMonthKey);
        }
    }, [preselectedMonth, initialData, presentMonthKey]);

    // Active Exchange Rates from Master > Store Settings
    const { exchangeRates } = useExchangeRates(token);

    // Masters Data
    const [customerList, setCustomerList] = useState<any[]>([]);
    const [fgItemList, setFgItemList] = useState<any[]>(() => Array.isArray(initialFgItems) ? initialFgItems : []);
    const [bomsList, setBomsList] = useState<any[]>([]);
    const [incomingPOs, setIncomingPOs] = useState<any[]>([]);
    const [existingMRPPlans, setExistingMRPPlans] = useState<any[]>(() => Array.isArray(initialMrpPlans) ? initialMrpPlans : []);

    // Plan Mode: Single PO vs Consolidated Multi-PO
    const [planMode, setPlanMode] = useState<'single' | 'consolidated'>('single');
    const [selectedMultiPoIds, setSelectedMultiPoIds] = useState<string[]>([]);
    const [multiPoSearch, setMultiPoSearch] = useState('');
    const [multiPoCustomerFilter, setMultiPoCustomerFilter] = useState('all');
    const [multiPoMrpFilter, setMultiPoMrpFilter] = useState<'pending' | 'all' | 'mrp_done'>('pending');
    const [isMultiPoSelectorExpanded, setIsMultiPoSelectorExpanded] = useState<boolean>(true);

    // Custom RM / BO Material Price Overrides (keyed by materialKey / materialCode / materialName)
    const [customMaterialPrices, setCustomMaterialPrices] = useState<Record<string, number>>({});
    const [expandedRmRowIdxs, setExpandedRmRowIdxs] = useState<Record<number, boolean>>({});
    const [showVendorPriceModal, setShowVendorPriceModal] = useState<boolean>(false);
    const [vendorPriceInitialData, setVendorPriceInitialData] = useState<any>(null);
    const [priceListRefreshTick, setPriceListRefreshTick] = useState<number>(0);
    const [activeDatePopoverIdx, setActiveDatePopoverIdx] = useState<number | null>(null);
    const datePopoverRef = useRef<HTMLDivElement>(null);

    // Form State
    const [mrpNumber, setMrpNumber] = useState('');
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [selectedPOId, setSelectedPOId] = useState('');
    const [customerPoNumber, setCustomerPoNumber] = useState('');
    const [poDate, setPoDate] = useState('');
    const [targetDate, setTargetDate] = useState('');
    const [remarks, setRemarks] = useState('');
    const [targetExpense, setTargetExpense] = useState('');
    const [bomCostSummary, setBomCostSummary] = useState<BOMCostSummary | null>(null);
    const [calculatingBOM, setCalculatingBOM] = useState<boolean>(false);

    // Dropdown / Combobox Search & Open States
    const [customerSearch, setCustomerSearch] = useState('');
    const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
    const customerDropdownRef = useRef<HTMLDivElement>(null);

    const [poSearch, setPoSearch] = useState('');
    const [isPoDropdownOpen, setIsPoDropdownOpen] = useState(false);
    const poDropdownRef = useRef<HTMLDivElement>(null);

    // FG Row Combobox Active State
    const [activeFGSearchIdx, setActiveFGSearchIdx] = useState<number | null>(null);
    const [fgSearchQuery, setFgSearchQuery] = useState('');
    const fgDropdownRef = useRef<HTMLDivElement>(null);

    // FG Items Table
    const [fgRows, setFgRows] = useState<FGRow[]>([
        { fgItem: '', fgItemName: '', fgItemCode: '', description: '', quantity: 1, unit: 'PCS', poDeliveryDate: '', targetDate: '' }
    ]);

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
                setIsCustomerDropdownOpen(false);
            }
            if (poDropdownRef.current && !poDropdownRef.current.contains(event.target as Node)) {
                setIsPoDropdownOpen(false);
            }
            if (fgDropdownRef.current && !fgDropdownRef.current.contains(event.target as Node)) {
                setActiveFGSearchIdx(null);
                setFgSearchQuery('');
            }
            if (datePopoverRef.current && !datePopoverRef.current.contains(event.target as Node)) {
                setActiveDatePopoverIdx(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Helper: Extract mapped FG rows from any Customer PO object (supporting month-specific allocation)
    const extractFGRowsFromPO = (po: any, fgList = fgItemList, bomList = bomsList, targetMonth = selectedPlanningMonth): FGRow[] => {
        if (!po || !Array.isArray(po.items) || po.items.length === 0) return [];

        const resolvedPoDate = po.deliveryDate
            ? new Date(po.deliveryDate).toISOString().split('T')[0]
            : (po.date ? new Date(po.date).toISOString().split('T')[0] : '');

        let resolvedCommittedDate = '';
        if (po.committedDispatchDate) {
            resolvedCommittedDate = new Date(po.committedDispatchDate).toISOString().split('T')[0];
        } else if (resolvedPoDate) {
            resolvedCommittedDate = resolvedPoDate;
        }

        const cName = po.customerName || (typeof po.customer === 'object' ? po.customer?.name : '') || '';

        const poCurrency = (po.currency || 'INR').trim().toUpperCase();
        const exRate = poCurrency !== 'INR' && Number(po.exchangeRate) > 0
            ? Number(po.exchangeRate)
            : getExchangeRateToINR(poCurrency, undefined, exchangeRates);

        const resultRows: FGRow[] = [];

        po.items.forEach((item: any) => {
            const pName = item.productName || item.name || item.itemName || '';
            const pCode = item.productCode || item.code || '';
            const fgObj = fgList.find(
                (f) =>
                    f._id === item.fgItem ||
                    f._id === (item.fgItem?._id || item.fgItem) ||
                    (pName && f.name?.toLowerCase() === pName.toLowerCase()) ||
                    (pCode && f.code?.toLowerCase() === pCode.toLowerCase())
            );
            const matchedBom = bomList.find(
                (b) =>
                    (fgObj &&
                        (b.productName?.toLowerCase() === fgObj.name?.toLowerCase() ||
                            b.productCode === fgObj.code)) ||
                    (pName && b.productName?.toLowerCase() === pName.toLowerCase()) ||
                    (pCode && b.productCode === pCode)
            );

            let lineQty = 0;
            let monthTargetDate = '';
            let totalMonthDemanded = 0;
            let alreadyPlannedMonthQty = 0;
            const previousMrpNumbers: string[] = [];

            if (targetMonth && targetMonth !== 'all') {
                if (Array.isArray(item.deliverySchedule) && item.deliverySchedule.length > 0) {
                    const matchedSched = item.deliverySchedule.filter((s: any) => s.monthKey === targetMonth);
                    if (matchedSched.length > 0) {
                        totalMonthDemanded = matchedSched.reduce((sum: number, s: any) => sum + (Number(s.quantity) || 0), 0);
                        alreadyPlannedMonthQty = matchedSched.reduce((sum: number, s: any) => {
                            const pQ = s.plannedQuantity != null 
                                ? Number(s.plannedQuantity) 
                                : (s.isPlanned ? Number(s.quantity || 0) : 0);
                            return sum + pQ;
                        }, 0);
                        matchedSched.forEach((s: any) => {
                            if (s.mrpNumber && !previousMrpNumbers.includes(s.mrpNumber)) previousMrpNumbers.push(s.mrpNumber);
                            if (Array.isArray(s.linkedMrps)) {
                                s.linkedMrps.forEach((lm: any) => {
                                    if (lm.mrpNumber && !previousMrpNumbers.includes(lm.mrpNumber)) previousMrpNumbers.push(lm.mrpNumber);
                                });
                            }
                        });
                        const unplannedQty = Math.max(0, totalMonthDemanded - alreadyPlannedMonthQty);
                        lineQty = unplannedQty > 0 ? unplannedQty : totalMonthDemanded;

                        if (matchedSched[0].targetDate) {
                            monthTargetDate = new Date(matchedSched[0].targetDate).toISOString().split('T')[0];
                        }
                    } else {
                        // Not scheduled for this month
                        lineQty = 0;
                    }
                } else {
                    const itDate = item.expectedDeliveryDate || po.deliveryDate || po.date;
                    const itMonth = itDate ? new Date(itDate).toISOString().slice(0, 7) : '';
                    if (itMonth === targetMonth || targetMonth === presentMonthKey) {
                        totalMonthDemanded = Number(item.quantity) || 1;
                        alreadyPlannedMonthQty = Number(item.plannedQuantity || 0);
                        if (item.mrpNumber && !previousMrpNumbers.includes(item.mrpNumber)) previousMrpNumbers.push(item.mrpNumber);
                        if (Array.isArray(item.linkedMrps)) {
                            item.linkedMrps.forEach((lm: any) => {
                                if (lm.mrpNumber && !previousMrpNumbers.includes(lm.mrpNumber)) previousMrpNumbers.push(lm.mrpNumber);
                            });
                        }
                        const unplannedQty = Math.max(0, totalMonthDemanded - alreadyPlannedMonthQty);
                        lineQty = unplannedQty > 0 ? unplannedQty : totalMonthDemanded;
                    } else {
                        lineQty = 0;
                    }
                }
            } else {
                totalMonthDemanded = Number(item.quantity) || 1;
                alreadyPlannedMonthQty = Number(item.plannedQuantity || 0);
                if (item.mrpNumber && !previousMrpNumbers.includes(item.mrpNumber)) previousMrpNumbers.push(item.mrpNumber);
                if (Array.isArray(item.linkedMrps)) {
                    item.linkedMrps.forEach((lm: any) => {
                        if (lm.mrpNumber && !previousMrpNumbers.includes(lm.mrpNumber)) previousMrpNumbers.push(lm.mrpNumber);
                    });
                }
                const netQty = (item.quantity || 1) - (item.dispatchedQuantity || item.billedQuantity || 0);
                const unplannedQty = Math.max(0, totalMonthDemanded - alreadyPlannedMonthQty);
                lineQty = unplannedQty > 0 ? unplannedQty : (netQty > 0 ? netQty : totalMonthDemanded);
            }

            if (lineQty <= 0) return; // Skip line items not scheduled for target month!

            const itemPoDate = item.expectedDeliveryDate
                ? new Date(item.expectedDeliveryDate).toISOString().split('T')[0]
                : resolvedPoDate;

            let itemCommittedDate = monthTargetDate;
            let isFromOA = false;
            if (!itemCommittedDate) {
                if (item.committedDeliveryDate) {
                    itemCommittedDate = new Date(item.committedDeliveryDate).toISOString().split('T')[0];
                    isFromOA = true;
                } else if (po.committedDispatchDate) {
                    itemCommittedDate = new Date(po.committedDispatchDate).toISOString().split('T')[0];
                    isFromOA = true;
                } else {
                    itemCommittedDate = itemPoDate || resolvedCommittedDate;
                }
            }

            const rawRate = Number(
                item.rate || (item.quantity > 0 ? Number(item.amount || 0) / Number(item.quantity) : 0) || fgObj?.sellingPrice || 0
            );
            const inrRate = Math.round(rawRate * exRate * 100) / 100;
            const lineTotalPrice = Math.round(lineQty * inrRate * 100) / 100;

            const isForeign = poCurrency !== 'INR';
            const priceSourceLabel = item.rate
                ? (isForeign ? `Customer PO (${poCurrency} @ ₹${exRate})` : 'Customer PO')
                : (fgObj?.sellingPrice ? 'Master Catalog' : 'Unset');

            const rawFgId = fgObj?._id || (typeof item.fgItem === 'object' ? item.fgItem?._id : item.fgItem) || '';
            let resolvedFgId = /^[0-9a-fA-F]{24}$/.test(String(rawFgId)) ? String(rawFgId) : '';
            if (!resolvedFgId) {
                const match = fgList.find((f: any) =>
                    (f.name && f.name.toLowerCase().trim() === (pName || '').toLowerCase().trim()) ||
                    (f.code && f.code.toLowerCase().trim() === (pCode || '').toLowerCase().trim())
                );
                if (match?._id && /^[0-9a-fA-F]{24}$/.test(String(match._id))) {
                    resolvedFgId = String(match._id);
                }
            }

            resultRows.push({
                fgItem: resolvedFgId,
                fgItemName: fgObj?.name || pName || 'Finished Good',
                fgItemCode: fgObj?.code || pCode || '',
                description: item.description || fgObj?.description || fgObj?.descriptions || '',
                quantity: lineQty,
                unit: item.unit || fgObj?.unit || 'PCS',
                sellingPrice: inrRate,
                totalPrice: lineTotalPrice,
                currency: poCurrency,
                originalSellingPrice: rawRate,
                exchangeRate: exRate,
                priceSource: priceSourceLabel,
                poDeliveryDate: itemPoDate,
                targetDate: itemCommittedDate,
                isFromOA,
                customerPo: /^[0-9a-fA-F]{24}$/.test(String(po._id || '')) ? po._id : undefined,
                customerPoNumber: po.poNumber || '',
                customerName: cName,
                totalDemanded: totalMonthDemanded,
                alreadyPlannedQty: alreadyPlannedMonthQty,
                previousMrpNumbers,
                bomId: /^[0-9a-fA-F]{24}$/.test(String(matchedBom?._id || '')) ? matchedBom._id : undefined,
                bomNumber: matchedBom?.bomNumber || (fgObj?.bom?.length > 0 ? `BOM-${fgObj.code || fgObj.name}` : undefined)
            });
        });

        return resultRows;
    };

    // Helper: Consolidate FG rows by canonical item key, merging quantities, earliest dates, and source breakdowns
    const consolidateFGRows = (rawRows: FGRow[]): FGRow[] => {
        if (!rawRows || rawRows.length === 0) return [];
        const itemMap = new Map<string, FGRow>();

        rawRows.forEach((row) => {
            const itemKey = (row.fgItem || row.fgItemCode || row.fgItemName).toLowerCase().trim();
            if (!itemKey) return;

            const breakdownEntry = {
                customerPo: row.customerPo,
                customerPoNumber: row.customerPoNumber || '',
                customerName: row.customerName || '',
                quantity: row.quantity,
                currency: row.currency || 'INR',
                originalRate: row.originalSellingPrice || row.sellingPrice || 0,
                exchangeRate: row.exchangeRate || 1,
                rateInINR: row.sellingPrice || 0,
                amountInINR: Math.round(row.quantity * (row.sellingPrice || 0) * 100) / 100
            };

            if (!itemMap.has(itemKey)) {
                itemMap.set(itemKey, {
                    ...row,
                    sourceBreakdown: row.sourceBreakdown?.length ? row.sourceBreakdown : [breakdownEntry],
                    sourceCustomerPOs: row.sourceCustomerPOs?.length ? row.sourceCustomerPOs : (row.customerPoNumber ? [row.customerPoNumber] : [])
                });
            } else {
                const existing = itemMap.get(itemKey)!;
                existing.quantity += row.quantity;
                existing.totalDemanded = (existing.totalDemanded || 0) + (row.totalDemanded || 0);
                existing.alreadyPlannedQty = (existing.alreadyPlannedQty || 0) + (row.alreadyPlannedQty || 0);
                if (Array.isArray(row.previousMrpNumbers)) {
                    if (!existing.previousMrpNumbers) existing.previousMrpNumbers = [];
                    row.previousMrpNumbers.forEach((m) => {
                        if (!existing.previousMrpNumbers!.includes(m)) existing.previousMrpNumbers!.push(m);
                    });
                }
                if (!existing.description && row.description) existing.description = row.description;
                if (!existing.bomId && row.bomId) {
                    existing.bomId = row.bomId;
                    existing.bomNumber = row.bomNumber;
                }

                // Keep earliest targetDate & poDeliveryDate
                if (row.targetDate && (!existing.targetDate || row.targetDate < existing.targetDate)) {
                    existing.targetDate = row.targetDate;
                }
                if (row.poDeliveryDate && (!existing.poDeliveryDate || row.poDeliveryDate < existing.poDeliveryDate)) {
                    existing.poDeliveryDate = row.poDeliveryDate;
                }

                // Track source breakdown
                if (!existing.sourceBreakdown) existing.sourceBreakdown = [];
                existing.sourceBreakdown.push(breakdownEntry);

                if (!existing.sourceCustomerPOs) existing.sourceCustomerPOs = [];
                if (row.customerPoNumber && !existing.sourceCustomerPOs.includes(row.customerPoNumber)) {
                    existing.sourceCustomerPOs.push(row.customerPoNumber);
                }

                // Recompute weighted average sellingPrice & totalPrice in INR across all sources
                const totalAmountINR = existing.sourceBreakdown.reduce((s, b) => s + (b.amountInINR || 0), 0);
                const totalQty = existing.quantity || 1;
                existing.sellingPrice = Math.round((totalAmountINR / totalQty) * 100) / 100;
                existing.totalPrice = Math.round(totalAmountINR * 100) / 100;

                const uniqueCurrs = [...new Set(existing.sourceBreakdown.map(b => b.currency).filter(Boolean))];
                if (uniqueCurrs.length === 1 && uniqueCurrs[0] !== 'INR') {
                    existing.currency = uniqueCurrs[0];
                    existing.originalSellingPrice = existing.sourceBreakdown[0].originalRate;
                    existing.exchangeRate = existing.sourceBreakdown[0].exchangeRate;
                    existing.priceSource = `Customer PO (${uniqueCurrs[0]} @ ₹${existing.sourceBreakdown[0].exchangeRate})`;
                } else if (uniqueCurrs.length > 1) {
                    existing.currency = 'MIXED';
                    existing.priceSource = `Customer PO (Consolidated: ${uniqueCurrs.join(', ')})`;
                } else {
                    existing.currency = 'INR';
                    existing.originalSellingPrice = existing.sellingPrice;
                    existing.exchangeRate = 1;
                    existing.priceSource = 'Customer PO';
                }

                // Update combined PO & Customer labels
                existing.customerPoNumber = existing.sourceCustomerPOs.join(', ');
                if (row.customerName && existing.customerName && !existing.customerName.includes(row.customerName)) {
                    existing.customerName = `${existing.customerName}, ${row.customerName}`;
                }
            }
        });

        return Array.from(itemMap.values());
    };

    // Resolve best default planning month for a set of Customer POs (preferring presentMonthKey)
    const resolveBestPlanningMonth = (pos: any[], explicitMonth?: string): string => {
        if (explicitMonth && explicitMonth !== 'all') return explicitMonth;
        const schedQtyByMonth = new Map<string, number>();
        let hasUnscheduledItems = false;

        (pos || []).forEach((po) => {
            (po?.items || []).forEach((it: any) => {
                if (Array.isArray(it.deliverySchedule) && it.deliverySchedule.length > 0) {
                    it.deliverySchedule.forEach((s: any) => {
                        if (s?.monthKey && Number(s.quantity || 0) > 0) {
                            schedQtyByMonth.set(s.monthKey, (schedQtyByMonth.get(s.monthKey) || 0) + Number(s.quantity || 0));
                        }
                    });
                } else {
                    hasUnscheduledItems = true;
                }
            });
        });

        if (schedQtyByMonth.has(presentMonthKey) || hasUnscheduledItems || schedQtyByMonth.size === 0) {
            return presentMonthKey;
        }
        const sortedMonths = Array.from(schedQtyByMonth.keys()).sort();
        return sortedMonths.find((m) => m >= presentMonthKey) || sortedMonths[0] || presentMonthKey;
    };

    // Helper: Sync multi-PO selected items into FG table without duplicating line items
    const syncMultiPORows = (poIds: string[], posList = incomingPOs, fgs = fgItemList, boms = bomsList, targetMonth?: string) => {
        if (poIds.length === 0) {
            setFgRows([
                { fgItem: '', fgItemName: '', fgItemCode: '', description: '', quantity: 1, unit: 'PCS', poDeliveryDate: '', targetDate }
            ]);
            setCustomerName('');
            setCustomerPoNumber('');
            return;
        }

        const selectedDocs = posList.filter((p) => poIds.some((id) => String(id) === String(p._id || p.id)));
        const effectiveMonth = targetMonth !== undefined ? targetMonth : resolveBestPlanningMonth(selectedDocs, preselectedMonth);
        if (effectiveMonth !== selectedPlanningMonth) {
            setSelectedPlanningMonth(effectiveMonth);
        }

        const rawRows: FGRow[] = [];
        let earliestDate = '';

        poIds.forEach((id) => {
            const po = posList.find((p) => String(p._id || p.id) === String(id));
            if (po) {
                const rows = extractFGRowsFromPO(po, fgs, boms, effectiveMonth);
                rows.forEach((r) => rawRows.push(r));

                const cDate = po.committedDispatchDate || po.deliveryDate || po.date;
                if (cDate) {
                    const iso = new Date(cDate).toISOString().split('T')[0];
                    if (!earliestDate || iso < earliestDate) {
                        earliestDate = iso;
                    }
                }
            }
        });

        const mergedRows = consolidateFGRows(rawRows);
        if (mergedRows.length > 0) {
            setFgRows(mergedRows);
        } else {
            setFgRows([
                { fgItem: '', fgItemName: '', fgItemCode: '', description: '', quantity: 1, unit: 'PCS', poDeliveryDate: '', targetDate }
            ]);
        }
        if (earliestDate) {
            setTargetDate(earliestDate);
        }

        const custNames = [...new Set(selectedDocs.map((p) => p.customerName || (typeof p.customer === 'object' ? p.customer?.name : '')).filter(Boolean))];
        setCustomerName(custNames.join(', '));
        setCustomerPoNumber(selectedDocs.map((p) => p.poNumber).filter(Boolean).join(', '));
    };

    // Scheduled months across currently selected PO(s) (always includes Present Month so it is selectable on top)
    const poScheduledMonths = useMemo(() => {
        const monthsMap = new Map<string, { monthKey: string; monthLabel: string; totalQty: number; plannedQty: number }>();

        // Ensure Present Month is always available on the top Target Delivery Month bar
        monthsMap.set(presentMonthKey, {
            monthKey: presentMonthKey,
            monthLabel: `${formatMonthKeyLabel(presentMonthKey)} (Present)`,
            totalQty: 0,
            plannedQty: 0
        });

        let targetPOs: any[] = [];
        if (planMode === 'single' && selectedPOId) {
            const p = incomingPOs.find((po) => String(po._id || po.id) === String(selectedPOId));
            if (p) targetPOs.push(p);
        } else if (planMode === 'consolidated' && selectedMultiPoIds.length > 0) {
            targetPOs = incomingPOs.filter((po) =>
                selectedMultiPoIds.some((id) => String(id) === String(po._id || po.id))
            );
        }

        targetPOs.forEach((po) => {
            (po.items || []).forEach((item: any) => {
                if (Array.isArray(item.deliverySchedule) && item.deliverySchedule.length > 0) {
                    item.deliverySchedule.forEach((sched: any) => {
                        if (sched.monthKey) {
                            const pQ = sched.plannedQuantity != null 
                                ? Number(sched.plannedQuantity) 
                                : (sched.isPlanned ? Number(sched.quantity || 0) : 0);
                            const existing = monthsMap.get(sched.monthKey);
                            if (existing) {
                                existing.totalQty += Number(sched.quantity) || 0;
                                existing.plannedQty += pQ;
                            } else {
                                monthsMap.set(sched.monthKey, {
                                    monthKey: sched.monthKey,
                                    monthLabel: sched.monthKey === presentMonthKey
                                        ? `${sched.monthLabel || formatMonthKeyLabel(sched.monthKey)} (Present)`
                                        : (sched.monthLabel || formatMonthKeyLabel(sched.monthKey)),
                                    totalQty: Number(sched.quantity) || 0,
                                    plannedQty: pQ
                                });
                            }
                        }
                    });
                } else {
                    const q = Number(item.quantity || 0);
                    const pQ = Number(item.plannedQuantity || 0);
                    const existing = monthsMap.get(presentMonthKey);
                    if (existing) {
                        existing.totalQty += q;
                        existing.plannedQty += pQ;
                    }
                }
            });
        });

        return Array.from(monthsMap.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    }, [planMode, selectedPOId, selectedMultiPoIds, incomingPOs, presentMonthKey]);

    // Handle Month Selection for planning
    const handleMonthFilterChange = (mKey: string) => {
        setSelectedPlanningMonth(mKey);
        if (planMode === 'single') {
            const po = incomingPOs.find((p) => String(p._id || p.id) === String(selectedPOId));
            if (po) {
                const rows = extractFGRowsFromPO(po, fgItemList, bomsList, mKey);
                const consolidated = consolidateFGRows(rows);
                if (consolidated.length > 0) {
                    setFgRows(consolidated);
                } else {
                    setFgRows([
                        { fgItem: '', fgItemName: '', fgItemCode: '', description: '', quantity: 1, unit: 'PCS', poDeliveryDate: '', targetDate }
                    ]);
                }
                if (mKey !== 'all') {
                    setMrpNumber(`${po.poNumber || 'MRP'}-${mKey}`);
                } else if (po.poNumber) {
                    setMrpNumber(po.poNumber);
                }
            }
        } else if (planMode === 'consolidated') {
            syncMultiPORows(selectedMultiPoIds, incomingPOs, fgItemList, bomsList, mKey);
        }
    };

    useEffect(() => {
        if (isOpen) {
            setActiveDatePopoverIdx(null);
            setExpandedRmRowIdxs({});
            const isFromMonthlyMatrix = Boolean(
                preselectedMonth ||
                initialData?.mrpNumber?.startsWith('MRP-DEMAND-') ||
                initialData?.remarks?.includes('Month-Wise Item Matrix') ||
                (initialData?.isConsolidated && Array.isArray(initialData?.fgItems) && initialData.fgItems.length > 0 && preselectedPoIds?.length)
            );
            setIsMultiPoSelectorExpanded(!isFromMonthlyMatrix);

            const initialOverrides: Record<string, number> = {};
            if (initialData) {
                const collectOverrides = (list: any[], prefix: 'rm' | 'bo') => {
                    (list || []).forEach((r: any) => {
                        if (r && r.costSource === 'Manual Override' && Number(r.unitCost) >= 0) {
                            const uCost = Number(r.unitCost);
                            const mId = r.material?._id || r.material;
                            const mCode = (r.materialCode || '').trim().toLowerCase();
                            const mName = (r.materialName || '').trim().toLowerCase();
                            if (mId) initialOverrides[`${prefix}_${String(mId)}`] = uCost;
                            if (mCode) {
                                initialOverrides[`${prefix}_${mCode}`] = uCost;
                                initialOverrides[mCode] = uCost;
                            }
                            if (mName) {
                                initialOverrides[`${prefix}_${mName}`] = uCost;
                                initialOverrides[mName] = uCost;
                            }
                        }
                    });
                };
                collectOverrides(initialData.rmRequirements, 'rm');
                collectOverrides(initialData.boRequirements, 'bo');
            }
            setCustomMaterialPrices(initialOverrides);

            if (initialData) {
                const isMulti = Boolean(initialData.isConsolidated || (initialData.customerPOs && initialData.customerPOs.length > 1) || (preselectedPoIds && preselectedPoIds.length > 1));
                setPlanMode(isMulti ? 'consolidated' : 'single');
                if (isMulti && Array.isArray(initialData.customerPOs) && initialData.customerPOs.length > 0) {
                    setSelectedMultiPoIds(initialData.customerPOs.map((p: any) => p.customerPo || p._id || p.id).filter(Boolean));
                } else if (isMulti && Array.isArray(preselectedPoIds) && preselectedPoIds.length > 0) {
                    setSelectedMultiPoIds(preselectedPoIds);
                }
                setMrpNumber(initialData.mrpNumber || '');
                setSelectedCustomerId(initialData.customer || '');
                setCustomerName(initialData.customerName || '');
                setCustomerSearch(initialData.customerName || '');
                setSelectedPOId(initialData.customerPo || '');
                setCustomerPoNumber(initialData.customerPoNumber || '');
                setPoSearch(initialData.customerPoNumber || '');
                setRemarks(initialData.remarks || '');
                setPoDate(initialData.poDate ? new Date(initialData.poDate).toISOString().split('T')[0] : '');
                setTargetDate(initialData.targetDate ? new Date(initialData.targetDate).toISOString().split('T')[0] : '');
                setTargetExpense(initialData.targetExpense ? String(initialData.targetExpense) : '');
                if (initialData.rmRequirements?.length > 0 || initialData.boRequirements?.length > 0) {
                    const rmReqs = Array.isArray(initialData.rmRequirements) ? initialData.rmRequirements : [];
                    const boReqs = Array.isArray(initialData.boRequirements) ? initialData.boRequirements : [];
                    const totalRm = rmReqs.reduce((sum: number, r: any) => sum + (Number(r.grossCost) || 0), 0);
                    const totalBo = boReqs.reduce((sum: number, b: any) => sum + (Number(b.grossCost) || 0), 0);
                    setBomCostSummary({
                        totalRmCost: Math.round(totalRm * 100) / 100,
                        totalBoCost: Math.round(totalBo * 100) / 100,
                        totalBOMCost: Math.round((totalRm + totalBo) * 100) / 100,
                        rmCount: rmReqs.length,
                        boCount: boReqs.length
                    });
                }
                if (Array.isArray(initialData.fgItems) && initialData.fgItems.length > 0) {
                    setFgRows(initialData.fgItems.map((f: any) => {
                        const rawId = f.fgItem?._id || f.fgItem || '';
                        let cleanId = /^[0-9a-fA-F]{24}$/.test(String(rawId)) ? String(rawId) : '';
                        if (!cleanId) {
                            const match = fgItemList.find(
                                (m: any) =>
                                    (m.name && m.name.toLowerCase().trim() === (f.fgItemName || '').toLowerCase().trim()) ||
                                    (m.code && m.code.toLowerCase().trim() === (f.fgItemCode || '').toLowerCase().trim())
                            );
                            if (match?._id && /^[0-9a-fA-F]{24}$/.test(String(match._id))) {
                                cleanId = String(match._id);
                            }
                        }
                        return {
                            fgItem: cleanId,
                            fgItemName: f.fgItemName || f.fgItem?.name || '',
                            fgItemCode: f.fgItemCode || f.fgItem?.code || '',
                            description: f.description || '',
                            quantity: Number(f.quantity) || 1,
                            unit: f.unit || 'PCS',
                            sellingPrice: Number(f.sellingPrice) || 0,
                            totalPrice: Number(f.totalPrice) || Math.round((Number(f.quantity) || 1) * (Number(f.sellingPrice) || 0) * 100) / 100,
                            currency: f.currency || 'INR',
                            originalSellingPrice: Number(f.originalSellingPrice || f.sellingPrice || 0),
                            exchangeRate: Number(f.exchangeRate || 1),
                            priceSource: f.priceSource || '',
                            poDeliveryDate: f.poDeliveryDate ? new Date(f.poDeliveryDate).toISOString().split('T')[0] : '',
                            targetDate: f.targetDate ? new Date(f.targetDate).toISOString().split('T')[0] : '',
                            customerPo: /^[0-9a-fA-F]{24}$/.test(String(f.customerPo || '')) ? f.customerPo : undefined,
                            customerPoNumber: f.customerPoNumber || '',
                            customerName: f.customerName || '',
                            bomId: /^[0-9a-fA-F]{24}$/.test(String(f.bomId || '')) ? f.bomId : '',
                            bomNumber: f.bomNumber || '',
                            sourceBreakdown: f.sourceBreakdown,
                            sourceCustomerPOs: f.sourceCustomerPOs
                        };
                    }));
                }
            } else if (preselectedPoIds && preselectedPoIds.length > 0) {
                setPlanMode('consolidated');
                setSelectedMultiPoIds(preselectedPoIds);
                const now = new Date();
                const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
                const randomSuffix = Math.floor(1000 + Math.random() * 9000);
                setMrpNumber(`MRP-BATCH-${dateStr}-${randomSuffix}`);
                setSelectedCustomerId('');
                setCustomerName('');
                setCustomerSearch('');
                setSelectedPOId('');
                setCustomerPoNumber('');
                setPoSearch('');
                setRemarks('');
                setPoDate('');
                const future = new Date();
                future.setDate(future.getDate() + 7);
                setTargetDate(future.toISOString().split('T')[0]);
            } else {
                setPlanMode('single');
                setSelectedMultiPoIds([]);
                const now = new Date();
                const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
                const randomSuffix = Math.floor(1000 + Math.random() * 9000);
                setMrpNumber(`MRP-${dateStr}-${randomSuffix}`);
                setSelectedCustomerId('');
                setCustomerName('');
                setCustomerSearch('');
                setSelectedPOId('');
                setCustomerPoNumber('');
                setPoSearch('');
                setRemarks('');
                setPoDate('');

                // Default target date: 7 days in future
                const future = new Date();
                future.setDate(future.getDate() + 7);
                const defaultDate = future.toISOString().split('T')[0];
                setTargetDate(defaultDate);

                setFgRows([
                    { fgItem: '', fgItemName: '', fgItemCode: '', description: '', quantity: 1, unit: 'PCS', poDeliveryDate: '', targetDate: defaultDate }
                ]);
            }

            loadDropdownMasters();
        }
    }, [isOpen, initialData, preselectedPoIds]);

    // Live BOM Budget Calculation on FG rows or custom RM price changes
    useEffect(() => {
        if (!isOpen) {
            setBomCostSummary(null);
            return;
        }

        const validFGs = fgRows.filter(
            (r) => (r.fgItem || r.fgItemName || r.fgItemCode) && Number(r.quantity) > 0
        );

        if (validFGs.length === 0) {
            setBomCostSummary(null);
            return;
        }

        setCalculatingBOM(true);
        const timer = setTimeout(async () => {
            try {
                const payload = {
                    fgItems: validFGs.map((r) => ({
                        fgItem: r.fgItem || undefined,
                        fgItemName: r.fgItemName || '',
                        fgItemCode: r.fgItemCode || '',
                        quantity: Number(r.quantity) || 1,
                        bomId: r.bomId || undefined
                    })),
                    customMaterialPrices
                };
                const res = await apiPost('/api/purchase/mrp/preview-bom-budget', payload, token);
                const data = res?.data || res;
                if (data && data.totalBOMCost !== undefined) {
                    setBomCostSummary(data);
                }
            } catch (err) {
                console.warn('Failed to calculate BOM budget preview:', err);
            } finally {
                setCalculatingBOM(false);
            }
        }, 350);

        return () => clearTimeout(timer);
    }, [fgRows, customMaterialPrices, priceListRefreshTick, isOpen, token]);

    // Open Vendor Price List Modal (with Dual-Unit support) for an RM/BO material from MRP creation form
    const handleOpenVendorPriceModal = (mat: BOMLineMaterial) => {
        const displayPrice =
            mat.rawPrice !== undefined && mat.rawPrice > 0
                ? mat.rawPrice
                : mat.unitCost !== undefined && mat.unitCost > 0
                ? mat.unitCost
                : '';

        setVendorPriceInitialData({
            _id: mat.priceListId || undefined,
            material: mat.materialId || '',
            materialName: mat.materialName || '',
            materialCode: mat.materialCode || '',
            itemCategory: mat.itemType === 'BO' ? 'bo' : 'rm',
            vendor: mat.vendorId || '',
            price: displayPrice,
            taxRate: mat.taxRate !== undefined ? mat.taxRate : 18,
            pricingUnit: mat.pricingUnit || mat.unit || '',
            isSecondaryUnit: Boolean(mat.isSecondaryUnit),
            isPreferred: Boolean(mat.isPreferred),
            remarks: mat.remarks || '',
            updatedByName: mat.updatedByName || '',
            updatedAt: mat.updatedAt || undefined,
            unit: mat.unit || 'PCS',
            hasSecondaryUnit: Boolean(mat.hasSecondaryUnit),
            secondaryUnit: mat.secondaryUnit || '',
            conversionFactor: Number(mat.conversionFactor) || 1
        });
        setShowVendorPriceModal(true);
    };

    // Save updated RM/BO price (and Dual-Unit selection) directly to the Vendor Price List
    const handleSaveVendorPrice = async (formData: any) => {
        if (vendorPriceInitialData?._id) {
            await apiPut(`/api/purchase/price-list/${vendorPriceInitialData._id}`, formData, token);
        } else {
            await apiPost('/api/purchase/price-list', formData, token);
        }

        // Clear any temporary manual override for this item so the saved Price List rate takes effect
        if (vendorPriceInitialData) {
            const prefix = vendorPriceInitialData.itemCategory === 'bo' ? 'bo' : 'rm';
            const mId = String(formData.material || vendorPriceInitialData.material || '');
            const mCode = String(vendorPriceInitialData.materialCode || '').trim().toLowerCase();
            const mName = String(vendorPriceInitialData.materialName || '').trim().toLowerCase();
            setCustomMaterialPrices((prev) => {
                const next = { ...prev };
                if (mId) {
                    delete next[`${prefix}_${mId}`];
                    delete next[mId];
                }
                if (mCode) {
                    delete next[`${prefix}_${mCode}`];
                    delete next[mCode];
                }
                if (mName) {
                    delete next[`${prefix}_${mName}`];
                    delete next[mName];
                }
                return next;
            });
        }

        setShowVendorPriceModal(false);
        setVendorPriceInitialData(null);
        setPriceListRefreshTick((t) => t + 1);

        Swal.fire({
            icon: 'success',
            title: 'Saved to Price List',
            text: 'Item price & unit configuration have been saved to the Vendor Price List and updated in this MRP.',
            timer: 1800,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });
    };

    // Handle inline editing of an RM/BO material's unit price for immediate recalculation
    const handleMaterialPriceChange = (mat: BOMLineMaterial, rawVal: string) => {
        const parsed = rawVal === '' ? 0 : Math.max(0, parseFloat(rawVal) || 0);
        const prefix = mat.itemType === 'BO' ? 'bo' : 'rm';
        const nextOverrides: Record<string, number> = { ...customMaterialPrices };
        if (mat.materialKey) nextOverrides[mat.materialKey] = parsed;
        if (mat.materialId) nextOverrides[`${prefix}_${mat.materialId}`] = parsed;
        if (mat.materialCode) {
            const cLower = mat.materialCode.trim().toLowerCase();
            nextOverrides[`${prefix}_${cLower}`] = parsed;
            nextOverrides[cLower] = parsed;
        }
        if (mat.materialName) {
            const nLower = mat.materialName.trim().toLowerCase();
            nextOverrides[`${prefix}_${nLower}`] = parsed;
            nextOverrides[nLower] = parsed;
        }
        setCustomMaterialPrices(nextOverrides);

        // Optimistically recalculate bomCostSummary immediately for zero-lag UI response
        setBomCostSummary((prev) => {
            if (!prev || !Array.isArray(prev.fgLineCosts)) return prev;
            let newTotalRm = 0;
            let newTotalBo = 0;
            const updatedLines = prev.fgLineCosts.map((fc) => {
                let lineRm = 0;
                let lineBo = 0;
                const updatedMats = (fc.materials || []).map((m) => {
                    const isSameMat =
                        (m.materialKey && mat.materialKey && m.materialKey === mat.materialKey) ||
                        (m.materialId && mat.materialId && m.materialId === mat.materialId && m.itemType === mat.itemType) ||
                        (m.materialCode && mat.materialCode && m.materialCode.toLowerCase() === mat.materialCode.toLowerCase() && m.itemType === mat.itemType) ||
                        (m.materialName && mat.materialName && m.materialName.toLowerCase() === mat.materialName.toLowerCase() && m.itemType === mat.itemType);
                    const uCost = isSameMat ? parsed : m.unitCost;
                    const gCost = Math.round(m.requiredQuantity * uCost * 100) / 100;
                    if (m.itemType === 'BO') {
                        lineBo += gCost;
                    } else {
                        lineRm += gCost;
                    }
                    return isSameMat
                        ? { ...m, unitCost: parsed, grossCost: gCost, costSource: 'Manual Override' }
                        : m;
                });
                const rmOnlyCost = Math.round(lineRm * 100) / 100;
                const boOnlyCost = Math.round(lineBo * 100) / 100;
                const rmTotalCost = Math.round((rmOnlyCost + boOnlyCost) * 100) / 100;
                const rmUnitCost = fc.quantity > 0 ? Math.round((rmTotalCost / fc.quantity) * 100) / 100 : 0;
                newTotalRm += rmOnlyCost;
                newTotalBo += boOnlyCost;
                return {
                    ...fc,
                    rmOnlyCost,
                    boOnlyCost,
                    rmTotalCost,
                    rmUnitCost,
                    materials: updatedMats
                };
            });
            return {
                ...prev,
                totalRmCost: Math.round(newTotalRm * 100) / 100,
                totalBoCost: Math.round(newTotalBo * 100) / 100,
                totalBOMCost: Math.round((newTotalRm + newTotalBo) * 100) / 100,
                fgLineCosts: updatedLines
            };
        });
    };

    const loadDropdownMasters = async () => {
        setLoading(true);
        try {
            // 1. Immediately hydrate from parent props if available so FG search is instant
            if (Array.isArray(initialFgItems) && initialFgItems.length > 0 && fgItemList.length === 0) {
                setFgItemList(initialFgItems);
            }
            if (Array.isArray(initialMrpPlans) && initialMrpPlans.length > 0 && existingMRPPlans.length === 0) {
                setExistingMRPPlans(initialMrpPlans);
            }

            // 2. Fast-track FG catalog + Price List in parallel without waiting for heavy PO/MRP endpoints
            const fgPromise = apiGet('/api/store/fg-item?lite=true', token);
            const priceListPromise = apiGet('/api/sales/price-list', token);

            Promise.allSettled([fgPromise, priceListPromise]).then(([fgRes, priceListRes]) => {
                let fastFGs: any[] = [];
                if (fgRes.status === 'fulfilled' && fgRes.value) {
                    fastFGs = Array.isArray(fgRes.value) ? fgRes.value : (fgRes.value.fgItems || fgRes.value.data || []);
                }
                if (priceListRes.status === 'fulfilled' && priceListRes.value && fastFGs.length > 0) {
                    const loadedPLs = Array.isArray(priceListRes.value)
                        ? priceListRes.value
                        : (priceListRes.value.priceLists || priceListRes.value.data || []);
                    const plMap = new Map<string, any>();
                    loadedPLs.forEach((pl: any) => {
                        const fgId = pl.fgItem?._id || pl.fgItem;
                        if (fgId) plMap.set(String(fgId), pl);
                    });
                    fastFGs = fastFGs.map((fg: any) => {
                        const pl = plMap.get(String(fg._id));
                        const effectivePrice = Number(fg.sellingPrice || pl?.price || 0);
                        const effectiveCurrency = (fg.currency || pl?.currency || 'INR').trim().toUpperCase();
                        return {
                            ...fg,
                            sellingPrice: effectivePrice,
                            currency: effectiveCurrency,
                            salesPriceListPrice: pl ? Number(pl.price || 0) : fg.salesPriceListPrice,
                            salesPriceListCurrency: pl ? pl.currency : fg.salesPriceListCurrency,
                            priceSource: pl ? 'Sales Price List' : (fg.sellingPrice ? 'Master Catalog' : 'Unset')
                        };
                    });
                }
                if (fastFGs.length > 0) {
                    setFgItemList(fastFGs);
                }
            });

            const [custRes, fgRes, bomRes, poRes, mrpRes, priceListRes] = await Promise.allSettled([
                apiGet('/api/store/customer', token),
                fgPromise,
                apiGet('/api/store/bom', token),
                apiGet('/api/sales/incoming-po', token),
                Array.isArray(initialMrpPlans) && initialMrpPlans.length > 0
                    ? Promise.resolve({ mrpPlans: initialMrpPlans })
                    : apiGet('/api/purchase/mrp/plans', token),
                priceListPromise
            ]);

            let loadedFGs: any[] = [];
            let loadedBOMs: any[] = [];
            let loadedPOs: any[] = [];

            if (custRes.status === 'fulfilled' && custRes.value) {
                setCustomerList(Array.isArray(custRes.value) ? custRes.value : (custRes.value.customers || custRes.value.data || []));
            }
            if (fgRes.status === 'fulfilled' && fgRes.value) {
                loadedFGs = Array.isArray(fgRes.value) ? fgRes.value : (fgRes.value.fgItems || fgRes.value.data || []);
            }
            if (priceListRes.status === 'fulfilled' && priceListRes.value) {
                const loadedPLs = Array.isArray(priceListRes.value)
                    ? priceListRes.value
                    : (priceListRes.value.priceLists || priceListRes.value.data || []);
                const plMap = new Map<string, any>();
                loadedPLs.forEach((pl: any) => {
                    const fgId = pl.fgItem?._id || pl.fgItem;
                    if (fgId) plMap.set(String(fgId), pl);
                });
                loadedFGs = loadedFGs.map((fg: any) => {
                    const pl = plMap.get(String(fg._id));
                    const effectivePrice = Number(fg.sellingPrice || pl?.price || 0);
                    const effectiveCurrency = (fg.currency || pl?.currency || 'INR').trim().toUpperCase();
                    return {
                        ...fg,
                        sellingPrice: effectivePrice,
                        currency: effectiveCurrency,
                        salesPriceListPrice: pl ? Number(pl.price || 0) : undefined,
                        salesPriceListCurrency: pl ? pl.currency : undefined,
                        priceSource: pl ? 'Sales Price List' : (fg.sellingPrice ? 'Master Catalog' : 'Unset')
                    };
                });
            }
            setFgItemList(loadedFGs);
            if (bomRes.status === 'fulfilled' && bomRes.value) {
                loadedBOMs = Array.isArray(bomRes.value) ? bomRes.value : (bomRes.value.boms || bomRes.value.data || []);
                setBomsList(loadedBOMs);
            }
            if (poRes.status === 'fulfilled' && poRes.value) {
                loadedPOs = Array.isArray(poRes.value)
                    ? poRes.value
                    : (poRes.value.pos || poRes.value.incomingPOs || poRes.value.data || []);
                setIncomingPOs(loadedPOs);

                if (preselectedPoIds && preselectedPoIds.length > 0 && !initialData) {
                    if (preselectedPoIds.length === 1) {
                        const targetPO = loadedPOs.find((p) => String(p._id || p.id) === String(preselectedPoIds[0]));
                        if (targetPO) {
                            handleSelectCustomerPO(targetPO, loadedFGs, loadedBOMs, preselectedMonth || undefined);
                        } else {
                            syncMultiPORows(preselectedPoIds, loadedPOs, loadedFGs, loadedBOMs, preselectedMonth || undefined);
                        }
                    } else {
                        syncMultiPORows(preselectedPoIds, loadedPOs, loadedFGs, loadedBOMs, preselectedMonth || undefined);
                    }
                }
            }
            if (mrpRes.status === 'fulfilled' && mrpRes.value) {
                setExistingMRPPlans(Array.isArray(mrpRes.value) ? mrpRes.value : (mrpRes.value.mrpPlans || mrpRes.value.data || []));
            }
        } catch (err) {
            console.error('Failed to load masters for MRP modal:', err);
        } finally {
            setLoading(false);
        }
    };

    // Filtered Customers based on keyword search
    const filteredCustomers = useMemo(() => {
        if (!customerSearch.trim()) return customerList;
        const q = customerSearch.toLowerCase().trim();
        return customerList.filter((c: any) =>
            (c.name && c.name.toLowerCase().includes(q)) ||
            (c.companyName && c.companyName.toLowerCase().includes(q)) ||
            (c.code && c.code.toLowerCase().includes(q)) ||
            (c.city && c.city.toLowerCase().includes(q))
        );
    }, [customerList, customerSearch]);

    // Open Customer POs list for Single PO mode
    const availablePOs = useMemo(() => {
        let pos = (incomingPOs || []).filter(
            (p: any) => p && p.status !== 'Cancelled' && p.status !== 'Completed'
        );

        if (selectedCustomerId) {
            pos = pos.filter((p: any) => {
                const cId = p.customer?._id || (typeof p.customer === 'string' ? p.customer : p.customer?.id);
                const pCustName = (p.customerName || p.customer?.name || '').toLowerCase().trim();
                const matchedName = customerName && pCustName && pCustName === customerName.toLowerCase().trim();
                return (cId && String(cId) === String(selectedCustomerId)) || matchedName;
            });
        } else if (customerName.trim()) {
            const cleanCName = customerName.toLowerCase().trim();
            pos = pos.filter((p: any) => {
                const pCustName = (p.customerName || p.customer?.name || '').toLowerCase().trim();
                return pCustName.includes(cleanCName);
            });
        }

        if (poSearch.trim()) {
            const q = poSearch.toLowerCase().trim();
            if (selectedPOId && (q === `po #${customerPoNumber}`.toLowerCase() || q === customerPoNumber.toLowerCase())) {
                return pos;
            }
            pos = pos.filter((p: any) =>
                (p.poNumber && p.poNumber.toLowerCase().includes(q)) ||
                (p.customerName && p.customerName.toLowerCase().includes(q)) ||
                (p.customer?.name && p.customer.name.toLowerCase().includes(q))
            );
        }

        return pos;
    }, [incomingPOs, selectedCustomerId, customerName, poSearch, selectedPOId, customerPoNumber]);

    // Check if a Customer PO already has an MRP plan generated
    const isPoMrpGenerated = (po: any) => {
        if (!po) return false;
        if (po.status === 'MRP Done') return true;
        return (existingMRPPlans || []).some(
            (m: any) =>
                String(m.customerPo) === String(po._id) ||
                (m.customerPOs || []).some((cp: any) => String(cp.customerPo || cp._id) === String(po._id)) ||
                (po.poNumber && m.customerPoNumber && (
                    m.customerPoNumber === po.poNumber ||
                    m.customerPoNumber.split(',').map((s: string) => s.trim()).includes(po.poNumber)
                ))
        );
    };

    // Available POs for Multi-PO mode (filtered by customer, search, and MRP-generated status)
    const availableMultiPOs = useMemo(() => {
        let pos = (incomingPOs || []).filter(
            (p: any) => p && p.status !== 'Cancelled' && p.status !== 'Completed'
        );

        if (multiPoCustomerFilter && multiPoCustomerFilter !== 'all') {
            pos = pos.filter((p: any) => {
                const cId = p.customer?._id || (typeof p.customer === 'string' ? p.customer : p.customer?.id);
                return cId && String(cId) === String(multiPoCustomerFilter);
            });
        }

        if (multiPoSearch.trim()) {
            const q = multiPoSearch.toLowerCase().trim();
            pos = pos.filter((p: any) =>
                (p.poNumber && p.poNumber.toLowerCase().includes(q)) ||
                (p.customerName && p.customerName.toLowerCase().includes(q)) ||
                (p.customer?.name && p.customer.name.toLowerCase().includes(q)) ||
                (p.items && p.items.some((it: any) => (it.productName || it.fgItem?.name || '').toLowerCase().includes(q)))
            );
        }

        if (multiPoMrpFilter === 'pending') {
            pos = pos.filter((p: any) => !isPoMrpGenerated(p));
        } else if (multiPoMrpFilter === 'mrp_done') {
            pos = pos.filter((p: any) => isPoMrpGenerated(p));
        }

        return pos;
    }, [incomingPOs, multiPoCustomerFilter, multiPoSearch, multiPoMrpFilter, existingMRPPlans]);

    // Statistics of matching POs for multi-PO filters
    const multiPoStats = useMemo(() => {
        let base = (incomingPOs || []).filter((p: any) => p && p.status !== 'Cancelled' && p.status !== 'Completed');
        if (multiPoCustomerFilter && multiPoCustomerFilter !== 'all') {
            base = base.filter((p: any) => {
                const cId = p.customer?._id || (typeof p.customer === 'string' ? p.customer : p.customer?.id);
                return cId && String(cId) === String(multiPoCustomerFilter);
            });
        }
        if (multiPoSearch.trim()) {
            const q = multiPoSearch.toLowerCase().trim();
            base = base.filter((p: any) =>
                (p.poNumber && p.poNumber.toLowerCase().includes(q)) ||
                (p.customerName && p.customerName.toLowerCase().includes(q)) ||
                (p.customer?.name && p.customer.name.toLowerCase().includes(q))
            );
        }
        const total = base.length;
        const mrpDoneCount = base.filter(isPoMrpGenerated).length;
        const pendingCount = total - mrpDoneCount;
        return { total, mrpDoneCount, pendingCount };
    }, [incomingPOs, multiPoCustomerFilter, multiPoSearch, existingMRPPlans]);

    // Check if the currently selected PO has an existing MRP plan
    const duplicateMrpPlan = useMemo(() => {
        if (!selectedPOId && !customerPoNumber) return null;
        return (existingMRPPlans || []).find((p: any) =>
            (selectedPOId && String(p.customerPo) === String(selectedPOId)) ||
            (customerPoNumber && p.customerPoNumber && p.customerPoNumber.toLowerCase() === customerPoNumber.toLowerCase())
        );
    }, [existingMRPPlans, selectedPOId, customerPoNumber]);

    // Handle Customer Selection in Single Mode
    const handleSelectCustomer = (customer: any) => {
        if (!customer) {
            setSelectedCustomerId('');
            setCustomerName('');
            setCustomerSearch('');
            setIsCustomerDropdownOpen(false);
            return;
        }

        const custId = customer._id || customer.id || '';
        const name = customer.name || customer.companyName || '';
        setSelectedCustomerId(custId);
        setCustomerName(name);
        setCustomerSearch(name);
        setIsCustomerDropdownOpen(false);

        if (selectedPOId) {
            const currentPO = incomingPOs.find((p) => (p._id || p.id) === selectedPOId);
            const poCustId = currentPO?.customer?._id || (typeof currentPO?.customer === 'string' ? currentPO?.customer : currentPO?.customer?.id);
            const poCustName = (currentPO?.customerName || currentPO?.customer?.name || '').toLowerCase().trim();
            if (String(poCustId) !== String(custId) && (!name || poCustName !== name.toLowerCase().trim())) {
                setSelectedPOId('');
                setCustomerPoNumber('');
                setPoSearch('');
            }
        }
    };

    // Handle Customer PO Selection in Single Mode
    const handleSelectCustomerPO = (
        po: any,
        fgs = fgItemList,
        boms = bomsList,
        targetMonth?: string
    ) => {
        if (!po) {
            setSelectedPOId('');
            setCustomerPoNumber('');
            setPoSearch('');
            setPoDate('');
            setIsPoDropdownOpen(false);
            if (mrpNumber === customerPoNumber) {
                const now = new Date();
                const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
                const randomSuffix = Math.floor(1000 + Math.random() * 9000);
                setMrpNumber(`MRP-${dateStr}-${randomSuffix}`);
            }
            return;
        }

        const effectiveMonth = targetMonth !== undefined ? targetMonth : resolveBestPlanningMonth([po], preselectedMonth);
        setSelectedPlanningMonth(effectiveMonth);

        setSelectedPOId(po._id);
        setCustomerPoNumber(po.poNumber || '');
        setPoSearch(`PO #${po.poNumber}`);
        setIsPoDropdownOpen(false);

        if (effectiveMonth && effectiveMonth !== 'all') {
            setMrpNumber(`${po.poNumber || 'MRP'}-${effectiveMonth}`);
        } else if (po.poNumber) {
            setMrpNumber(po.poNumber);
        }

        const cName = po.customerName || (typeof po.customer === 'object' ? po.customer?.name : '') || '';
        const cId = typeof po.customer === 'object' ? po.customer?._id : po.customer;
        if (cName && !customerName) {
            setCustomerName(cName);
            setCustomerSearch(cName);
        }
        if (cId && !selectedCustomerId) {
            setSelectedCustomerId(cId);
        }

        const resolvedPoDate = po.deliveryDate
            ? new Date(po.deliveryDate).toISOString().split('T')[0]
            : (po.date ? new Date(po.date).toISOString().split('T')[0] : '');
        setPoDate(resolvedPoDate);

        let resolvedCommittedDate = '';
        if (po.committedDispatchDate) {
            resolvedCommittedDate = new Date(po.committedDispatchDate).toISOString().split('T')[0];
        } else if (resolvedPoDate) {
            resolvedCommittedDate = resolvedPoDate;
        }
        if (resolvedCommittedDate) {
            setTargetDate(resolvedCommittedDate);
        }

        const rows = extractFGRowsFromPO(po, fgs, boms, effectiveMonth);
        const consolidated = consolidateFGRows(rows);
        if (consolidated.length > 0) {
            setFgRows(consolidated);
        }
    };

    // Handle Toggling PO in Multi-PO mode
    const handleToggleMultiPO = (poId: string) => {
        setSelectedMultiPoIds((prev) => {
            const next = prev.includes(poId) ? prev.filter((id) => id !== poId) : [...prev, poId];
            syncMultiPORows(next);
            return next;
        });
    };

    const handleSelectAllMultiPOs = () => {
        const eligible = availableMultiPOs.map((p: any) => p._id);
        const next = Array.from(new Set([...selectedMultiPoIds, ...eligible]));
        setSelectedMultiPoIds(next);
        syncMultiPORows(next);
    };

    const handleClearMultiPOs = () => {
        setSelectedMultiPoIds([]);
        syncMultiPORows([]);
    };

    // Pre-indexed BOM lookup sets for O(1) checks during FG dropdown rendering
    const bomLookup = useMemo(() => {
        const names = new Set<string>();
        const codes = new Set<string>();
        (bomsList || []).forEach((b: any) => {
            if (b?.productName) names.add(String(b.productName).toLowerCase().trim());
            if (b?.productCode) codes.add(String(b.productCode).trim());
        });
        return { names, codes };
    }, [bomsList]);

    // Pre-indexed FG items with normalized search string for instant filtering
    const indexedFGItems = useMemo(() => {
        return (fgItemList || []).map((f: any) => {
            const nameLower = (f.name || '').toLowerCase().trim();
            const codeStr = (f.code || '').trim();
            const descStr = f.description || f.descriptions || '';
            const hasBom =
                (Array.isArray(f.bom) && f.bom.length > 0) ||
                (nameLower && bomLookup.names.has(nameLower)) ||
                (codeStr && bomLookup.codes.has(codeStr));
            return {
                ...f,
                _searchStr: `${nameLower} ${codeStr.toLowerCase()} ${descStr.toLowerCase()}`,
                _hasBom: Boolean(hasBom)
            };
        });
    }, [fgItemList, bomLookup]);

    // Filtered FG Items for table row search
    const filteredFGItems = useMemo(() => {
        const q = fgSearchQuery.toLowerCase().trim();
        if (!q) return indexedFGItems;
        const tokens = q.split(/\s+/).filter(Boolean);
        return indexedFGItems.filter((f: any) =>
            tokens.every((tok) => f._searchStr.includes(tok))
        );
    }, [indexedFGItems, fgSearchQuery]);

    // Windowed slice for fast DOM rendering in dropdown
    const visibleFGItems = useMemo(() => {
        return filteredFGItems.slice(0, 60);
    }, [filteredFGItems]);

    // Handle Manual FG Selection in Table Row
    const handleSelectFGForRow = (index: number, selected: any) => {
        if (!selected) return;

        // Check if this finished good is already selected on another row to prevent duplicate lines
        const existingIdx = fgRows.findIndex((r, idx) =>
            idx !== index && (
                (r.fgItem && selected._id && String(r.fgItem) === String(selected._id)) ||
                (r.fgItemCode && selected.code && r.fgItemCode.toLowerCase() === selected.code.toLowerCase()) ||
                (r.fgItemName && selected.name && r.fgItemName.toLowerCase() === selected.name.toLowerCase())
            )
        );

        const matchedBom = bomsList.find(
            (b) =>
                (selected &&
                    (b.productName?.toLowerCase() === selected.name?.toLowerCase() ||
                        b.productCode === selected.code))
        );
        const hasEmbeddedBom = selected && Array.isArray(selected.bom) && selected.bom.length > 0;
        const bomNum = matchedBom?.bomNumber || (hasEmbeddedBom ? `BOM-${selected.code || selected.name}` : undefined);
        const bomId = matchedBom?._id || (hasEmbeddedBom ? selected._id : undefined);

        const rawPrice = Number(selected.sellingPrice || selected.salesPriceListPrice || 0);
        const curr = (selected.currency || selected.salesPriceListCurrency || 'INR').trim().toUpperCase();
        const exRate = getExchangeRateToINR(curr, undefined, exchangeRates);
        const inrPrice = Math.round(rawPrice * exRate * 100) / 100;
        const qty = Number(fgRows[index]?.quantity) || 1;
        const resolvedSource = selected.priceSource || (rawPrice > 0 ? (selected.salesPriceListPrice ? 'Sales Price List' : 'Master Catalog') : 'Unset');

        if (existingIdx !== -1) {
            // Already in list: merge quantity into existing row and remove this duplicate row
            const updated = [...fgRows];
            updated[existingIdx].quantity += qty;
            updated[existingIdx].totalPrice = Math.round(updated[existingIdx].quantity * (updated[existingIdx].sellingPrice || inrPrice) * 100) / 100;
            updated.splice(index, 1);
            if (updated.length === 0) {
                updated.push({ fgItem: '', fgItemName: '', fgItemCode: '', description: '', quantity: 1, unit: 'PCS', poDeliveryDate: '', targetDate });
            }
            setFgRows(updated);
            setActiveFGSearchIdx(null);
            setFgSearchQuery('');
            Swal.fire({
                icon: 'info',
                title: 'Item Consolidated',
                text: `"${selected.name}" is already in the plan. Increased quantity by +${qty} to keep a clean list.`,
                timer: 2000,
                toast: true,
                position: 'top-end',
                showConfirmButton: false
            });
            return;
        }

        const updated = [...fgRows];
        updated[index] = {
            ...updated[index],
            fgItem: selected._id,
            fgItemName: selected.name || '',
            fgItemCode: selected.code || '',
            description: selected.description || selected.descriptions || updated[index].description || '',
            unit: selected.unit || 'PCS',
            sellingPrice: inrPrice,
            originalSellingPrice: rawPrice,
            exchangeRate: exRate,
            currency: curr,
            totalPrice: Math.round(qty * inrPrice * 100) / 100,
            priceSource: resolvedSource,
            bomId: bomId,
            bomNumber: bomNum
        };
        setFgRows(updated);
        setActiveFGSearchIdx(null);
        setFgSearchQuery('');
    };

    const handleAddRow = () => {
        setFgRows([
            ...fgRows,
            {
                fgItem: '',
                fgItemName: '',
                fgItemCode: '',
                description: '',
                quantity: 1,
                unit: 'PCS',
                sellingPrice: 0,
                totalPrice: 0,
                poDeliveryDate: poDate || '',
                targetDate: targetDate || ''
            }
        ]);
    };

    const handleRemoveRow = (index: number) => {
        if (fgRows.length <= 1) {
            setFgRows([
                {
                    fgItem: '',
                    fgItemName: '',
                    fgItemCode: '',
                    description: '',
                    quantity: 1,
                    unit: 'PCS',
                    sellingPrice: 0,
                    totalPrice: 0,
                    poDeliveryDate: poDate || '',
                    targetDate: targetDate || ''
                }
            ]);
            return;
        }
        setFgRows(fgRows.filter((_, i) => i !== index));
    };

    const handleRowChange = (index: number, field: keyof FGRow, val: any) => {
        const updated = [...fgRows];
        const row = { ...updated[index], [field]: val };
        if (field === 'quantity' || field === 'sellingPrice') {
            const q = field === 'quantity' ? Number(val) || 0 : Number(row.quantity) || 0;
            const p = field === 'sellingPrice' ? Number(val) || 0 : Number(row.sellingPrice) || 0;
            row.totalPrice = Math.round(q * p * 100) / 100;
            if (field === 'sellingPrice') {
                row.priceSource = 'Manual Override';
                if (Array.isArray(row.sourceBreakdown) && row.sourceBreakdown.length > 0) {
                    row.sourceBreakdown = row.sourceBreakdown.map((b: any) => {
                        const bQty = Number(b.quantity) || 0;
                        return {
                            ...b,
                            rateInINR: p,
                            amountInINR: Math.round(bQty * p * 100) / 100
                        };
                    });
                }
            } else if (field === 'quantity' && Array.isArray(row.sourceBreakdown) && row.sourceBreakdown.length > 0) {
                const oldTotalBreakdownQty = row.sourceBreakdown.reduce((s: number, b: any) => s + (Number(b.quantity) || 0), 0);
                if (row.sourceBreakdown.length === 1 || oldTotalBreakdownQty <= 0) {
                    const b0 = row.sourceBreakdown[0];
                    const rInr = Number(b0.rateInINR || p) || 0;
                    row.sourceBreakdown = [{
                        ...b0,
                        quantity: q,
                        rateInINR: rInr,
                        amountInINR: Math.round(q * rInr * 100) / 100
                    }];
                } else {
                    const ratio = q / oldTotalBreakdownQty;
                    row.sourceBreakdown = row.sourceBreakdown.map((b: any) => {
                        const scaledQty = parseFloat(((Number(b.quantity) || 0) * ratio).toFixed(4));
                        const rInr = Number(b.rateInINR || p) || 0;
                        return {
                            ...b,
                            quantity: scaledQty,
                            amountInINR: Math.round(scaledQty * rInr * 100) / 100
                        };
                    });
                }
            }
        }
        updated[index] = row;
        setFgRows(updated);
    };

    const totalProjectedIncome = useMemo(() => {
        return Math.round(
            fgRows.reduce((sum, r) => {
                const rowTotal = r.totalPrice !== undefined ? Number(r.totalPrice) : (Number(r.quantity || 0) * Number(r.sellingPrice || 0));
                return sum + (Number(rowTotal) || 0);
            }, 0) * 100
        ) / 100;
    }, [fgRows]);

    const numTargetExpense = Number(targetExpense) || 0;
    const projectedGrossProfit = Math.round((totalProjectedIncome - numTargetExpense) * 100) / 100;
    const projectedMarginPct = totalProjectedIncome > 0 && numTargetExpense > 0
        ? Math.round(((totalProjectedIncome - numTargetExpense) / totalProjectedIncome) * 1000) / 10
        : 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const validItems = fgRows.filter((r) => r.fgItemName || r.fgItem);
        if (validItems.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'No Finished Goods Selected',
                text: 'Please select or add at least one Finished Goods (FG) item.'
            });
            return;
        }

        const isHexId = (val: any) => Boolean(val && /^[0-9a-fA-F]{24}$/.test(String(val)));
        const sanitizedFgItems = validItems.map((r) => {
            let cleanFgId = isHexId(r.fgItem) ? String(r.fgItem) : undefined;
            if (!cleanFgId) {
                const match = fgItemList.find(
                    (f: any) =>
                        (f.name && f.name.toLowerCase().trim() === (r.fgItemName || '').toLowerCase().trim()) ||
                        (f.code && f.code.toLowerCase().trim() === (r.fgItemCode || '').toLowerCase().trim())
                );
                if (match?._id && isHexId(match._id)) {
                    cleanFgId = String(match._id);
                }
            }

            return {
                ...r,
                fgItem: cleanFgId,
                customerPo: isHexId(r.customerPo) ? r.customerPo : undefined,
                bomId: isHexId(r.bomId) ? r.bomId : undefined,
                sourceBreakdown: Array.isArray(r.sourceBreakdown)
                    ? r.sourceBreakdown.map((b: any) => ({
                        ...b,
                        customerPo: isHexId(b.customerPo) ? b.customerPo : undefined
                    }))
                    : r.sourceBreakdown
            };
        });

        setSubmitting(true);
        try {
            const isConsolidated = planMode === 'consolidated' || selectedMultiPoIds.length > 1;
            const validMultiPoIds = selectedMultiPoIds.filter(isHexId);
            const payload: any = {
                mrpNumber,
                isConsolidated,
                targetDate,
                remarks,
                planningMonth: selectedPlanningMonth !== 'all' ? selectedPlanningMonth : undefined,
                targetExpense: targetExpense ? Number(targetExpense) : undefined,
                fgItems: sanitizedFgItems,
                customMaterialPrices: Object.keys(customMaterialPrices).length > 0 ? customMaterialPrices : undefined
            };

            if (isConsolidated && validMultiPoIds.length > 0) {
                payload.customerPoIds = validMultiPoIds;
                const contributingPOs = incomingPOs.filter((p) =>
                    validMultiPoIds.some((id) => String(id) === String(p._id || p.id))
                );
                payload.customerPOs = contributingPOs.map((p) => ({
                    customerPo: p._id,
                    customerPoNumber: p.poNumber || '',
                    customer: isHexId(p.customer?._id || p.customer) ? (p.customer?._id || p.customer) : undefined,
                    customerName: p.customerName || (typeof p.customer === 'object' ? p.customer?.name : '') || '',
                    poDate: p.date,
                    targetDate: p.committedDispatchDate || p.deliveryDate || p.date,
                }));
                payload.customerPoNumber = contributingPOs.map((p) => p.poNumber).filter(Boolean).join(', ');
                payload.customerName = [
                    ...new Set(contributingPOs.map((p) => p.customerName || (typeof p.customer === 'object' ? p.customer?.name : '')).filter(Boolean))
                ].join(', ');
                payload.poDate = contributingPOs[0]?.date || undefined;
            } else {
                payload.customerPo = selectedPOId || undefined;
                payload.customerPoNumber = customerPoNumber || undefined;
                payload.customerName = customerName || 'Internal Production';
                payload.poDate = poDate || undefined;
            }

            if (initialData && (initialData._id || initialData.id)) {
                await apiPut(`/api/purchase/mrp/plan/${initialData._id || initialData.id}`, payload, token);
                Swal.fire({
                    icon: 'success',
                    title: 'MRP Demand Plan Updated!',
                    text: `MRP #${mrpNumber} has been updated successfully.`,
                    timer: 2500
                });
            } else {
                const res = await apiPost('/api/purchase/mrp/plan', payload, token);
                Swal.fire({
                    icon: 'success',
                    title: 'MRP Demand Plan Created!',
                    text: `MRP #${mrpNumber} generated with unified RM/BO BOM explosion and PO status updated to 'MRP Done'.`,
                    timer: 3000
                });
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Error creating MRP plan:', err);
            Swal.fire({
                icon: 'error',
                title: 'MRP Calculation Error',
                text: err.message || 'Failed to generate MRP demand plan'
            });
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-3 md:p-4 lg:p-5 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl w-full max-w-[98vw] 2xl:max-w-[1850px] xl:max-w-[1680px] lg:max-w-[96vw] max-h-[96vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                {/* Modal Header */}
                <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white flex justify-between items-center shrink-0 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 shrink-0">
                            <Layers size={20} />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white truncate">
                                {initialData ? `Edit MRP Demand Plan (${initialData.mrpNumber || mrpNumber})` : 'Create MRP Demand Plan'}
                            </h2>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-2"
                        title="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-3.5 sm:p-6 overflow-y-auto flex-1 space-y-4 sm:space-y-5">
                    {/* Plan Mode Switcher: Single Customer PO vs Consolidated Multi-PO */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-100/90 dark:bg-slate-850 p-2 sm:p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-750 shadow-2xs">
                            <button
                                type="button"
                                onClick={() => {
                                    setPlanMode('single');
                                    if (mrpNumber.startsWith('MRP-BATCH-')) {
                                        const now = new Date();
                                        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
                                        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
                                        setMrpNumber(customerPoNumber || `MRP-${dateStr}-${randomSuffix}`);
                                    }
                                }}
                                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    planMode === 'single'
                                        ? 'bg-indigo-600 text-white shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                }`}
                            >
                                <FileText size={14} /> Single Customer PO
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setPlanMode('consolidated');
                                    const now = new Date();
                                    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
                                    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
                                    setMrpNumber(`MRP-BATCH-${dateStr}-${randomSuffix}`);
                                    if (selectedPOId && !selectedMultiPoIds.includes(selectedPOId)) {
                                        const next = [selectedPOId];
                                        setSelectedMultiPoIds(next);
                                        syncMultiPORows(next);
                                    }
                                }}
                                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    planMode === 'consolidated'
                                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                }`}
                            >
                                <Sparkles size={14} /> Consolidated Multi-PO (Batch MRP)
                                {selectedMultiPoIds.length > 0 && (
                                    <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 text-white font-black">
                                        {selectedMultiPoIds.length}
                                    </span>
                                )}
                            </button>
                        </div>

                        {planMode === 'consolidated' && (
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
                                <span>Batch Mode: Combines multiple customer orders into a single consolidated purchase demand.</span>
                            </div>
                        )}
                    </div>

                    {/* Top Bar: Customer Search & Open PO Quick Selector (Single Mode) */}
                    {planMode === 'single' ? (
                        <div className="bg-gradient-to-r from-indigo-50/90 to-blue-50/70 dark:from-indigo-950/40 dark:to-slate-900 p-4 rounded-2xl border border-indigo-200/80 dark:border-indigo-800 space-y-3">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                    <Sparkles size={15} className="text-indigo-600 dark:text-indigo-400" />
                                    <h3 className="text-xs font-black text-indigo-950 dark:text-indigo-200 uppercase tracking-wide">
                                        Single Customer & PO Linkage
                                    </h3>
                                </div>
                                {(selectedCustomerId || selectedPOId || customerName) && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedCustomerId('');
                                            setCustomerName('');
                                            setCustomerSearch('');
                                            setSelectedPOId('');
                                            setCustomerPoNumber('');
                                            setPoSearch('');
                                            setPoDate('');
                                        }}
                                        className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                                    >
                                        <X size={12} /> Clear Customer & PO Link
                                    </button>
                                )}
                            </div>

                            {/* Customer Search & PO Select Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Customer Dropdown */}
                                <div className="relative" ref={customerDropdownRef}>
                                    <label className="text-[11px] font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider block mb-1">
                                        Customer
                                    </label>
                                    <div className="relative">
                                        <Building className="absolute left-3 top-2.5 text-indigo-500" size={15} />
                                        <input
                                            type="text"
                                            placeholder="Search customer..."
                                            value={customerSearch}
                                            onFocus={() => setIsCustomerDropdownOpen(true)}
                                            onChange={(e) => {
                                                setCustomerSearch(e.target.value);
                                                setCustomerName(e.target.value);
                                                setIsCustomerDropdownOpen(true);
                                            }}
                                            className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 shadow-2xs"
                                        />
                                        {customerSearch && (
                                            <button
                                                type="button"
                                                onClick={() => handleSelectCustomer(null)}
                                                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Customer Dropdown Results */}
                                    {isCustomerDropdownOpen && (
                                        <div className="absolute left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-1 space-y-0.5">
                                            <button
                                                type="button"
                                                onClick={() => handleSelectCustomer(null)}
                                                className="w-full text-left px-3 py-2 rounded-xl text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                                            >
                                                -- Internal Production (No Customer) --
                                            </button>
                                            {filteredCustomers.length === 0 ? (
                                                <div className="p-3 text-center text-xs text-slate-400">
                                                    No customer found
                                                </div>
                                            ) : (
                                                filteredCustomers.map((cust: any) => {
                                                    const isSelected = selectedCustomerId === cust._id;
                                                    return (
                                                        <button
                                                            key={cust._id}
                                                            type="button"
                                                            onClick={() => handleSelectCustomer(cust)}
                                                            className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors flex items-center justify-between cursor-pointer ${
                                                                isSelected
                                                                    ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold'
                                                                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                                                            }`}
                                                        >
                                                            <div>
                                                                <span className="font-bold block">{cust.name || cust.companyName}</span>
                                                                <span className="text-[10px] text-slate-400 font-mono">
                                                                    {cust.code || ''} {cust.city ? `• ${cust.city}` : ''}
                                                                </span>
                                                            </div>
                                                            {isSelected && <Check size={14} className="text-indigo-600" />}
                                                        </button>
                                                    );
                                                })
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Customer PO Dropdown */}
                                <div className="relative" ref={poDropdownRef}>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-[11px] font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">
                                            Customer PO
                                        </label>
                                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-indigo-200/80 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200">
                                            {availablePOs.length} Open POs
                                        </span>
                                    </div>
                                    <div className="relative">
                                        <FileText className="absolute left-3 top-2.5 text-indigo-500" size={15} />
                                        <input
                                            type="text"
                                            placeholder="Search open PO # or customer..."
                                            value={poSearch}
                                            onFocus={() => setIsPoDropdownOpen(true)}
                                            onChange={(e) => {
                                                setPoSearch(e.target.value);
                                                setIsPoDropdownOpen(true);
                                            }}
                                            className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 shadow-2xs"
                                        />
                                        {selectedPOId && (
                                            <button
                                                type="button"
                                                onClick={() => handleSelectCustomerPO(null)}
                                                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Open PO Dropdown List */}
                                    {isPoDropdownOpen && (
                                        <div className="absolute left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-1 space-y-0.5">
                                            <button
                                                type="button"
                                                onClick={() => handleSelectCustomerPO(null)}
                                                className="w-full text-left px-3 py-2 rounded-xl text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                                            >
                                                -- Direct Manual Entry (No PO Linked) --
                                            </button>
                                            {availablePOs.length === 0 ? (
                                                <div className="p-3 text-center text-xs text-slate-400">
                                                    No open purchase orders found.
                                                </div>
                                            ) : (
                                                availablePOs.map((po: any) => {
                                                    const isSelected = selectedPOId === po._id;
                                                    const hasMrp = existingMRPPlans.some(
                                                        (m) =>
                                                            String(m.customerPo) === String(po._id) ||
                                                            (po.poNumber && m.customerPoNumber === po.poNumber)
                                                    );

                                                    return (
                                                        <button
                                                            key={po._id}
                                                            type="button"
                                                            onClick={() => handleSelectCustomerPO(po)}
                                                            className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors flex items-center justify-between cursor-pointer ${
                                                                isSelected
                                                                    ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold'
                                                                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                                                            }`}
                                                        >
                                                            <div>
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span className="font-mono font-bold">PO #{po.poNumber}</span>
                                                                    {po.committedDispatchDate ? (
                                                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                                                            OA Committed: {new Date(po.committedDispatchDate).toLocaleDateString()}
                                                                        </span>
                                                                    ) : po.deliveryDate ? (
                                                                        <span className="text-[9px] font-medium text-slate-500">
                                                                            Due: {new Date(po.deliveryDate).toLocaleDateString()}
                                                                        </span>
                                                                    ) : null}
                                                                    {hasMrp && (
                                                                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                                                            MRP Exists
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className="text-[10px] text-slate-500 block mt-0.5">
                                                                    {po.customerName || po.customer?.name || 'Customer'} •{' '}
                                                                    {po.items?.length || 0} items
                                                                </span>
                                                            </div>
                                                            {isSelected && <Check size={14} className="text-indigo-600" />}
                                                        </button>
                                                    );
                                                })
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Duplicate MRP Alert Warning */}
                            {duplicateMrpPlan && (
                                <div className="px-3 py-2 bg-amber-100/90 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 rounded-xl flex items-center gap-2 text-amber-900 dark:text-amber-200 text-xs animate-in fade-in">
                                    <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                                    <span className="font-bold">
                                        MRP Plan ({duplicateMrpPlan.mrpNumber}) already exists for PO #{customerPoNumber}
                                    </span>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Consolidated Multi-PO Selection Panel (Collapsible when created from Monthly Matrix) */
                        <div className="bg-gradient-to-br from-indigo-50/90 via-purple-50/50 to-slate-50 dark:from-indigo-950/40 dark:via-purple-950/20 dark:to-slate-900 p-3.5 sm:p-4 rounded-2xl border border-indigo-200 dark:border-indigo-800/80 space-y-3">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <Boxes className="text-indigo-600 dark:text-indigo-400 shrink-0" size={16} />
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-xs font-black text-indigo-950 dark:text-indigo-200 uppercase tracking-wide">
                                                Select Customer POs to Consolidate
                                            </h3>
                                            {selectedMultiPoIds.length > 0 && (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-600 text-white shadow-2xs">
                                                    {selectedMultiPoIds.length} PO(s) Consolidated
                                                </span>
                                            )}
                                            {!isMultiPoSelectorExpanded && customerPoNumber && (
                                                <span className="text-[11px] font-mono font-bold text-indigo-700 dark:text-indigo-300 bg-white/80 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-700 truncate max-w-[360px]" title={customerPoNumber}>
                                                    PO: {customerPoNumber}
                                                </span>
                                            )}
                                        </div>
                                        {isMultiPoSelectorExpanded && (
                                            <p className="text-[11px] text-slate-500">
                                                Check 2 or more customer POs. All FG requirements will be consolidated into a single procurement demand.
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {isMultiPoSelectorExpanded && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={handleSelectAllMultiPOs}
                                                className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-750 rounded-lg text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 cursor-pointer flex items-center gap-1 shadow-2xs"
                                            >
                                                <CheckSquare size={13} /> Select All Eligible
                                            </button>
                                            {selectedMultiPoIds.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={handleClearMultiPOs}
                                                    className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-750 rounded-lg text-[11px] font-bold text-rose-600 hover:bg-rose-50 cursor-pointer flex items-center gap-1 shadow-2xs"
                                                >
                                                    <X size={13} /> Clear
                                                </button>
                                            )}
                                        </>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setIsMultiPoSelectorExpanded((prev) => !prev)}
                                        className="px-3 py-1 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 rounded-xl text-[11px] font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-750 cursor-pointer flex items-center gap-1.5 shadow-2xs transition-all"
                                    >
                                        <span>{isMultiPoSelectorExpanded ? 'Hide PO List' : 'Expand / Change POs'}</span>
                                        <ChevronDown
                                            size={13}
                                            className={`transition-transform duration-200 ${isMultiPoSelectorExpanded ? 'rotate-180' : ''}`}
                                        />
                                    </button>
                                </div>
                            </div>

                            {isMultiPoSelectorExpanded && (
                                <>
                                    {/* Filters Bar for Multi-PO: Search, Customer Filter & MRP Generated Filter */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                                            <input
                                                type="text"
                                                placeholder="Search PO #, customer, product..."
                                                value={multiPoSearch}
                                                onChange={(e) => setMultiPoSearch(e.target.value)}
                                                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-indigo-200/80 dark:border-indigo-800/80 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-2xs"
                                            />
                                        </div>

                                        <div className="relative">
                                            <Filter className="absolute left-3 top-2.5 text-slate-400" size={14} />
                                            <select
                                                value={multiPoCustomerFilter}
                                                onChange={(e) => setMultiPoCustomerFilter(e.target.value)}
                                                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-indigo-200/80 dark:border-indigo-800/80 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-2xs"
                                            >
                                                <option value="all">All Customers</option>
                                                {customerList.map((c: any) => (
                                                    <option key={c._id} value={c._id}>
                                                        {c.name || c.companyName}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="relative">
                                            <select
                                                value={multiPoMrpFilter}
                                                onChange={(e: any) => setMultiPoMrpFilter(e.target.value)}
                                                className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-indigo-200/80 dark:border-indigo-800/80 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-2xs cursor-pointer text-slate-800 dark:text-slate-200"
                                            >
                                                <option value="pending">Pending MRP Only (Exclude Planned)</option>
                                                <option value="all">All Open POs (Include MRP Done)</option>
                                                <option value="mrp_done">MRP Done Only</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Multi-PO Filter Stats & Quick Exclude Toggle */}
                                    <div className="flex items-center justify-between text-[11px] text-slate-500 flex-wrap gap-2 px-1">
                                        <span>
                                            Showing <strong className="text-slate-800 dark:text-slate-200">{availableMultiPOs.length}</strong> of <strong className="text-slate-800 dark:text-slate-200">{multiPoStats.total}</strong> Customer POs
                                            {multiPoMrpFilter === 'pending' && multiPoStats.mrpDoneCount > 0 && (
                                                <span className="text-amber-600 dark:text-amber-400 font-medium ml-1">
                                                    ({multiPoStats.mrpDoneCount} already planned excluded)
                                                </span>
                                            )}
                                        </span>

                                        <button
                                            type="button"
                                            onClick={() => setMultiPoMrpFilter((prev) => (prev === 'pending' ? 'all' : 'pending'))}
                                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-colors cursor-pointer border flex items-center gap-1 ${
                                                multiPoMrpFilter === 'pending'
                                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300'
                                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-300'
                                            }`}
                                        >
                                            <span>{multiPoMrpFilter === 'pending' ? '✓ Exclude MRP Done (Active)' : 'Exclude MRP Done (Off)'}</span>
                                        </button>
                                    </div>

                                    {/* Multi-PO Selection Grid / Cards */}
                                    <div className="max-h-52 overflow-y-auto pr-1 space-y-1.5">
                                        {availableMultiPOs.length === 0 ? (
                                            <div className="p-4 text-center text-xs text-slate-400 bg-white/60 dark:bg-slate-900/60 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                                                No open Customer POs found matching your search and filter criteria.
                                            </div>
                                        ) : (
                                            availableMultiPOs.map((po: any) => {
                                                const isChecked = selectedMultiPoIds.includes(po._id);
                                                const hasMrp = isPoMrpGenerated(po);
                                                const totalQty = (po.items || []).reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0);

                                                return (
                                                    <div
                                                        key={po._id}
                                                        onClick={() => handleToggleMultiPO(po._id)}
                                                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                                            isChecked
                                                                ? 'bg-indigo-500/10 border-indigo-500/40 dark:bg-indigo-950/40 dark:border-indigo-700 shadow-xs'
                                                                : 'bg-white dark:bg-slate-900/90 border-slate-200/80 dark:border-slate-800 hover:border-indigo-300'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="shrink-0 text-indigo-600 dark:text-indigo-400">
                                                                {isChecked ? <CheckSquare size={18} /> : <Square size={18} className="text-slate-300 dark:text-slate-600" />}
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className="font-mono font-black text-xs text-slate-900 dark:text-white">
                                                                        PO #{po.poNumber}
                                                                    </span>
                                                                    <span className="font-semibold text-xs text-slate-700 dark:text-slate-300">
                                                                        {po.customerName || po.customer?.name || 'Customer'}
                                                                    </span>
                                                                    {po.committedDispatchDate ? (
                                                                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                                                            OA: {new Date(po.committedDispatchDate).toLocaleDateString()}
                                                                        </span>
                                                                    ) : null}
                                                                    {hasMrp && (
                                                                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                                                            MRP Exists
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                                                                    <span>Date: {po.date ? new Date(po.date).toLocaleDateString() : 'N/A'}</span>
                                                                    <span>•</span>
                                                                    <span>{po.items?.length || 0} Products ({totalQty} total units)</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="text-right shrink-0">
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                                po.status === 'Accepted'
                                                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                                            }`}>
                                                                {po.status}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>

                                    {/* Multi-PO Consolidated Summary Banner */}
                                    {selectedMultiPoIds.length > 0 && (
                                        <div className="p-2.5 bg-indigo-600/10 dark:bg-indigo-950/50 border border-indigo-500/30 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 size={15} className="text-indigo-600 dark:text-indigo-400" />
                                                <span className="font-bold text-indigo-950 dark:text-indigo-200">
                                                    {selectedMultiPoIds.length} Customer PO(s) Consolidated
                                                </span>
                                                <span className="text-slate-500">•</span>
                                                <span className="text-slate-600 dark:text-slate-300">
                                                    {fgRows.filter((r) => r.fgItemName || r.fgItem).length} FG item lines generated
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => syncMultiPORows(selectedMultiPoIds)}
                                                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                                            >
                                                Reload All PO Items
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* Metadata Header Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                        {/* MRP Number */}
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                MRP Number
                            </label>
                            <input
                                type="text"
                                value={mrpNumber}
                                onChange={(e) => setMrpNumber(e.target.value)}
                                required
                                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-black text-indigo-600 dark:text-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>

                        {/* Customer Name */}
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Customer Name
                            </label>
                            <input
                                type="text"
                                placeholder="Customer / Internal"
                                value={customerName}
                                onChange={(e) => {
                                    setCustomerName(e.target.value);
                                    setCustomerSearch(e.target.value);
                                }}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>

                        {/* Customer PO Date */}
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                PO Date
                            </label>
                            <input
                                type="date"
                                value={poDate}
                                onChange={(e) => setPoDate(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>

                        {/* Committed Date (OA Committed Date / Target Due Date) */}
                        <div>
                            <label className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block mb-1">
                                Committed Date
                            </label>
                            <input
                                type="date"
                                value={targetDate}
                                onChange={(e) => {
                                    setTargetDate(e.target.value);
                                    setFgRows((prev) =>
                                        prev.map((r) => ({ ...r, targetDate: r.targetDate || e.target.value }))
                                    );
                                }}
                                required
                                className="w-full px-3 py-2 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/20 text-xs font-bold text-emerald-900 dark:text-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                            />
                        </div>

                        {/* Remarks */}
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Remarks
                            </label>
                            <input
                                type="text"
                                placeholder="Remarks..."
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>
                    </div>

                    {/* Finished Goods Items Table Section */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center flex-wrap gap-2">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                                    <Boxes className="text-indigo-600" size={18} />
                                    Finished Goods (FG) Items
                                </h3>
                            </div>

                            <button
                                type="button"
                                onClick={handleAddRow}
                                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                                <Plus size={15} /> Add FG Row
                            </button>
                        </div>

                        {/* Target Delivery Month Planning Banner */}
                        {poScheduledMonths.length > 0 && (
                            <div className="p-3 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-purple-50/70 dark:from-slate-800/80 dark:to-indigo-950/40 rounded-xl border border-indigo-200/80 dark:border-indigo-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-2xs animate-in fade-in duration-150">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                    <div>
                                        <span className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide block">
                                            Target Delivery Month Planning
                                        </span>
                                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                            This Customer PO has multiple scheduled delivery months. Choose a month to plan only its demand.
                                        </span>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => handleMonthFilterChange('all')}
                                        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                            selectedPlanningMonth === 'all'
                                                ? 'bg-indigo-600 text-white shadow-xs'
                                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                                        }`}
                                    >
                                        All Months (Full PO)
                                    </button>
                                    {poScheduledMonths.map((m) => {
                                        const pendingQty = Math.max(0, m.totalQty - (m.plannedQty || 0));
                                        const isPartial = (m.plannedQty || 0) > 0 && pendingQty > 0;
                                        const isAllPlanned = pendingQty === 0 && m.totalQty > 0;

                                        return (
                                            <button
                                                key={m.monthKey}
                                                type="button"
                                                onClick={() => handleMonthFilterChange(m.monthKey)}
                                                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                                    selectedPlanningMonth === m.monthKey
                                                        ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-400'
                                                        : isAllPlanned
                                                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 hover:bg-emerald-100'
                                                        : isPartial
                                                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 hover:bg-amber-100'
                                                        : 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-50'
                                                }`}
                                            >
                                                <span>{m.monthLabel}</span>
                                                {isPartial ? (
                                                    <span className="flex items-center gap-1">
                                                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-black bg-emerald-200 text-emerald-900">
                                                            ✓ {m.plannedQty}
                                                        </span>
                                                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-black bg-amber-200 text-amber-900">
                                                            ⚡ {pendingQty} Pending
                                                        </span>
                                                    </span>
                                                ) : isAllPlanned ? (
                                                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black bg-emerald-100 text-emerald-800">
                                                        ✓ {m.totalQty} Planned
                                                    </span>
                                                ) : (
                                                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
                                                        selectedPlanningMonth === m.monthKey ? 'bg-white/20 text-white' : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                                                    }`}>
                                                        {m.totalQty} Nos
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Table */}
                        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-xs bg-white dark:bg-slate-900">
                            <table className="w-full table-fixed min-w-[1120px] text-xs text-left">
                                <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 uppercase border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="px-2 py-3 w-9 text-center">#</th>
                                        <th className="px-3 py-3 w-[27%]">Finished Goods (FG) Item & Description</th>
                                        <th className="px-2 py-3 w-18 text-center">Qty</th>
                                        <th className="px-2 py-3 w-16 text-center">Unit</th>
                                        <th className="px-2.5 py-3 w-32 text-right">PO Selling Rate</th>
                                        <th className="px-2.5 py-3 w-34 text-right">Total Income</th>
                                        <th className="px-3 py-3 w-[34%]">RM / BOM Items & Editable Price</th>
                                        <th className="px-2 py-3 w-14 text-center" title="PO Delivery Date & Committed Date">Dates</th>
                                        <th className="px-2 py-3 w-9 text-right"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                    {fgRows.map((row, idx) => {
                                        const isSearchingRow = activeFGSearchIdx === idx;
                                        const hasSelectedItem = Boolean(row.fgItemName);
                                        const fullHoverText = `${row.fgItemName || ''}${row.description ? ` — ${row.description}` : ''}`;

                                        return (
                                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                                            <td className="px-2.5 py-3 text-slate-400 font-bold text-center align-top pt-4">{idx + 1}</td>

                                            {/* Combined FG Item Name & Description (Single Field with Truncation + Hover Full-Text Preview) */}
                                            <td className="px-3 py-3 relative max-w-0 align-top">
                                                <div className="relative group/fgcell min-w-0">
                                                    {isSearchingRow || !hasSelectedItem ? (
                                                        <div className="relative">
                                                            <Search size={13} className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                                                            <input
                                                                type="text"
                                                                autoFocus={isSearchingRow}
                                                                placeholder="Search FG Item Name or Description..."
                                                                value={isSearchingRow ? fgSearchQuery : (row.fgItemName || '')}
                                                                onFocus={() => {
                                                                    setActiveFGSearchIdx(idx);
                                                                    setFgSearchQuery(row.fgItemName || '');
                                                                }}
                                                                onChange={(e) => {
                                                                    setFgSearchQuery(e.target.value);
                                                                    if (activeFGSearchIdx !== idx) {
                                                                        setActiveFGSearchIdx(idx);
                                                                    }
                                                                }}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Escape') {
                                                                        setActiveFGSearchIdx(null);
                                                                        setFgSearchQuery('');
                                                                    } else if (e.key === 'Enter') {
                                                                        e.preventDefault();
                                                                        if (visibleFGItems.length > 0) {
                                                                            handleSelectFGForRow(idx, visibleFGItems[0]);
                                                                        } else if (fgSearchQuery.trim()) {
                                                                            handleRowChange(idx, 'fgItemName', fgSearchQuery.trim());
                                                                            setActiveFGSearchIdx(null);
                                                                        }
                                                                    }
                                                                }}
                                                                className="w-full pl-8 pr-8 py-2 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 shadow-2xs truncate"
                                                            />
                                                            {isSearchingRow && fgSearchQuery ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setFgSearchQuery('')}
                                                                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                                                                    title="Clear search"
                                                                >
                                                                    <X size={13} />
                                                                </button>
                                                            ) : (
                                                                <ChevronDown
                                                                    size={14}
                                                                    className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none"
                                                                />
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div
                                                            onClick={() => {
                                                                setActiveFGSearchIdx(idx);
                                                                setFgSearchQuery(row.fgItemName || '');
                                                            }}
                                                            title={fullHoverText}
                                                            className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors cursor-pointer flex items-center justify-between gap-2 min-w-0 shadow-2xs"
                                                        >
                                                            <div className="min-w-0 flex-1 overflow-hidden">
                                                                <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                                                    {row.fgItemName}
                                                                </div>
                                                                {row.description ? (
                                                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 italic truncate mt-0.5">
                                                                        {row.description}
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-[10px] text-slate-400 italic truncate mt-0.5">
                                                                        Click to search or change FG item
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <ChevronDown size={14} className="text-slate-400 shrink-0" />
                                                        </div>
                                                    )}

                                                    {/* Mouse-Over Full Text Hover Popover (Shown only on hover when item is selected and not searching) */}
                                                    {hasSelectedItem && !isSearchingRow && (
                                                        <div className="hidden group-hover/fgcell:block absolute left-0 bottom-full mb-1.5 z-[80] w-max max-w-[440px] p-3 rounded-xl bg-slate-900/95 dark:bg-slate-800 text-white shadow-xl border border-slate-700 pointer-events-none animate-in fade-in duration-150">
                                                            <div className="font-bold text-xs text-white break-words whitespace-normal leading-snug">
                                                                {row.fgItemName}
                                                            </div>
                                                            {row.description && (
                                                                <div className="text-[11px] text-slate-300 italic mt-1 break-words whitespace-normal leading-relaxed border-t border-slate-700/80 pt-1">
                                                                    {row.description}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {row.bomNumber && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1 mr-2">
                                                        <CheckCircle2 size={11} /> BOM Linked: {row.bomNumber}
                                                    </span>
                                                )}

                                                {row.alreadyPlannedQty && row.alreadyPlannedQty > 0 ? (
                                                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 px-1.5 py-0.5 rounded-md font-bold" title="Already planned in MRP">
                                                            <CheckCircle2 size={10} className="text-emerald-600" />
                                                            Previously Planned: {row.alreadyPlannedQty} {row.unit}
                                                            {row.previousMrpNumbers && row.previousMrpNumbers.length > 0 && ` (${row.previousMrpNumbers.join(', ')})`}
                                                        </span>
                                                        {row.totalDemanded && row.totalDemanded > row.alreadyPlannedQty ? (
                                                            <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/70 border border-amber-300 px-1.5 py-0.5 rounded-md">
                                                                Planning Unplanned: {row.quantity} of {row.totalDemanded} {row.unit}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                ) : null}

                                                {row.sourceBreakdown && row.sourceBreakdown.length > 1 ? (
                                                    <div className="mt-1 space-y-1">
                                                        <div className="flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                                                            <Layers size={10} />
                                                            <span>Merged from {row.sourceBreakdown.length} Customer POs:</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            {row.sourceBreakdown.map((b, bIdx) => (
                                                                <span
                                                                    key={bIdx}
                                                                    className="inline-flex items-center gap-1 text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                                                                    title={`${b.customerName ? `${b.customerName} — ` : ''}${b.quantity} ${row.unit} @ ${b.currency || 'INR'} ${b.originalRate || b.rateInINR} (${b.currency && b.currency !== 'INR' ? `1 ${b.currency} = ₹${b.exchangeRate}` : 'Base INR'}) = ₹${(b.amountInINR || 0).toLocaleString('en-IN')}`}
                                                                >
                                                                    <span>{b.customerPoNumber}:</span>
                                                                    <span className="font-extrabold text-blue-900 dark:text-blue-100">{b.quantity} {row.unit}</span>
                                                                    {b.originalRate ? (
                                                                        <span className="text-[9px] text-emerald-700 dark:text-emerald-400 font-bold ml-0.5">
                                                                            @ {b.currency && b.currency !== 'INR' ? `${getCurrencySymbol(b.currency)}${b.originalRate} (₹${b.rateInINR})` : `₹${b.rateInINR}`}
                                                                        </span>
                                                                    ) : null}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : row.customerPoNumber ? (
                                                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                                        <span className="inline-flex items-center gap-1 text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 px-1.5 py-0.5 rounded-md font-bold">
                                                            <FileText size={10} /> PO #{row.customerPoNumber}
                                                        </span>
                                                        {row.customerName && (
                                                            <span className="text-[10px] text-slate-500 font-medium truncate max-w-[180px]">
                                                                {row.customerName}
                                                            </span>
                                                        )}
                                                        {row.currency && row.currency !== 'INR' && row.originalSellingPrice ? (
                                                            <span className="text-[10px] text-amber-700 dark:text-amber-400 font-mono font-bold bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-1.5 py-0.5 rounded-md">
                                                                {getCurrencySymbol(row.currency)}{row.originalSellingPrice} {row.currency} @ ₹{row.exchangeRate}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                ) : null}

                                                {/* Search Results Dropdown */}
                                                {isSearchingRow && (
                                                    <div
                                                        ref={fgDropdownRef}
                                                        className="absolute left-3 right-3 mt-1 max-h-64 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 p-1.5 space-y-0.5"
                                                    >
                                                        {visibleFGItems.length === 0 ? (
                                                            <div className="p-3 text-center text-xs text-slate-400">
                                                                {loading && fgItemList.length === 0
                                                                    ? 'Loading FG catalog...'
                                                                    : 'No matching FG master found'}
                                                            </div>
                                                        ) : (
                                                            <>
                                                                {visibleFGItems.map((fg: any) => {
                                                                    const fgDesc = fg.description || fg.descriptions || '';
                                                                    return (
                                                                        <button
                                                                            key={fg._id}
                                                                            type="button"
                                                                            onClick={() => handleSelectFGForRow(idx, fg)}
                                                                            title={`${fg.name}${fgDesc ? ` — ${fgDesc}` : ''}`}
                                                                            className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                                                                        >
                                                                            <div className="min-w-0 flex-1 overflow-hidden">
                                                                                <span className="font-bold text-slate-900 dark:text-white block truncate">
                                                                                    {fg.name}
                                                                                </span>
                                                                                <span className="text-[10px] text-slate-500 dark:text-slate-400 italic block truncate">
                                                                                    {fgDesc ? `${fgDesc} • ` : ''}Unit: {fg.unit || 'PCS'}
                                                                                </span>
                                                                            </div>
                                                                            <span
                                                                                className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase shrink-0 ${
                                                                                    fg._hasBom
                                                                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                                                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                                                                }`}
                                                                            >
                                                                                {fg._hasBom ? 'BOM Attached' : 'No BOM'}
                                                                            </span>
                                                                        </button>
                                                                    );
                                                                })}
                                                                {filteredFGItems.length > 60 && (
                                                                    <div className="px-3 py-1.5 text-center text-[10px] font-semibold text-slate-400 border-t border-slate-100 dark:border-slate-800">
                                                                        Showing top 60 of {filteredFGItems.length} items — type more to narrow search
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Quantity */}
                                            <td className="px-2.5 py-3 text-center align-top">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={row.quantity}
                                                    onChange={(e) =>
                                                        handleRowChange(idx, 'quantity', Math.max(1, Number(e.target.value)))
                                                    }
                                                    required
                                                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center font-bold text-indigo-600 dark:text-indigo-400 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                />
                                            </td>

                                            {/* Unit (Expanded space with pill badge) */}
                                            <td className="px-2.5 py-3 text-center align-top">
                                                <div className="inline-flex items-center justify-center w-full px-3 py-2 rounded-xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs">
                                                    {row.unit || 'PCS'}
                                                </div>
                                            </td>

                                            {/* Selling Rate (Expanded space for multi-digit rates) */}
                                            <td className="px-3 py-3 text-right align-top">
                                                <div className="relative">
                                                    <span className="absolute left-2.5 top-2 text-[11px] text-slate-400 font-bold">₹</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        placeholder="0.00"
                                                        value={row.sellingPrice !== undefined && row.sellingPrice !== 0 ? row.sellingPrice : ''}
                                                        onChange={(e) => handleRowChange(idx, 'sellingPrice', parseFloat(e.target.value) || 0)}
                                                        className="w-full pl-6 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-right font-mono font-bold text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                    />
                                                </div>
                                                {row.priceSource && (
                                                    <span className="text-[9px] text-slate-400 font-medium block mt-0.5 truncate text-right" title={row.priceSource}>
                                                        {row.priceSource}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Total Income (Expanded space for full formatted currency) */}
                                            <td className="px-3 py-3 text-right align-top">
                                                <div className="w-full px-3 py-2 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/60 font-bold text-emerald-700 dark:text-emerald-300 font-mono text-xs whitespace-nowrap text-right">
                                                    ₹{((row.totalPrice !== undefined ? row.totalPrice : (Number(row.quantity || 0) * Number(row.sellingPrice || 0))) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                            </td>

                                            {/* Attached RM / BOM Summary (Hidden by Default, Icon to Expand & Edit Price List) */}
                                            <td className="px-3 py-2.5 align-top">
                                                {(() => {
                                                    const lineCost = bomCostSummary?.fgLineCosts?.[idx] ||
                                                        bomCostSummary?.fgLineCosts?.find(
                                                            (fc) =>
                                                                (row.fgItem && fc.fgItem && String(fc.fgItem) === String(row.fgItem)) ||
                                                                (row.fgItemName && fc.fgItemName && fc.fgItemName.trim().toLowerCase() === row.fgItemName.trim().toLowerCase())
                                                        );
                                                    const unitRm = Number(lineCost?.rmUnitCost || 0);
                                                    const totalRm = Number(lineCost?.rmTotalCost || 0);
                                                    const rmPart = Number(lineCost?.rmOnlyCost || 0);
                                                    const boPart = Number(lineCost?.boOnlyCost || 0);
                                                    const lineMaterials: BOMLineMaterial[] = Array.isArray(lineCost?.materials) ? lineCost!.materials! : [];
                                                    const isRowExpanded = Boolean(expandedRmRowIdxs[idx]);

                                                    // Summarize total required quantities across attached RM/BO materials by unit
                                                    const qtyByUnitMap = new Map<string, number>();
                                                    lineMaterials.forEach((m) => {
                                                        const u = (m.unit || 'PCS').toUpperCase();
                                                        qtyByUnitMap.set(u, Math.round(((qtyByUnitMap.get(u) || 0) + Number(m.requiredQuantity || 0)) * 1000) / 1000);
                                                    });
                                                    const totalRmQtyLabel = qtyByUnitMap.size > 0
                                                        ? Array.from(qtyByUnitMap.entries()).map(([u, q]) => `${q} ${u}`).join(', ')
                                                        : '0';

                                                    return (
                                                        <div className="space-y-1.5">
                                                            {/* Compact Summary Bar: Number of RM, Total Qty, Total Price + Edit Price List Icon */}
                                                            <div
                                                                className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/35 border border-amber-200/80 dark:border-amber-800/70"
                                                                title={totalRm > 0 ? `Attached BOM: ${lineMaterials.length} item(s) | Qty: ${totalRmQtyLabel} | RM Cost: ₹${rmPart.toLocaleString('en-IN')} | BO Cost: ₹${boPart.toLocaleString('en-IN')}` : 'Attached RM/BO Summary'}
                                                            >
                                                                <div className="min-w-0 flex-1 space-y-0.5">
                                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md text-[10px] font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800">
                                                                            {lineMaterials.length} RM/BO
                                                                        </span>
                                                                        <span className="text-[10.5px] font-mono font-bold text-slate-700 dark:text-slate-300 truncate">
                                                                            Qty: {totalRmQtyLabel}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                                        <span className="font-mono font-black text-amber-900 dark:text-amber-200 text-xs">
                                                                            ₹{totalRm.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                        </span>
                                                                        <span className="text-[10px] font-mono text-amber-700/90 dark:text-amber-400/80">
                                                                            (@ ₹{unitRm.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/{row.unit || 'Unit'})
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {/* Icon Button to View & Edit Attached RM/BO Price List */}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setExpandedRmRowIdxs((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                                                                    className={`p-2 rounded-xl border transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                                                                        isRowExpanded
                                                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                                                            : 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border-amber-300 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-750'
                                                                    }`}
                                                                    title={isRowExpanded ? 'Hide RM/BO Price List' : `View & Edit RM/BO Price List (${lineMaterials.length} items)`}
                                                                >
                                                                    <Edit3 size={13} />
                                                                </button>
                                                            </div>

                                                            {/* Expandable RM / BO Price List (Hidden by Default until Icon Clicked) */}
                                                            {isRowExpanded && (
                                                                <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/80 shadow-md space-y-1.5 animate-in fade-in duration-150">
                                                                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 px-0.5">
                                                                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                                                                            Attached RM / BO Price List ({lineMaterials.length})
                                                                        </span>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setExpandedRmRowIdxs((prev) => ({ ...prev, [idx]: false }))}
                                                                            className="text-slate-400 hover:text-slate-600 cursor-pointer"
                                                                            title="Close Price List"
                                                                        >
                                                                            <X size={12} />
                                                                        </button>
                                                                    </div>

                                                                    {lineMaterials.length === 0 ? (
                                                                        <div className="text-[10px] text-slate-400 italic px-1 py-1">
                                                                            {calculatingBOM ? 'Loading BOM items...' : 'No BOM items linked to this FG'}
                                                                        </div>
                                                                    ) : (
                                                                        <div className="space-y-1 max-h-48 overflow-y-auto pr-0.5">
                                                                            {lineMaterials.map((mat, mIdx) => (
                                                                                <div
                                                                                    key={mat.materialKey || mIdx}
                                                                                    className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-750"
                                                                                >
                                                                                    <div className="min-w-0 flex-1">
                                                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                                                            <span
                                                                                                className={`px-1 py-0.2 rounded text-[8.5px] font-black uppercase shrink-0 ${
                                                                                                    mat.itemType === 'BO'
                                                                                                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                                                                                                        : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                                                                                                }`}
                                                                                            >
                                                                                                {mat.itemType}
                                                                                            </span>
                                                                                            <span
                                                                                                className="font-bold text-[11px] text-slate-800 dark:text-slate-100 truncate"
                                                                                                title={`${mat.materialName}${mat.description ? ` — ${mat.description}` : ''}`}
                                                                                            >
                                                                                                {mat.materialName}
                                                                                            </span>
                                                                                        </div>
                                                                                        {mat.description && (
                                                                                            <div
                                                                                                className="text-[10px] text-slate-500 dark:text-slate-400 italic truncate mt-0.5"
                                                                                                title={mat.description}
                                                                                            >
                                                                                                {mat.description}
                                                                                            </div>
                                                                                        )}
                                                                                        <div className="text-[9.5px] text-slate-500 font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                                                                                            <span>
                                                                                                Qty: <strong className="text-slate-700 dark:text-slate-200">{mat.requiredQuantity} {mat.unit}</strong>
                                                                                                {mat.hasSecondaryUnit && mat.secondaryUnit && Number(mat.secondaryRequiredQuantity) > 0 && (
                                                                                                    <span className="text-indigo-600 dark:text-indigo-400 font-bold ml-1">
                                                                                                        ({mat.secondaryRequiredQuantity} {mat.secondaryUnit})
                                                                                                    </span>
                                                                                                )}
                                                                                            </span>
                                                                                            <span>•</span>
                                                                                            <span className="text-amber-700 dark:text-amber-300 font-bold">
                                                                                                = ₹{Number(mat.grossCost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* Clickable Button to Open Vendor Price List Form (with Dual Unit) */}
                                                                                    <div className="shrink-0 text-right">
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => handleOpenVendorPriceModal(mat)}
                                                                                            title={`Click to open Price List form for ${mat.materialName} (supports Dual Unit & saves to Price List)`}
                                                                                            className="group/plbtn inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-700 bg-white hover:bg-indigo-50 dark:bg-slate-900 dark:hover:bg-indigo-950/60 hover:border-indigo-400 transition-all cursor-pointer shadow-2xs"
                                                                                        >
                                                                                            <div className="text-right">
                                                                                                <div className="font-mono font-bold text-[11px] text-slate-900 dark:text-white group-hover/plbtn:text-indigo-700 dark:group-hover/plbtn:text-indigo-300 flex items-center justify-end gap-1">
                                                                                                    <span>
                                                                                                        ₹{Number(mat.isSecondaryUnit && mat.rawPrice ? mat.rawPrice : (mat.unitCost || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                                                    </span>
                                                                                                    <span className="text-[9px] text-slate-500 dark:text-slate-400 font-semibold">
                                                                                                        /{mat.isSecondaryUnit && mat.pricingUnit ? mat.pricingUnit : mat.unit}
                                                                                                    </span>
                                                                                                </div>
                                                                                                {mat.isSecondaryUnit && (
                                                                                                    <div className="text-[8.5px] font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                                                                                                        (₹{Number(mat.unitCost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/{mat.unit})
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                            <Edit3 size={11} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                                                                                        </button>
                                                                                        <span className="text-[8.5px] text-slate-400 block mt-0.5 truncate max-w-[140px]" title={`${mat.preferredVendorName ? `${mat.preferredVendorName} (${mat.costSource})` : (mat.costSource || '')}${mat.updatedByName ? ` • Updated by ${mat.updatedByName}${mat.updatedAt ? ` on ${new Date(mat.updatedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}` : ''}` : ''}`}>
                                                                                            {mat.hasSecondaryUnit && mat.secondaryUnit ? `Dual: ${mat.unit}/${mat.secondaryUnit} • ` : ''}
                                                                                            {mat.updatedByName ? `By ${mat.updatedByName}` : (mat.preferredVendorName || mat.costSource || 'Set Price List')}
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </td>

                                            {/* Compact PO Date & Committed Date Icon + Popover */}
                                            <td className="px-2 py-3 text-center align-top pt-3.5 relative">
                                                <div className="relative inline-block group/dateicon">
                                                    <button
                                                        type="button"
                                                        onClick={() => setActiveDatePopoverIdx(activeDatePopoverIdx === idx ? null : idx)}
                                                        className={`p-2 rounded-xl border transition-all cursor-pointer relative ${
                                                            row.isFromOA
                                                                ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                                                                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-750'
                                                        }`}
                                                        title={`PO Date: ${row.poDeliveryDate ? new Date(row.poDeliveryDate).toLocaleDateString('en-IN') : 'Not Set'} | Committed Date: ${row.targetDate ? new Date(row.targetDate).toLocaleDateString('en-IN') : 'Not Set'}${row.isFromOA ? ' (OA Committed)' : ''}`}
                                                    >
                                                        <Calendar size={15} />
                                                        {(row.poDeliveryDate || row.targetDate) && (
                                                            <span
                                                                className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${
                                                                    row.isFromOA ? 'bg-emerald-500' : 'bg-indigo-500'
                                                                }`}
                                                            />
                                                        )}
                                                    </button>

                                                    {/* Hover Tooltip showing PO Date & Committed Date */}
                                                    {activeDatePopoverIdx !== idx && (
                                                        <div className="hidden group-hover/dateicon:block absolute right-0 bottom-full mb-1.5 z-[85] w-52 p-2.5 rounded-xl bg-slate-900/95 dark:bg-slate-800 text-white text-left shadow-xl border border-slate-700 pointer-events-none animate-in fade-in duration-150">
                                                            <div className="text-[10px] font-black uppercase tracking-wider text-indigo-300 mb-1">
                                                                Line Item Schedule Dates
                                                            </div>
                                                            <div className="flex items-center justify-between text-[11px] py-0.5">
                                                                <span className="text-slate-400">PO Date:</span>
                                                                <span className="font-mono font-bold text-white">
                                                                    {row.poDeliveryDate ? new Date(row.poDeliveryDate).toLocaleDateString('en-IN') : '—'}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-[11px] py-0.5 border-t border-slate-700/70 mt-0.5 pt-1">
                                                                <span className="text-emerald-300">Committed:</span>
                                                                <span className="font-mono font-bold text-emerald-300">
                                                                    {row.targetDate ? new Date(row.targetDate).toLocaleDateString('en-IN') : '—'}
                                                                </span>
                                                            </div>
                                                            {row.isFromOA && (
                                                                <div className="text-[9px] font-bold text-emerald-400 mt-0.5">
                                                                    ✓ OA Committed Date
                                                                </div>
                                                            )}
                                                            <div className="text-[9px] text-slate-400 italic mt-1">
                                                                Click icon to adjust dates
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Click Popover to View / Edit PO Date & Committed Date */}
                                                    {activeDatePopoverIdx === idx && (
                                                        <div
                                                            ref={datePopoverRef}
                                                            className="absolute right-0 top-full mt-1.5 z-[95] w-64 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl text-left space-y-2.5 animate-in fade-in zoom-in-95 duration-150"
                                                        >
                                                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                                                                <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                                                    Line #{idx + 1} Dates
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setActiveDatePopoverIdx(null)}
                                                                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                                                                >
                                                                    <X size={13} />
                                                                </button>
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                                                    PO Delivery Date
                                                                </label>
                                                                <input
                                                                    type="date"
                                                                    value={row.poDeliveryDate || ''}
                                                                    onChange={(e) => handleRowChange(idx, 'poDeliveryDate', e.target.value)}
                                                                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase block mb-1">
                                                                    Committed Date {row.isFromOA ? '(OA)' : ''}
                                                                </label>
                                                                <input
                                                                    type="date"
                                                                    value={row.targetDate || ''}
                                                                    onChange={(e) => handleRowChange(idx, 'targetDate', e.target.value)}
                                                                    className="w-full px-2.5 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/20 text-xs font-bold text-emerald-900 dark:text-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Delete Row */}
                                            <td className="px-2 py-3 text-right align-top pt-3.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveRow(idx)}
                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer"
                                                    title="Remove Row"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </td>
                                        </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Financial Intelligence & Target Budget Block */}
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50/70 via-slate-50 to-emerald-50/70 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 border border-indigo-100 dark:border-slate-800 space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-indigo-600/20">
                                    ₹
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                        MRP Financial Planning & Target Budget
                                    </h4>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                        Projected revenue from Customer PO line items or master catalog, with expense guardrails.
                                    </p>
                                </div>
                            </div>

                            {totalProjectedIncome > 0 && numTargetExpense > 0 && (
                                <div className={`px-2.5 py-1 rounded-xl text-xs font-bold border ${
                                    projectedGrossProfit >= 0
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                                        : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800'
                                }`}>
                                    Target Margin: {projectedMarginPct}% (₹{projectedGrossProfit.toLocaleString('en-IN')})
                                </div>
                            )}
                        </div>

                        {/* BOM RM & BO Cost Breakdown */}
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2">
                            <div className="flex items-center justify-between flex-wrap gap-1.5">
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                        <Boxes size={14} className="text-indigo-600 dark:text-indigo-400" />
                                        BOM Material Cost (Purchase Price List)
                                    </span>
                                    {calculatingBOM && (
                                        <span className="text-[10px] text-indigo-500 animate-pulse font-semibold flex items-center gap-1">
                                            <RefreshCw size={11} className="animate-spin" /> Calculating...
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-slate-400 font-medium">Combined BOM Material Cost:</span>
                                    <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white font-mono">
                                        ₹{(bomCostSummary?.totalBOMCost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>

                            {/* The Two Metric Cards: ONLY RM Cost & BO Cost */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                                {/* Raw Material (RM) Cost */}
                                <div className="p-2.5 bg-slate-50/80 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between">
                                    <div className="min-w-0">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider truncate">
                                            Raw Material (RM) Cost
                                        </span>
                                        <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white font-mono mt-0.5">
                                            ₹{(bomCostSummary?.totalRmCost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                            {bomCostSummary?.rmCount || 0} RM items
                                        </span>
                                    </div>
                                </div>

                                {/* Bought Out (BO) Cost */}
                                <div className="p-2.5 bg-slate-50/80 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between">
                                    <div className="min-w-0">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider truncate">
                                            Bought Out (BO) Cost
                                        </span>
                                        <div className="text-sm sm:text-base font-black text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
                                            ₹{(bomCostSummary?.totalBoCost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                            {bomCostSummary?.boCount || 0} BO items
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                            {/* Total Projected Revenue */}
                            <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Total Projected Revenue (Income)</span>
                                <div className="mt-1 flex items-baseline gap-1">
                                    <span className="text-lg font-black text-slate-900 dark:text-white font-mono">
                                        ₹{totalProjectedIncome.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-medium">({fgRows.length} items)</span>
                                </div>
                            </div>

                            {/* Target Expense (Budget Ceiling) */}
                            <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between sm:col-span-1 lg:col-span-2">
                                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                                    <span className="text-[11px] text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1">
                                        <Target size={13} className="text-indigo-600 dark:text-indigo-400" />
                                        Target Procurement Expense (Budget Ceiling)
                                    </span>
                                    <div className="flex items-center gap-1 flex-wrap">
                                        <span className="text-[10px] text-slate-400 mr-0.5 font-bold">Set Price:</span>
                                        {bomCostSummary && bomCostSummary.totalBOMCost > 0 && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => setTargetExpense(String(bomCostSummary.totalBOMCost))}
                                                    className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 cursor-pointer transition-colors shadow-2xs"
                                                    title="Set exact calculated BOM material cost"
                                                >
                                                    Apply BOM Cost (₹{Math.round(bomCostSummary.totalBOMCost).toLocaleString('en-IN')})
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setTargetExpense(String(Math.round(bomCostSummary.totalBOMCost * 1.05)))}
                                                    className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 cursor-pointer transition-colors"
                                                    title="Add 5% buffer for price fluctuation"
                                                >
                                                    +5% Buffer
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setTargetExpense(String(Math.round(bomCostSummary.totalBOMCost * 1.10)))}
                                                    className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 cursor-pointer transition-colors"
                                                    title="Add 10% buffer for contingency"
                                                >
                                                    +10% Buffer
                                                </button>
                                            </>
                                        )}
                                        {totalProjectedIncome > 0 && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => setTargetExpense(String(Math.round(totalProjectedIncome * 0.7)))}
                                                    className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 cursor-pointer"
                                                    title="Target 30% margin"
                                                >
                                                    70% Rev
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setTargetExpense(String(Math.round(totalProjectedIncome * 0.8)))}
                                                    className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 cursor-pointer"
                                                    title="Target 20% margin"
                                                >
                                                    80% Rev
                                                </button>
                                            </>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setTargetExpense('')}
                                            className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-slate-200 cursor-pointer"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>

                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">₹</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="Set maximum procurement budget ceiling (e.g. 500000)..."
                                        value={targetExpense}
                                        onChange={(e) => setTargetExpense(e.target.value)}
                                        className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Submit Footer */}
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center flex-wrap gap-3">
                        <div className="text-xs text-slate-500 flex items-center gap-3">
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                                {fgRows.length} FG Item{fgRows.length !== 1 ? 's' : ''}
                            </span>
                            <span>•</span>
                            <span>
                                Total Required Qty:{' '}
                                <strong className="text-indigo-600 dark:text-indigo-400 font-mono">
                                    {fgRows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)}
                                </strong>
                            </span>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold text-xs shadow-md shadow-indigo-200 dark:shadow-none transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                            >
                                <Sparkles size={16} />
                                {submitting ? 'Exploding BOM & Calculating Requirements...' : 'Calculate & Generate MRP Breakdown'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            {/* In-Place Vendor Price List Modal (Supports Dual-Unit Pricing & Saves Directly to Price List) */}
            <VendorPriceListModal
                isOpen={showVendorPriceModal}
                onClose={() => {
                    setShowVendorPriceModal(false);
                    setVendorPriceInitialData(null);
                }}
                onSubmit={handleSaveVendorPrice}
                initialData={vendorPriceInitialData}
            />
        </div>
    );
}
