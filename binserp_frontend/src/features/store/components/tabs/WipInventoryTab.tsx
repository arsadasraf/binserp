"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Layers, 
  Search, 
  Factory, 
  Eye, 
  RefreshCw, 
  Boxes, 
  Package, 
  ShoppingCart, 
  CheckCircle2, 
  Clock, 
  ArrowUpRight, 
  ArrowDownLeft,
  FileText,
  Filter,
  Warehouse,
  History,
  Download,
  ChevronDown,
  ChevronUp,
  Crosshair,
  IndianRupee,
  LayoutGrid,
  RotateCcw,
  AlertTriangle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { apiGet } from '@/src/lib/api';
import WipLedgerDrawer from '../modals/WipLedgerDrawer';
import WipActionModal from '../modals/WipActionModal';
import { Trash2 } from 'lucide-react';

export type WipSubTabType = 'rm' | 'bo' | 'fg' | 'mrp' | 'ledger' | 'mrp-buckets';

interface WipInventoryTabProps {
    token: string | null;
    companyInfo?: any;
    activeSubTab?: WipSubTabType;
    title?: string;
    description?: string;
    vendorPriceLists?: any[];
    priceLists?: any[];
    onError: (msg: string) => void;
    onSuccess: (msg: string) => void;
}

export default function WipInventoryTab({ 
    token, 
    companyInfo, 
    activeSubTab = 'rm',
    title,
    description,
    vendorPriceLists = [],
    priceLists = [],
    onError, 
    onSuccess 
}: WipInventoryTabProps) {
    const router = useRouter();
    const [wipType, setWipType] = useState<WipSubTabType>(activeSubTab === 'mrp-buckets' ? 'mrp' : activeSubTab);
    const [loading, setLoading] = useState(true);
    const [wipItems, setWipItems] = useState<any[]>([]);
    const [mrpBuckets, setMrpBuckets] = useState<any[]>([]);
    const [ledgerTransactions, setLedgerTransactions] = useState<any[]>([]);
    const [summary, setSummary] = useState({
        totalItems: 0,
        totalActiveWipItems: 0,
        totalIssuedQty: 0,
        totalJobWorkSentQty: 0,
        totalReturnedQty: 0,
        totalFgConsumedQty: 0,
        netPendingWipQty: 0,
        shopfloorWipQty: 0,
        jobWorkWipQty: 0
    });

    // Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterMrp, setFilterMrp] = useState('');
    const [filterStatus, setFilterStatus] = useState<'All' | 'Active WIP Only' | 'WIP Zero' | 'Completed'>('All');
    const [filterDatePreset, setFilterDatePreset] = useState<'all' | 'today' | 'this_month' | 'last_30_days' | 'custom'>('all');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');

    // Ledger Drawer State
    const [selectedWipItem, setSelectedWipItem] = useState<any | null>(null);
    const [isLedgerOpen, setIsLedgerOpen] = useState(false);

    // WIP Return & Scrap Action Modal State
    const [actionModalItem, setActionModalItem] = useState<any | null>(null);
    const [actionModalMode, setActionModalMode] = useState<'return' | 'scrap'>('return');
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);

    // Dashboard & Focus State
    const [showDashboard, setShowDashboard] = useState<boolean>(false);
    const [focusedItemId, setFocusedItemId] = useState<string | null>(null);

    // Reset focused item when subtab changes
    useEffect(() => {
        setFocusedItemId(null);
    }, [wipType]);

    // Local price list state with optional fallback fetch if parent didn't provide props
    const [localVendorPriceLists, setLocalVendorPriceLists] = useState<any[]>(vendorPriceLists || []);
    const [localPriceLists, setLocalPriceLists] = useState<any[]>(priceLists || []);

    useEffect(() => {
        if (vendorPriceLists && vendorPriceLists.length > 0) {
            setLocalVendorPriceLists(vendorPriceLists);
        }
    }, [vendorPriceLists]);

    useEffect(() => {
        if (priceLists && priceLists.length > 0) {
            setLocalPriceLists(priceLists);
        }
    }, [priceLists]);

    useEffect(() => {
        if (!token) return;
        if ((!vendorPriceLists || vendorPriceLists.length === 0) && localVendorPriceLists.length === 0) {
            apiGet('/api/purchase/price-list', token)
                .then(res => {
                    if (res && res.data) setLocalVendorPriceLists(res.data);
                    else if (Array.isArray(res)) setLocalVendorPriceLists(res);
                })
                .catch(() => {});
        }
        if ((!priceLists || priceLists.length === 0) && localPriceLists.length === 0) {
            apiGet('/api/sales/price-list', token)
                .then(res => {
                    if (res && res.data) setLocalPriceLists(res.data);
                    else if (Array.isArray(res)) setLocalPriceLists(res);
                })
                .catch(() => {});
        }
    }, [token]);

    const effectiveVendorPriceLists = (vendorPriceLists && vendorPriceLists.length > 0) ? vendorPriceLists : localVendorPriceLists;
    const effectivePriceLists = (priceLists && priceLists.length > 0) ? priceLists : localPriceLists;

    // O(1) Pre-indexed Vendor Price Map (Purchase Price List for RM, BO, Consumables)
    const vendorPriceMap = useMemo(() => {
        const map = new Map<string, { price: number; isPreferred: boolean; vendorName?: string; taxRate?: number; pricingUnit?: string; isSecondaryUnit?: boolean }>();
        const sortedEntries = [...(effectiveVendorPriceLists || [])].sort((a: any, b: any) => {
            const aPref = a.isPreferred ? 1 : 0;
            const bPref = b.isPreferred ? 1 : 0;
            return aPref - bPref;
        });

        sortedEntries.forEach((entry: any) => {
            const matObj = typeof entry.material === 'object' && entry.material ? entry.material : null;
            const matId = (matObj?._id || (typeof entry.material === 'string' ? entry.material : null) || entry.materialId)?.toString();
            const matCode = (matObj?.code || entry.materialCode || entry.code)?.toString().trim().toUpperCase();
            const matName = (matObj?.name || entry.materialName || entry.name)?.toString().trim().toLowerCase();

            const price = Number(entry.price || 0);
            const isPreferred = Boolean(entry.isPreferred);
            const vendorName = entry.vendor?.name || entry.vendorName;
            const taxRate = entry.taxRate;
            const pricingUnit = entry.pricingUnit;
            const isSecondaryUnit = Boolean(entry.isSecondaryUnit);

            const priceObj = { price, isPreferred, vendorName, taxRate, pricingUnit, isSecondaryUnit };

            if (matId) map.set(matId, priceObj);
            if (matCode && matCode !== 'N/A' && matCode !== '-') map.set(`code:${matCode}`, priceObj);
            if (matName && matName !== '-' && matName !== 'item') map.set(`name:${matName}`, priceObj);
        });
        return map;
    }, [effectiveVendorPriceLists]);

    // O(1) Pre-indexed Sales Price Map (Sales Price List for FG & Components)
    const salesPriceMap = useMemo(() => {
        const map = new Map<string, { price: number; taxRate?: number; hsnCode?: string; pricingUnit?: string; isSecondaryUnit?: boolean }>();
        (effectivePriceLists || []).forEach((entry: any) => {
            const fgObj = typeof entry.fgItem === 'object' && entry.fgItem ? entry.fgItem : null;
            const fgId = (fgObj?._id || (typeof entry.fgItem === 'string' ? entry.fgItem : null) || entry.fgItemId)?.toString();
            const fgCode = (fgObj?.code || entry.fgCode || entry.code)?.toString().trim().toUpperCase();
            const fgName = (fgObj?.name || entry.fgName || entry.name)?.toString().trim().toLowerCase();

            const price = Number(entry.price || 0);
            const priceObj = { 
                price, 
                taxRate: entry.taxRate, 
                hsnCode: entry.hsnCode,
                pricingUnit: entry.pricingUnit,
                isSecondaryUnit: Boolean(entry.isSecondaryUnit)
            };

            if (fgId) map.set(fgId, priceObj);
            if (fgCode && fgCode !== 'N/A' && fgCode !== '-') map.set(`code:${fgCode}`, priceObj);
            if (fgName && fgName !== '-') map.set(`name:${fgName}`, priceObj);
        });
        return map;
    }, [effectivePriceLists]);

    // Helper to resolve unit price, dual-unit conversion, price list source, and visual badge
    const getItemPriceDetails = (item: any, isFg: boolean) => {
        const hasSecondaryUnit = Boolean(item?.hasSecondaryUnit && item?.secondaryUnit && Number(item?.conversionFactor) > 0);
        const factor = Number(item?.conversionFactor) || 1;
        const primaryUnit = item?.unit || (isFg ? 'Nos' : 'PCS');
        const secondaryUnit = item?.secondaryUnit || '';

        if (!item) {
            return {
                unitPrice: 0,
                secondaryUnitPrice: 0,
                primaryUnit,
                secondaryUnit,
                hasSecondaryUnit,
                conversionFactor: factor,
                source: 'Unpriced',
                badgeColor: 'text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
                taxRate: undefined,
                vendorName: undefined,
                hsnCode: undefined
            };
        }

        const candidateKeys: string[] = [];

        // 1. Material Master ObjectId
        const matMasterId = (
            (typeof item.materialId === 'object' && item.materialId?._id) ? item.materialId._id :
            (typeof item.material === 'object' && item.material?._id) ? item.material._id :
            (typeof item.fgId === 'object' && item.fgId?._id) ? item.fgId._id :
            (typeof item.materialId === 'string' ? item.materialId : null) ||
            (typeof item.material === 'string' ? item.material : null) ||
            (typeof item.fgId === 'string' ? item.fgId : null)
        )?.toString();
        if (matMasterId) candidateKeys.push(matMasterId);

        // 2. Direct _id / id
        const directId = (item._id || item.id)?.toString();
        if (directId) {
            candidateKeys.push(directId);
            if (directId.includes('_')) {
                const raw = directId.split('_').slice(1).join('_');
                if (raw) candidateKeys.push(raw);
            }
        }

        // 3. Item Code
        const itemCode = (item.materialCode || item.code || item.itemCode)?.toString().trim().toUpperCase();
        if (itemCode && itemCode !== 'N/A' && itemCode !== '-') candidateKeys.push(`code:${itemCode}`);

        // 4. Item Name
        const itemName = (item.materialName || item.name || item.itemName)?.toString().trim().toLowerCase();
        if (itemName && itemName !== '-') candidateKeys.push(`name:${itemName}`);

        if (isFg) {
            for (const key of candidateKeys) {
                if (salesPriceMap.has(key)) {
                    const entry = salesPriceMap.get(key)!;
                    const rawPrice = Number(entry.price || 0);
                    let primaryUnitPrice = rawPrice;
                    let secondaryUnitPrice = 0;

                    if (hasSecondaryUnit && factor > 0) {
                        const isPricedPerSec = Boolean(
                            entry.isSecondaryUnit || 
                            (entry.pricingUnit && entry.pricingUnit.trim().toUpperCase() === secondaryUnit.trim().toUpperCase())
                        );

                        if (isPricedPerSec) {
                            secondaryUnitPrice = rawPrice;
                            primaryUnitPrice = rawPrice * factor;
                        } else {
                            primaryUnitPrice = rawPrice;
                            secondaryUnitPrice = rawPrice / factor;
                        }
                    }

                    return {
                        unitPrice: primaryUnitPrice,
                        secondaryUnitPrice,
                        primaryUnit,
                        secondaryUnit,
                        hasSecondaryUnit,
                        conversionFactor: factor,
                        source: 'Price List',
                        badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
                        taxRate: entry.taxRate,
                        hsnCode: entry.hsnCode,
                        vendorName: undefined
                    };
                }
            }
            // Fallback check in vendorPriceMap
            for (const key of candidateKeys) {
                if (vendorPriceMap.has(key)) {
                    const entry = vendorPriceMap.get(key)!;
                    const rawPrice = Number(entry.price || 0);
                    let primaryUnitPrice = rawPrice;
                    let secondaryUnitPrice = 0;

                    if (hasSecondaryUnit && factor > 0) {
                        const isPricedPerSec = Boolean(
                            entry.isSecondaryUnit || 
                            (entry.pricingUnit && entry.pricingUnit.trim().toUpperCase() === secondaryUnit.trim().toUpperCase())
                        );

                        if (isPricedPerSec) {
                            secondaryUnitPrice = rawPrice;
                            primaryUnitPrice = rawPrice * factor;
                        } else {
                            primaryUnitPrice = rawPrice;
                            secondaryUnitPrice = rawPrice / factor;
                        }
                    }

                    return {
                        unitPrice: primaryUnitPrice,
                        secondaryUnitPrice,
                        primaryUnit,
                        secondaryUnit,
                        hasSecondaryUnit,
                        conversionFactor: factor,
                        source: 'Price List',
                        badgeColor: 'text-indigo-700 bg-indigo-50 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
                        taxRate: entry.taxRate,
                        hsnCode: undefined,
                        vendorName: entry.vendorName
                    };
                }
            }
            const fallback = Number(item.sellingPrice || item.rate || item.costPrice || item.standardRate || 0);
            return {
                unitPrice: fallback,
                secondaryUnitPrice: hasSecondaryUnit && factor > 0 ? (fallback / factor) : 0,
                primaryUnit,
                secondaryUnit,
                hasSecondaryUnit,
                conversionFactor: factor,
                source: fallback > 0 ? 'Master Rate' : 'Unpriced',
                badgeColor: 'text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
                taxRate: undefined,
                vendorName: undefined,
                hsnCode: undefined
            };
        } else {
            for (const key of candidateKeys) {
                if (vendorPriceMap.has(key)) {
                    const entry = vendorPriceMap.get(key)!;
                    const rawPrice = Number(entry.price || 0);
                    let primaryUnitPrice = rawPrice;
                    let secondaryUnitPrice = 0;

                    if (hasSecondaryUnit && factor > 0) {
                        const isPricedPerSec = Boolean(
                            entry.isSecondaryUnit || 
                            (entry.pricingUnit && entry.pricingUnit.trim().toUpperCase() === secondaryUnit.trim().toUpperCase())
                        );

                        if (isPricedPerSec) {
                            secondaryUnitPrice = rawPrice;
                            primaryUnitPrice = rawPrice * factor;
                        } else {
                            primaryUnitPrice = rawPrice;
                            secondaryUnitPrice = rawPrice / factor;
                        }
                    }

                    return {
                        unitPrice: primaryUnitPrice,
                        secondaryUnitPrice,
                        primaryUnit,
                        secondaryUnit,
                        hasSecondaryUnit,
                        conversionFactor: factor,
                        source: 'Price List',
                        badgeColor: 'text-indigo-700 bg-indigo-50 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
                        vendorName: entry.vendorName,
                        taxRate: entry.taxRate,
                        hsnCode: undefined
                    };
                }
            }
            const fallback = Number(item.costPrice || item.purchasePrice || item.unitPrice || item.standardRate || item.rate || 0);
            return {
                unitPrice: fallback,
                secondaryUnitPrice: hasSecondaryUnit && factor > 0 ? (fallback / factor) : 0,
                primaryUnit,
                secondaryUnit,
                hasSecondaryUnit,
                conversionFactor: factor,
                source: fallback > 0 ? 'Master Rate' : 'Unpriced',
                badgeColor: 'text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
                vendorName: undefined,
                taxRate: undefined,
                hsnCode: undefined
            };
        }
    };

    const focusedItem = useMemo(() => {
        if (!focusedItemId) return null;
        return wipItems.find((i: any) => (i.id || i._id)?.toString() === focusedItemId) || null;
    }, [wipItems, focusedItemId]);

    const wipKpis = useMemo(() => {
        const isFg = wipType === 'fg';
        const tabTitle = wipType === 'bo' 
            ? 'Bought Out (BO)' 
            : wipType === 'fg' 
            ? 'FG / Components' 
            : wipType === 'mrp'
            ? 'MRP WIP Inventory'
            : wipType === 'ledger'
            ? 'WIP Movement Ledger'
            : 'Raw Materials (RM)';

        // 1. Single Item Focus Mode
        if (focusedItem) {
            const priceInfo = getItemPriceDetails(focusedItem, isFg);
            const shopfloorQty = Number(focusedItem.shopfloorWipQty || 0);
            const jobWorkQty = Number(focusedItem.jobWorkWipQty || 0);
            const totalWipQty = Number(focusedItem.pendingWipQty || 0);
            const mainStoreQty = Number(focusedItem.mainStoreStock || 0);

            const shopfloorValuation = shopfloorQty * priceInfo.unitPrice;
            const jobWorkValuation = jobWorkQty * priceInfo.unitPrice;
            const totalWipValuation = totalWipQty * priceInfo.unitPrice;
            const mainStoreValuation = mainStoreQty * priceInfo.unitPrice;

            const itemName = focusedItem.materialName || focusedItem.name || 'Unnamed Item';
            const itemDesc = focusedItem.materialDescription || focusedItem.descriptions || focusedItem.description || '';
            const hasSec = Boolean(focusedItem.hasSecondaryUnit && focusedItem.secondaryUnit && (focusedItem.conversionFactor || 0) > 0);
            const factor = Number(focusedItem.conversionFactor) || 1;
            const secWipQty = hasSec ? totalWipQty * factor : 0;
            const secShopfloorQty = hasSec ? shopfloorQty * factor : 0;
            const secJobWorkQty = hasSec ? jobWorkQty * factor : 0;

            return {
                isFocused: true,
                focusedItem,
                itemName,
                itemDesc,
                tabTitle,
                totalItems: 1,
                pricedItemsCount: priceInfo.unitPrice > 0 ? 1 : 0,
                totalWipQty,
                formattedTotalWipQty: `${totalWipQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })} ${focusedItem.unit || 'PCS'}`,
                shopfloorQty,
                formattedShopfloorQty: `${shopfloorQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })} ${focusedItem.unit || 'PCS'}`,
                jobWorkQty,
                formattedJobWorkQty: `${jobWorkQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })} ${focusedItem.unit || 'PCS'}`,
                mainStoreQty,
                formattedMainStoreQty: `${mainStoreQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })} ${focusedItem.unit || 'PCS'}`,
                hasSec,
                secWipQty,
                formattedSecWipQty: hasSec ? `${secWipQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })} ${focusedItem.secondaryUnit}` : null,
                secShopfloorQty,
                secJobWorkQty,
                unitPrice: priceInfo.unitPrice,
                formattedUnitPrice: priceInfo.unitPrice > 0 ? (
                    `₹${priceInfo.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${priceInfo.primaryUnit}` +
                    (priceInfo.hasSecondaryUnit && priceInfo.secondaryUnitPrice > 0 ? ` (₹${priceInfo.secondaryUnitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${priceInfo.secondaryUnit})` : '')
                ) : 'Unpriced',
                priceSource: priceInfo.source,
                priceBadgeColor: priceInfo.badgeColor,
                vendorName: priceInfo.vendorName,
                totalWipValuation,
                formattedTotalWipValuation: `₹${totalWipValuation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                shopfloorValuation,
                formattedShopfloorValuation: `₹${shopfloorValuation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                jobWorkValuation,
                formattedJobWorkValuation: `₹${jobWorkValuation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                mainStoreValuation,
                formattedMainStoreValuation: `₹${mainStoreValuation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            };
        }

        // 2. Aggregate Overview Mode
        let totalWipValuation = 0;
        let totalShopfloorValuation = 0;
        let totalJobWorkValuation = 0;
        let totalMainStoreValuation = 0;
        let totalWipUnits = 0;
        let totalShopfloorUnits = 0;
        let totalJobWorkUnits = 0;
        let totalMainStoreUnits = 0;
        let pricedItemsCount = 0;
        let activeWipItemCount = 0;

        wipItems.forEach((item: any) => {
            const priceInfo = getItemPriceDetails(item, isFg);
            const shopfloorQty = Number(item.shopfloorWipQty || 0);
            const jobWorkQty = Number(item.jobWorkWipQty || 0);
            const totalWipQty = Number(item.pendingWipQty || 0);
            const mainStoreQty = Number(item.mainStoreStock || 0);

            if (priceInfo.unitPrice > 0) {
                pricedItemsCount++;
            }
            if (totalWipQty > 0) {
                activeWipItemCount++;
            }

            totalWipUnits += totalWipQty;
            totalShopfloorUnits += shopfloorQty;
            totalJobWorkUnits += jobWorkQty;
            totalMainStoreUnits += mainStoreQty;

            totalWipValuation += (totalWipQty * priceInfo.unitPrice);
            totalShopfloorValuation += (shopfloorQty * priceInfo.unitPrice);
            totalJobWorkValuation += (jobWorkQty * priceInfo.unitPrice);
            totalMainStoreValuation += (mainStoreQty * priceInfo.unitPrice);
        });

        return {
            isFocused: false,
            focusedItem: null,
            itemName: '',
            itemDesc: '',
            tabTitle,
            totalItems: wipItems.length,
            activeWipItemCount,
            pricedItemsCount,
            totalWipQty: totalWipUnits,
            formattedTotalWipQty: totalWipUnits.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
            shopfloorQty: totalShopfloorUnits,
            formattedShopfloorQty: totalShopfloorUnits.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
            jobWorkQty: totalJobWorkUnits,
            formattedJobWorkQty: totalJobWorkUnits.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
            mainStoreQty: totalMainStoreUnits,
            formattedMainStoreQty: totalMainStoreUnits.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
            hasSec: false,
            secWipQty: 0,
            formattedSecWipQty: null,
            secShopfloorQty: 0,
            secJobWorkQty: 0,
            unitPrice: 0,
            formattedUnitPrice: '',
            priceSource: 'Price List',
            priceBadgeColor: '',
            vendorName: undefined,
            totalWipValuation,
            formattedTotalWipValuation: `₹${totalWipValuation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            shopfloorValuation: totalShopfloorValuation,
            formattedShopfloorValuation: `₹${totalShopfloorValuation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            jobWorkValuation: totalJobWorkValuation,
            formattedJobWorkValuation: `₹${totalJobWorkValuation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            mainStoreValuation: totalMainStoreValuation,
            formattedMainStoreValuation: `₹${totalMainStoreValuation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        };
    }, [wipItems, wipType, vendorPriceMap, salesPriceMap, focusedItem]);

    const handleOpenActionModal = (item: any, mode: 'return' | 'scrap') => {
        setActionModalItem(item);
        setActionModalMode(mode);
        setIsActionModalOpen(true);
    };

    useEffect(() => {
        if (activeSubTab) {
            setWipType(activeSubTab === 'mrp-buckets' ? 'mrp' : activeSubTab);
        }
    }, [activeSubTab]);

    const fetchWipInventory = async () => {
        if (!token) return;
        try {
            setLoading(true);
            const backendType = wipType === 'mrp' ? 'mrp-buckets' : wipType;
            const res = await apiGet(`/api/store/wip/inventory?type=${backendType}`, token);
            setWipItems(res.wipItems || []);
            setMrpBuckets(res.mrpBuckets || []);
            setLedgerTransactions(res.transactionsLedger || []);
            if (res.summary) {
                setSummary(res.summary);
            }
        } catch (err: any) {
            console.error('Failed to fetch WIP inventory data:', err);
            onError(err.message || 'Failed to fetch WIP Inventory');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWipInventory();
    }, [wipType, token]);

    // Categories list for active items
    const categoriesList = useMemo(() => {
        const set = new Set<string>();
        wipItems.forEach((item) => {
            if (item.categoryName) set.add(item.categoryName);
            else if (item.categoryType) set.add(item.categoryType);
        });
        return Array.from(set);
    }, [wipItems]);

    // MRP Numbers list for filter dropdown
    const mrpList = useMemo(() => {
        const set = new Set<string>();
        mrpBuckets.forEach(b => {
            if (b.mrpNumber) set.add(b.mrpNumber);
        });
        ledgerTransactions.forEach(t => {
            if (t.mrpNumber) set.add(t.mrpNumber);
        });
        return Array.from(set);
    }, [mrpBuckets, ledgerTransactions]);

    // Filtered Items for standard RM/BO/FG WIP tabs
    const filteredItems = useMemo(() => {
        return wipItems.filter(item => {
            const matchSearch =
                item.materialName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.materialCode && item.materialCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (item.materialDescription && item.materialDescription.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchCategory = !filterCategory || item.categoryName === filterCategory || item.categoryType === filterCategory;

            const matchStatus = filterStatus === 'All' || 
                (filterStatus === 'Active WIP Only' ? item.pendingWipQty > 0 : item.pendingWipQty === 0);

            return matchSearch && matchCategory && matchStatus;
        });
    }, [wipItems, searchTerm, filterCategory, filterStatus]);

    // Filtered MRP Buckets for MRP WIP Inventory tab
    const filteredMrpBuckets = useMemo(() => {
        return mrpBuckets.filter(bucket => {
            const matchSearch =
                (bucket.mrpNumber && bucket.mrpNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (bucket.customerName && bucket.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (bucket.items && bucket.items.some((it: any) => it.materialName?.toLowerCase().includes(searchTerm.toLowerCase())));

            const matchMrp = !filterMrp || bucket.mrpNumber === filterMrp;
            const matchStatus = filterStatus === 'All' || 
                (filterStatus === 'Completed' ? bucket.status === 'Completed' : bucket.status !== 'Completed');

            return matchSearch && matchMrp && matchStatus;
        });
    }, [mrpBuckets, searchTerm, filterMrp, filterStatus]);

    // Filtered Ledger Transactions with Date Filter
    const filteredLedger = useMemo(() => {
        let list = ledgerTransactions.filter(tx => {
            const matchSearch =
                (tx.materialName && tx.materialName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (tx.docNumber && tx.docNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (tx.mrpNumber && tx.mrpNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (tx.type && tx.type.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (tx.processType && tx.processType.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchMrp = !filterMrp || tx.mrpNumber === filterMrp;
            return matchSearch && matchMrp;
        });

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        if (filterDatePreset === 'today') {
            list = list.filter(tx => new Date(tx.date) >= startOfToday);
        } else if (filterDatePreset === 'this_month') {
            list = list.filter(tx => new Date(tx.date) >= startOfMonth);
        } else if (filterDatePreset === 'last_30_days') {
            list = list.filter(tx => new Date(tx.date) >= thirtyDaysAgo);
        } else if (filterDatePreset === 'custom') {
            if (filterStartDate) {
                const sDate = new Date(filterStartDate);
                sDate.setHours(0, 0, 0, 0);
                list = list.filter(tx => new Date(tx.date) >= sDate);
            }
            if (filterEndDate) {
                const eDate = new Date(filterEndDate);
                eDate.setHours(23, 59, 59, 999);
                list = list.filter(tx => new Date(tx.date) <= eDate);
            }
        }

        return list;
    }, [ledgerTransactions, searchTerm, filterMrp, filterDatePreset, filterStartDate, filterEndDate]);

    const openLedger = (item: any) => {
        setSelectedWipItem(item);
        setIsLedgerOpen(true);
    };

    // Excel Export Function for All Stock Details
    const exportToExcel = () => {
        const wb = XLSX.utils.book_new();
        const dateStr = new Date().toISOString().split('T')[0];

        if (wipType === 'mrp') {
            const rows = filteredMrpBuckets.map((bucket, idx) => ({
                'S.No': idx + 1,
                'MRP Number': bucket.mrpNumber || '-',
                'Customer / Reference': bucket.customerName || '-',
                'Status': bucket.status || 'Planned',
                'RM Issued': bucket.totalRmIssued || 0,
                'BO Issued': bucket.totalBoIssued || 0,
                'FG / Comp Issued': bucket.totalFgIssued || 0,
                'FG Produced': bucket.totalFgProduced || 0,
                'Net Pending WIP Units': bucket.netPendingWipCount || 0,
                'Items in WIP': (bucket.items || []).map((it: any) => `${it.materialName} (${it.pendingQty} ${it.unit})`).join('; ')
            }));
            const ws = XLSX.utils.json_to_sheet(rows);
            XLSX.utils.book_append_sheet(wb, ws, 'MRP_WIP_Inventory');
            XLSX.writeFile(wb, `MRP_WIP_Inventory_${dateStr}.xlsx`);
        } else if (wipType === 'ledger') {
            const rows = filteredLedger.map((tx, idx) => ({
                'S.No': idx + 1,
                'Date & Time': tx.date ? new Date(tx.date).toLocaleString() : '-',
                'Document #': tx.docNumber || '-',
                'MRP Reference': tx.mrpNumber || 'Direct Issue',
                'Material Name': tx.materialName || '-',
                'Material Code': tx.materialCode || '-',
                'Movement Type': tx.type || '-',
                'Process / Vendor': tx.processType || tx.vendorName || '-',
                'WIP Inward (+)': tx.sentQty > 0 ? tx.sentQty : 0,
                'WIP Consumed (-)': tx.receivedQty > 0 ? tx.receivedQty : 0,
                'QC Rejected (-)': tx.rejectedQty > 0 ? tx.rejectedQty : 0,
                'Unit': tx.unit || 'PCS',
                'Status': tx.status || 'Recorded'
            }));
            const ws = XLSX.utils.json_to_sheet(rows);
            XLSX.utils.book_append_sheet(wb, ws, 'WIP_Movement_Ledger');
            XLSX.writeFile(wb, `WIP_Movement_Ledger_${dateStr}.xlsx`);
        } else {
            const typeLabel = wipType.toUpperCase();
            const rows = filteredItems.map((item, idx) => {
                const isFg = wipType === 'fg';
                const priceInfo = getItemPriceDetails(item, isFg);
                const shopfloorVal = (item.shopfloorWipQty || 0) * priceInfo.unitPrice;
                const jobWorkVal = (item.jobWorkWipQty || 0) * priceInfo.unitPrice;
                const wipValuation = (item.pendingWipQty || 0) * priceInfo.unitPrice;

                const rowObj: any = {
                    'S.No': idx + 1,
                    'Material Name': item.materialName || '-',
                    'Material Code': item.materialCode || '-',
                    'Category': item.categoryName || item.categoryType || '-',
                    'Unit': item.unit || 'PCS',
                    'Main Store Stock': item.mainStoreStock || 0,
                    'Shopfloor WIP': item.shopfloorWipQty || 0,
                    'Pending QC': item.pendingQcQty || 0,
                    'Job Work Stock': item.jobWorkWipQty || 0,
                    'Total WIP': item.pendingWipQty || 0,
                    'Unit Price (INR)': priceInfo.unitPrice,
                    'Price Source': priceInfo.source,
                    'Shopfloor WIP Valuation (INR)': Number(shopfloorVal.toFixed(2)),
                    'Job Work WIP Valuation (INR)': Number(jobWorkVal.toFixed(2)),
                    'Total WIP Valuation (INR)': Number(wipValuation.toFixed(2)),
                    'Status': item.status || (item.pendingWipQty > 0 ? 'In WIP' : 'WIP Zero'),
                    'Last Movement Date': item.lastMovementDate ? new Date(item.lastMovementDate).toLocaleDateString() : '-'
                };
                return rowObj;
            });
            const ws = XLSX.utils.json_to_sheet(rows);
            XLSX.utils.book_append_sheet(wb, ws, `${typeLabel}_WIP`);
            XLSX.writeFile(wb, `${typeLabel}_WIP_Inventory_${dateStr}.xlsx`);
        }
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            
            {/* Executive WIP Pricing & Valuation Dashboard Header & Cards */}
            <div className="border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-4 shadow-xs">
                {!showDashboard ? (
                    /* Collapsed Single-Line Summary Bar */
                    <div className="bg-slate-50 dark:bg-slate-800/80 px-3.5 py-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center flex-wrap gap-2.5 sm:gap-4 text-slate-600 dark:text-slate-300">
                            {wipKpis.isFocused ? (
                                <>
                                    <span className="font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                                        <Crosshair size={14} className="text-indigo-600" />
                                        Focused: <strong className="font-mono text-slate-900 dark:text-white">{wipKpis.itemName}</strong>
                                    </span>
                                    <span className="text-slate-300 dark:text-slate-600">|</span>
                                    <span>
                                        Total WIP: <strong className="text-slate-900 dark:text-white font-mono">{wipKpis.formattedTotalWipQty}</strong>
                                    </span>
                                    <span className="text-slate-300 dark:text-slate-600">|</span>
                                    <span>
                                        Valuation: <strong className="text-emerald-600 font-mono">{wipKpis.formattedTotalWipValuation}</strong>
                                    </span>
                                    <span className="text-slate-300 dark:text-slate-600">|</span>
                                    <button
                                        type="button"
                                        onClick={() => setFocusedItemId(null)}
                                        className="text-[11px] font-bold text-rose-600 hover:text-rose-700 underline cursor-pointer"
                                    >
                                        Reset Focus
                                    </button>
                                </>
                            ) : (
                                <>
                                    <span className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                        <Boxes size={14} className="text-indigo-600" />
                                        {wipKpis.tabTitle}: <strong className="text-indigo-600 font-mono">{wipKpis.totalItems} Items</strong>
                                    </span>
                                    <span className="text-slate-300 dark:text-slate-600">|</span>
                                    <span>
                                        Active WIP Units: <strong className="text-slate-900 dark:text-white font-mono">{wipKpis.formattedTotalWipQty}</strong>
                                    </span>
                                    <span className="text-slate-300 dark:text-slate-600">|</span>
                                    <span>
                                        Total WIP Valuation: <strong className="text-emerald-600 font-mono">{wipKpis.formattedTotalWipValuation}</strong>
                                    </span>
                                    <span className="text-slate-300 dark:text-slate-600">|</span>
                                    <span>
                                        Priced via Price List: <strong className="text-indigo-600 font-mono">{wipKpis.pricedItemsCount}</strong>
                                    </span>
                                </>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowDashboard(true)}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                            <span>Show Dashboard</span>
                            <ChevronDown size={14} />
                        </button>
                    </div>
                ) : (
                    /* Expanded Dashboard with Header Filter Bar & 4 KPI Cards */
                    <div className="space-y-3.5">
                        {/* Dynamic Dashboard Control Bar (Item Focus Selector & Mode Badges) */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                            {/* Left: Mode Title */}
                            <div className="flex items-center gap-2 flex-wrap">
                                {wipKpis.isFocused ? (
                                    <div className="flex items-center gap-2">
                                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 border border-indigo-200 dark:border-indigo-800 shadow-2xs">
                                            <Crosshair size={13} className="text-indigo-600 dark:text-indigo-400 animate-pulse" />
                                            <span>Single Item WIP Analysis</span>
                                        </span>
                                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                            {wipKpis.itemName}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 uppercase tracking-wide">
                                            <LayoutGrid size={14} className="text-indigo-600 dark:text-indigo-400" />
                                            <span>{wipKpis.tabTitle} Executive Overview</span>
                                        </span>
                                        <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 font-mono">
                                            ({wipKpis.totalItems} Items &bull; {wipKpis.pricedItemsCount} Priced via Price List)
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Right: Item Focus Selector & Hide Toggle */}
                            <div className="flex items-center gap-2 shrink-0">
                                <label htmlFor="wip-item-focus-select" className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1 shrink-0">
                                    <Crosshair size={13} className="text-indigo-500" />
                                    <span>Focus Item:</span>
                                </label>
                                <select
                                    id="wip-item-focus-select"
                                    value={focusedItemId || ''}
                                    onChange={(e) => setFocusedItemId(e.target.value ? e.target.value : null)}
                                    className="text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 max-w-[210px] sm:max-w-[300px] truncate shadow-2xs cursor-pointer font-medium"
                                >
                                    <option value="">All Items (Overview Mode)</option>
                                    {wipItems.map((item: any) => {
                                        const id = (item.id || item._id)?.toString();
                                        const name = item.materialName || item.name || 'Unnamed Item';
                                        const desc = item.materialDescription || item.descriptions || item.description;
                                        const label = desc ? `${name} — ${desc}` : name;
                                        return (
                                            <option key={id} value={id}>
                                                {label}
                                            </option>
                                        );
                                    })}
                                </select>
                                {focusedItemId && (
                                    <button
                                        type="button"
                                        onClick={() => setFocusedItemId(null)}
                                        className="text-xs font-bold px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-800 flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                                        title="Clear focus and return to aggregate overview"
                                    >
                                        <RotateCcw size={12} />
                                        <span>Reset</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setShowDashboard(false)}
                                    className="text-xs font-bold px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl flex items-center gap-1 transition-all cursor-pointer shadow-2xs ml-1"
                                >
                                    <span>Hide</span>
                                    <ChevronUp size={13} />
                                </button>
                            </div>
                        </div>

                        {/* 4 Dynamic KPI Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {/* Card 1: WIP Stock Volume & SKUs */}
                            <div className="bg-gradient-to-br from-indigo-50/90 via-white to-slate-50 dark:from-indigo-950/30 dark:via-slate-900 dark:to-slate-900 p-3.5 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 shadow-2xs relative overflow-hidden">
                                <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 mb-1.5">
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        {wipKpis.isFocused ? "Active WIP Quantity" : "Total Active WIP Units"}
                                    </span>
                                    <div className="w-7 h-7 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                                        <Boxes size={15} />
                                    </div>
                                </div>
                                <div className="text-xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                                    {wipKpis.isFocused ? (
                                        <span>{wipKpis.formattedTotalWipQty}</span>
                                    ) : (
                                        <>
                                            {wipKpis.formattedTotalWipQty} <span className="text-xs font-semibold text-slate-500 font-sans">Units</span>
                                        </>
                                    )}
                                </div>
                                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                    {wipKpis.isFocused ? (
                                        <>
                                            <span>Secondary Unit WIP</span>
                                            <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                                                {wipKpis.formattedSecWipQty || "N/A"}
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Active / Total Catalog</span>
                                            <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                                                {wipKpis.activeWipItemCount} / {wipKpis.totalItems} Items
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Card 2: Total WIP Valuation (INR) */}
                            <div className="bg-gradient-to-br from-emerald-50/90 via-white to-slate-50 dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900 p-3.5 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 shadow-2xs relative overflow-hidden">
                                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1.5">
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        {wipKpis.isFocused ? "Item WIP Value" : "Total WIP Valuation"}
                                    </span>
                                    <div className="w-7 h-7 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                                        <IndianRupee size={15} />
                                    </div>
                                </div>
                                <div className="text-xl font-black text-slate-900 dark:text-white font-mono tracking-tight truncate">
                                    {wipKpis.formattedTotalWipValuation}
                                </div>
                                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                    {wipKpis.isFocused ? (
                                        <>
                                            <span>Rate: <strong className="font-mono text-slate-800 dark:text-slate-200">{wipKpis.formattedUnitPrice}</strong></span>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${wipKpis.priceBadgeColor}`}>
                                                {wipKpis.priceSource}
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Valuation Source</span>
                                            <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                                                {wipType === 'fg' ? 'Sales Price List' : 'Purchase Price List'}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Card 3: Capital Distribution (Shopfloor vs Job Work) */}
                            <div className="bg-gradient-to-br from-amber-50/90 via-purple-50/30 to-slate-50 dark:from-amber-950/20 dark:via-purple-950/20 dark:to-slate-900 p-3.5 rounded-2xl border border-amber-100 dark:border-amber-900/40 shadow-2xs relative overflow-hidden">
                                <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1.5">
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        Capital Distribution
                                    </span>
                                    <div className="w-7 h-7 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                                        <Factory size={15} />
                                    </div>
                                </div>
                                <div className="flex items-baseline justify-between">
                                    <div>
                                        <span className="text-[10px] text-amber-600 font-bold uppercase block">Shopfloor</span>
                                        <span className="text-sm font-black font-mono text-amber-700 dark:text-amber-300">
                                            {wipKpis.formattedShopfloorValuation}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] text-purple-600 font-bold uppercase block">Job Work</span>
                                        <span className="text-sm font-black font-mono text-purple-700 dark:text-purple-300">
                                            {wipKpis.formattedJobWorkValuation}
                                        </span>
                                    </div>
                                </div>
                                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                                    <span>In-House: <strong className="font-mono text-amber-600">{wipKpis.formattedShopfloorQty}</strong></span>
                                    <span>Vendors: <strong className="font-mono text-purple-600">{wipKpis.formattedJobWorkQty}</strong></span>
                                </div>
                            </div>

                            {/* Card 4: Store Stock vs WIP Allocation Ratio */}
                            <div className="bg-gradient-to-br from-blue-50/90 via-white to-slate-50 dark:from-blue-950/30 dark:via-slate-900 dark:to-slate-900 p-3.5 rounded-2xl border border-blue-100 dark:border-blue-900/40 shadow-2xs relative overflow-hidden">
                                <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-1.5">
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        Store vs WIP Allocation
                                    </span>
                                    <div className="w-7 h-7 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                                        <Warehouse size={15} />
                                    </div>
                                </div>
                                <div className="text-xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                                    {wipKpis.formattedMainStoreQty} <span className="text-xs font-semibold text-slate-500 font-sans">in Store</span>
                                </div>
                                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                    <span>Store Value: <strong className="font-mono text-blue-600">{wipKpis.formattedMainStoreValuation}</strong></span>
                                    <span className="font-bold text-slate-600 dark:text-slate-300">
                                        {wipKpis.mainStoreQty > 0 ? `${((wipKpis.totalWipQty / (wipKpis.mainStoreQty + wipKpis.totalWipQty || 1)) * 100).toFixed(0)}% in WIP` : '—'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Filter & Action Toolbar */}
            <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col gap-2.5">
                <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
                    <div className="flex-1 flex flex-wrap gap-2.5 items-center">
                        {/* Search Input */}
                        <div className="relative flex-1 sm:w-64 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                            <input
                                type="text"
                                placeholder={wipType === 'mrp' ? "Search MRP Plan / Sales Order..." : "Search Material Name / Code..."}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 dark:text-slate-100 placeholder-slate-400"
                            />
                        </div>

                        {/* Category Filter */}
                        {wipType !== 'mrp' && wipType !== 'ledger' && categoriesList.length > 0 && (
                            <select
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value)}
                                className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            >
                                <option value="">All Categories</option>
                                {categoriesList.map((cat, idx) => (
                                    <option key={idx} value={cat}>{cat}</option>
                                ))}
                            </select>
                        )}

                        {/* Status Filter */}
                        {wipType !== 'ledger' && (
                            <select
                                value={filterStatus}
                                onChange={(e: any) => setFilterStatus(e.target.value)}
                                className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            >
                                <option value="All">All Status</option>
                                <option value="Active WIP Only">Active WIP Only</option>
                                <option value="WIP Zero">WIP Zero</option>
                            </select>
                        )}

                        {/* MRP Plan Filter for Ledger */}
                        {wipType === 'ledger' && mrpList.length > 0 && (
                            <select
                                value={filterMrp}
                                onChange={(e) => setFilterMrp(e.target.value)}
                                className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            >
                                <option value="">All MRP Plans</option>
                                {mrpList.map((mrp, idx) => (
                                    <option key={idx} value={mrp}>{mrp}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Refresh Data Button */}
                        <button
                            onClick={fetchWipInventory}
                            disabled={loading}
                            className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                        >
                            <RefreshCw size={13} className={loading ? "animate-spin text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400"} />
                            <span>Refresh</span>
                        </button>

                        {/* Excel Export Button */}
                        <button
                            onClick={exportToExcel}
                            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 dark:text-emerald-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 border border-emerald-200/60 dark:border-emerald-800"
                        >
                            <Download size={13} />
                            <span>Export</span>
                        </button>
                    </div>
                </div>

                {/* Date Filter Bar for Ledger view */}
                {wipType === 'ledger' && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Date:</span>
                            {[
                                { key: 'all', label: 'All Time' },
                                { key: 'today', label: 'Today' },
                                { key: 'this_month', label: 'This Month' },
                                { key: 'last_30_days', label: 'Last 30 Days' },
                                { key: 'custom', label: 'Custom Range' },
                            ].map((btn) => (
                                <button
                                    key={btn.key}
                                    onClick={() => setFilterDatePreset(btn.key as any)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                        filterDatePreset === btn.key
                                            ? 'bg-indigo-600 text-white shadow-xs'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    {btn.label}
                                </button>
                            ))}
                        </div>

                        {filterDatePreset === 'custom' && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    value={filterStartDate}
                                    onChange={(e) => setFilterStartDate(e.target.value)}
                                    className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                                />
                                <span className="text-slate-400">to</span>
                                <input
                                    type="date"
                                    value={filterEndDate}
                                    onChange={(e) => setFilterEndDate(e.target.value)}
                                    className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Main Content Area */}
            {loading ? (
                <div className="flex justify-center p-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            ) : wipType === 'mrp' ? (
                /* MRP WIP Inventory View */
                filteredMrpBuckets.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                        <Boxes className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                            No Active MRP WIP Tracking Plans
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">Material issues against MRP Plans will group and show cumulative progress here.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredMrpBuckets.map((bucket) => {
                            const isCompleted = bucket.pendingWipQty <= 0 && bucket.totalIssuedQty > 0;
                            const planWipValuation = (bucket.items || []).reduce((acc: number, it: any) => {
                                const itPrice = getItemPriceDetails(it, false);
                                return acc + ((it.pendingQty || 0) * itPrice.unitPrice);
                            }, 0);
                            return (
                                <div key={bucket.mrpPlanId || bucket.mrpNumber} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-4">
                                    {/* MRP Header Info */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                                                <Boxes size={20} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-base font-bold text-slate-900 dark:text-white font-mono">
                                                        {bucket.mrpNumber}
                                                    </h3>
                                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                                        isCompleted 
                                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                                                            : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                                                    }`}>
                                                        {isCompleted ? 'MRP Closed' : 'In Production'}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    Product: <span className="font-semibold text-slate-700 dark:text-slate-300">{bucket.productName}</span> ({bucket.orderQuantity} {bucket.unit})
                                                    {bucket.salesOrderNumber && <span className="ml-2">| SO: <span className="font-mono font-bold text-indigo-600">{bucket.salesOrderNumber}</span></span>}
                                                    {bucket.customerName && <span className="ml-2 text-slate-400">({bucket.customerName})</span>}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Progress Metrics */}
                                        <div className="flex items-center gap-4 text-xs">
                                            <div className="text-right">
                                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Issued to WIP</span>
                                                <span className="font-bold text-amber-600 font-mono text-sm">
                                                    {bucket.totalIssuedQty}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[10px] uppercase font-bold text-slate-400 block">FG Consumed</span>
                                                <span className="font-bold text-emerald-600 font-mono text-sm">
                                                    {bucket.totalConsumedQty}
                                                </span>
                                            </div>
                                            <div className="text-right pl-3 border-l border-slate-200 dark:border-slate-700">
                                                <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 block">Pending In WIP</span>
                                                <span className="font-black text-indigo-700 dark:text-indigo-300 font-mono text-base">
                                                    {bucket.pendingWipQty}
                                                </span>
                                            </div>
                                            <div className="text-right pl-3 border-l border-slate-200 dark:border-slate-700">
                                                <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">WIP Valuation</span>
                                                <span className="font-black text-emerald-700 dark:text-emerald-300 font-mono text-base">
                                                    {planWipValuation > 0 ? `₹${planWipValuation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Items Inside this MRP Bucket */}
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Items in MRP WIP Inventory</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                            {(bucket.items || []).map((it: any, i: number) => (
                                                <div key={i} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 flex justify-between items-center text-xs">
                                                    <div className="min-w-0 pr-2">
                                                        <span className="font-bold text-slate-900 dark:text-white block truncate">{it.materialName}</span>
                                                        <span className="text-[10px] text-slate-400 block mt-0.5">{it.category || '-'}</span>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 block">
                                                            {it.pendingQty} <span className="text-[10px] font-normal text-slate-400">{it.unit}</span>
                                                        </span>
                                                        <span className="text-[10px] text-slate-400">
                                                            Issued: {it.issuedQty}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            ) : wipType === 'ledger' ? (
                /* WIP Movement Ledger View */
                filteredLedger.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                        <History className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                            No WIP Movement Transactions Found
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">Material issues, job work shipments, and FG GRN consumption movements will record here.</p>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="px-5 py-3.5">Date & Time</th>
                                        <th className="px-5 py-3.5">Document #</th>
                                        <th className="px-5 py-3.5">MRP Reference</th>
                                        <th className="px-5 py-3.5">Material Name</th>
                                        <th className="px-5 py-3.5">Process / Vendor</th>
                                        <th className="px-5 py-3.5">Movement Type</th>
                                        <th className="px-5 py-3.5 text-center">WIP Inward (+)</th>
                                        <th className="px-5 py-3.5 text-center">WIP Consumed (-)</th>
                                        <th className="px-5 py-3.5 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                                    {filteredLedger.map((tx: any, idx: number) => {
                                        const isRejection = tx.isRejection || tx.status === 'Rejected' || tx.rejectedQty > 0 || tx.type.toLowerCase().includes('rejection');
                                        return (
                                            <tr key={idx} className={`transition-colors ${
                                                isRejection 
                                                    ? 'bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50/70' 
                                                    : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/50'
                                            }`}>
                                                <td className="px-5 py-3.5 text-slate-500 font-mono">
                                                    {new Date(tx.date).toLocaleDateString()} {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="px-5 py-3.5 font-bold font-mono text-slate-900 dark:text-white">
                                                    {tx.docNumber}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    {tx.mrpNumber ? (
                                                        <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                                                            {tx.mrpNumber}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 italic">Direct Store Issue</span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-white max-w-[200px]">
                                                    <div className="font-bold">{tx.materialName}</div>
                                                </td>
                                                <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400">
                                                    <span className="text-slate-700 dark:text-slate-300 font-medium block">{tx.processType || tx.vendorName || '-'}</span>
                                                    {isRejection && tx.rejectionReason && (
                                                        <span className="text-[11px] text-rose-600 block mt-0.5">Reason: {tx.rejectionReason}</span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">
                                                    <span className="font-semibold block text-slate-800 dark:text-slate-200">{tx.type}</span>
                                                </td>
                                                <td className="px-5 py-3.5 text-center font-bold text-amber-600 dark:text-amber-400 font-mono">
                                                    {tx.sentQty > 0 ? `+${tx.sentQty} ${tx.unit}` : '-'}
                                                </td>
                                                <td className="px-5 py-3.5 text-center font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                                                    {isRejection && tx.rejectedQty > 0 ? (
                                                        <span className="text-rose-600 dark:text-rose-400 font-bold">-{tx.rejectedQty} {tx.unit} (Rej)</span>
                                                    ) : (
                                                        tx.receivedQty > 0 ? `-${tx.receivedQty} ${tx.unit}` : '-'
                                                    )}
                                                </td>
                                                <td className="px-5 py-3.5 text-center">
                                                    {isRejection ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                                                            QC REJECTED
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                            {tx.status || 'Recorded'}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            ) : (
                /* Master-Driven RM / BO / FG Table View */
                filteredItems.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                        <Layers className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                            No {wipType === 'rm' ? 'Raw Material (RM)' : wipType === 'bo' ? 'Bought Out (BO)' : 'Finished Goods (FG)'} Catalog Items Found
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">Master catalog items will track perpetual WIP balances here.</p>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                        {/* Desktop Table View */}
                        <div className="hidden lg:block overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead>
                                    <tr className="bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                        <th className="px-4 py-3.5">Material & Description</th>
                                        <th className="px-4 py-3.5">Category</th>
                                        <th className="px-4 py-3.5 text-center">Main Store Stock</th>
                                        <th className="px-4 py-3.5 text-center">Shopfloor WIP</th>
                                        <th className="px-4 py-3.5 text-center">Job Work Stock</th>
                                        <th className="px-4 py-3.5 text-center">Total WIP</th>
                                        <th className="px-4 py-3.5 text-center">Rate</th>
                                        <th className="px-4 py-3.5 text-right">WIP Valuation</th>
                                        <th className="px-4 py-3.5 text-center">Status</th>
                                        <th className="px-4 py-3.5 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                    {filteredItems.map((item) => {
                                        const isFg = wipType === 'fg';
                                        const priceInfo = getItemPriceDetails(item, isFg);
                                        const itemWipValuation = (item.pendingWipQty || 0) * priceInfo.unitPrice;
                                        const isFocusedRow = focusedItemId === (item.id || item._id)?.toString();

                                        return (
                                            <tr key={item.id} className={`transition-colors ${isFocusedRow ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/50'}`}>
                                                <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white max-w-[280px]">
                                                    <div className="font-bold text-slate-900 dark:text-white leading-snug">{item.materialName}</div>
                                                    {item.materialDescription && (
                                                        <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[260px] font-normal mt-0.5" title={item.materialDescription}>
                                                            {item.materialDescription}
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="px-4 py-3.5 text-xs text-slate-700 dark:text-slate-300 font-semibold">
                                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                                        {item.categoryName || '-'}
                                                    </span>
                                                </td>

                                                <td className="px-4 py-3.5 text-center font-bold text-slate-700 dark:text-slate-300 font-mono">
                                                    <div>
                                                        {item.mainStoreStock} <span className="text-[10px] font-normal text-slate-400">{item.unit}</span>
                                                    </div>
                                                    {item.hasSecondaryUnit && item.secondaryUnit && (
                                                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal mt-0.5">
                                                            {item.mainStoreSecondaryStock != null ? item.mainStoreSecondaryStock : parseFloat(((item.mainStoreStock || 0) * (item.conversionFactor || 1)).toFixed(2))} {item.secondaryUnit}
                                                        </div>
                                                    )}
                                                </td>

                                                <td className="px-4 py-3.5 text-center font-bold text-slate-900 dark:text-white font-mono">
                                                    <div>
                                                        <span>{item.shopfloorWipQty}</span> <span className="text-[10px] font-normal text-slate-400">{item.unit}</span>
                                                    </div>
                                                    {item.pendingQcQty > 0 && (
                                                        <span className="inline-block text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-0.5" title="Stock Awaiting QC Inspection">
                                                            (+{item.pendingQcQty} in QC)
                                                        </span>
                                                    )}
                                                    {item.hasSecondaryUnit && item.secondaryUnit && (
                                                        <div className="text-[10px] text-indigo-500/80 dark:text-indigo-400/80 font-normal mt-0.5">
                                                            {item.shopfloorWipSecondaryQty != null ? item.shopfloorWipSecondaryQty : parseFloat(((item.shopfloorWipQty || 0) * (item.conversionFactor || 1)).toFixed(2))} {item.secondaryUnit}
                                                        </div>
                                                    )}
                                                </td>

                                                <td className="px-4 py-3.5 text-center font-bold text-purple-600 dark:text-purple-400 font-mono">
                                                    <div>
                                                        {item.jobWorkWipQty || 0} <span className="text-[10px] font-normal text-slate-400">{item.unit}</span>
                                                    </div>
                                                    {item.hasSecondaryUnit && item.secondaryUnit && (
                                                        <div className="text-[10px] text-purple-400 dark:text-purple-400/70 font-normal mt-0.5">
                                                            {item.jobWorkWipSecondaryQty != null ? item.jobWorkWipSecondaryQty : parseFloat(((item.jobWorkWipQty || 0) * (item.conversionFactor || 1)).toFixed(2))} {item.secondaryUnit}
                                                        </div>
                                                    )}
                                                </td>

                                                <td className="px-4 py-3.5 text-center">
                                                    <div>
                                                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-black font-mono ${
                                                            item.pendingWipQty > 0 
                                                                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800' 
                                                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                                        }`}>
                                                            {item.pendingWipQty} {item.unit}
                                                        </span>
                                                    </div>
                                                    {item.hasSecondaryUnit && item.secondaryUnit && (
                                                        <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold font-mono mt-0.5">
                                                            {item.pendingWipSecondaryQty != null ? item.pendingWipSecondaryQty : parseFloat(((item.pendingWipQty || 0) * (item.conversionFactor || 1)).toFixed(2))} {item.secondaryUnit}
                                                        </div>
                                                    )}
                                                </td>

                                                <td className="px-4 py-3.5 text-center font-mono">
                                                    <div className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                                                        {priceInfo.unitPrice > 0 ? `₹${priceInfo.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                                        per {priceInfo.primaryUnit}
                                                    </div>
                                                    {priceInfo.hasSecondaryUnit && priceInfo.secondaryUnitPrice > 0 && (
                                                        <div className="text-[10px] text-indigo-500 font-medium mt-0.5">
                                                            (₹{priceInfo.secondaryUnitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {priceInfo.secondaryUnit})
                                                        </div>
                                                    )}
                                                    {priceInfo.unitPrice > 0 && (
                                                        <span className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded border mt-0.5 ${priceInfo.badgeColor}`}>
                                                            {priceInfo.source}
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="px-4 py-3.5 text-right font-mono">
                                                    <div className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                                                        {itemWipValuation > 0 ? `₹${itemWipValuation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                                                    </div>
                                                    {itemWipValuation > 0 && (
                                                        <div className="text-[10px] text-slate-400 mt-0.5">
                                                            SF: ₹{((item.shopfloorWipQty || 0) * priceInfo.unitPrice).toLocaleString('en-IN', { maximumFractionDigits: 0 })} | JW: ₹{((item.jobWorkWipQty || 0) * priceInfo.unitPrice).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                                        </div>
                                                    )}
                                                </td>

                                                <td className="px-4 py-3.5 text-center">
                                                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                                        item.pendingWipQty > 0 
                                                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900' 
                                                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                                                    }`}>
                                                        {item.pendingWipQty > 0 ? 'In WIP' : 'WIP Zero'}
                                                    </span>
                                                </td>

                                                <td className="px-4 py-3.5 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (isFocusedRow) {
                                                                    setFocusedItemId(null);
                                                                } else {
                                                                    setFocusedItemId((item.id || item._id)?.toString());
                                                                    setShowDashboard(true);
                                                                }
                                                            }}
                                                            className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 border cursor-pointer ${
                                                                isFocusedRow
                                                                    ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                                                                    : "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                                                            }`}
                                                            title={isFocusedRow ? "Clear single-item focus" : "Focus on this item in dashboard"}
                                                        >
                                                            <Crosshair size={12} />
                                                            <span>{isFocusedRow ? "Focused" : "Focus"}</span>
                                                        </button>
                                                        {item.shopfloorWipQty > 0 && (
                                                            <>
                                                                <button
                                                                    onClick={() => handleOpenActionModal(item, 'return')}
                                                                    className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:text-emerald-300 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 border border-emerald-200 dark:border-emerald-800 cursor-pointer"
                                                                    title="Return back to Main Store"
                                                                >
                                                                    <ArrowDownLeft size={13} /> Return
                                                                </button>
                                                                <button
                                                                    onClick={() => handleOpenActionModal(item, 'scrap')}
                                                                    className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950 dark:hover:bg-rose-900 dark:text-rose-300 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 border border-rose-200 dark:border-rose-800 cursor-pointer"
                                                                    title="Record Process Scrap"
                                                                >
                                                                    <Trash2 size={13} /> Scrap
                                                                </button>
                                                            </>
                                                        )}
                                                        <button
                                                            onClick={() => openLedger(item)}
                                                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-300 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 border border-indigo-200 dark:border-indigo-800 cursor-pointer"
                                                            title="View Transaction History"
                                                        >
                                                            <Eye size={13} /> Ledger
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Responsive Mobile / Tablet Card View */}
                        <div className="lg:hidden flex flex-col divide-y divide-slate-100 dark:divide-slate-800 pb-20">
                            {filteredItems.map((item) => {
                                const isFg = wipType === 'fg';
                                const priceInfo = getItemPriceDetails(item, isFg);
                                const itemWipValuation = (item.pendingWipQty || 0) * priceInfo.unitPrice;
                                const isFocusedRow = focusedItemId === (item.id || item._id)?.toString();

                                return (
                                <div key={item.id} className={`p-4 flex flex-col gap-3 transition-colors ${isFocusedRow ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : 'bg-white dark:bg-slate-900'}`}>
                                    <div className="flex justify-between items-start gap-2">
                                        <div>
                                            <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                                                {item.materialName}
                                            </h4>
                                            {item.materialDescription && (
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5" title={item.materialDescription}>
                                                    {item.materialDescription}
                                                </p>
                                            )}
                                            <div className="mt-1">
                                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{item.categoryName || '-'}</span>
                                            </div>
                                        </div>
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                            item.pendingWipQty > 0 
                                                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300' 
                                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                        }`}>
                                            {item.pendingWipQty > 0 ? 'In WIP' : 'WIP Zero'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 text-center text-xs">
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 block">Store Stock</span>
                                            <span className="font-bold text-slate-700 dark:text-slate-300 font-mono">{item.mainStoreStock} <span className="text-[9px] font-normal text-slate-400">{item.unit}</span></span>
                                            {item.hasSecondaryUnit && item.secondaryUnit && (
                                                <span className="text-[9px] text-slate-400 block font-mono">
                                                    {item.mainStoreSecondaryStock != null ? item.mainStoreSecondaryStock : parseFloat(((item.mainStoreStock || 0) * (item.conversionFactor || 1)).toFixed(2))} {item.secondaryUnit}
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 block">Shopfloor</span>
                                            <span className="font-bold text-slate-900 dark:text-white font-mono">{item.shopfloorWipQty} <span className="text-[9px] font-normal text-slate-400">{item.unit}</span></span>
                                            {item.pendingQcQty > 0 && (
                                                <span className="text-[9px] font-bold text-amber-600 block">
                                                    (+{item.pendingQcQty} in QC)
                                                </span>
                                            )}
                                            {item.hasSecondaryUnit && item.secondaryUnit && (
                                                <span className="text-[9px] text-indigo-500 block font-mono">
                                                    {item.shopfloorWipSecondaryQty != null ? item.shopfloorWipSecondaryQty : parseFloat(((item.shopfloorWipQty || 0) * (item.conversionFactor || 1)).toFixed(2))} {item.secondaryUnit}
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-purple-600 block">Job Work</span>
                                            <span className="font-bold text-purple-600 font-mono">{item.jobWorkWipQty || 0} <span className="text-[9px] font-normal text-slate-400">{item.unit}</span></span>
                                            {item.hasSecondaryUnit && item.secondaryUnit && (
                                                <span className="text-[9px] text-purple-400 block font-mono">
                                                    {item.jobWorkWipSecondaryQty != null ? item.jobWorkWipSecondaryQty : parseFloat(((item.jobWorkWipQty || 0) * (item.conversionFactor || 1)).toFixed(2))} {item.secondaryUnit}
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-indigo-600 block">Total WIP</span>
                                            <span className="font-black text-indigo-600 font-mono">{item.pendingWipQty} <span className="text-[9px] font-normal text-slate-400">{item.unit}</span></span>
                                            {item.hasSecondaryUnit && item.secondaryUnit && (
                                                <span className="text-[9px] text-indigo-600 dark:text-indigo-400 block font-bold font-mono">
                                                    {item.pendingWipSecondaryQty != null ? item.pendingWipSecondaryQty : parseFloat(((item.pendingWipQty || 0) * (item.conversionFactor || 1)).toFixed(2))} {item.secondaryUnit}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Rate, WIP Valuation & Focus Row */}
                                    <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-slate-400 font-medium">Rate:</span>
                                                <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                                                    {priceInfo.unitPrice > 0 ? `₹${priceInfo.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                                                </span>
                                                {priceInfo.unitPrice > 0 && (
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${priceInfo.badgeColor}`}>
                                                        {priceInfo.source}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                                                WIP Val: <strong className="text-emerald-600 dark:text-emerald-400">₹{itemWipValuation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (isFocusedRow) {
                                                    setFocusedItemId(null);
                                                } else {
                                                    setFocusedItemId((item.id || item._id)?.toString());
                                                    setShowDashboard(true);
                                                }
                                            }}
                                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs ${
                                                isFocusedRow 
                                                    ? "bg-indigo-600 text-white" 
                                                    : "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800"
                                            }`}
                                        >
                                            <Crosshair size={12} />
                                            <span>{isFocusedRow ? "Focused" : "Focus"}</span>
                                        </button>
                                    </div>

                                    <div className="flex gap-2">
                                        {item.shopfloorWipQty > 0 && (
                                            <>
                                                <button
                                                    onClick={() => handleOpenActionModal(item, 'return')}
                                                    className="flex-1 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200 flex items-center justify-center gap-1 cursor-pointer"
                                                    title="Return back to Main Store"
                                                >
                                                    <ArrowDownLeft size={13} /> Return
                                                </button>
                                                <button
                                                    onClick={() => handleOpenActionModal(item, 'scrap')}
                                                    className="flex-1 py-1.5 bg-rose-50 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 flex items-center justify-center gap-1 cursor-pointer"
                                                    title="Report Process Scrap"
                                                >
                                                    <Trash2 size={13} /> Scrap
                                                </button>
                                            </>
                                        )}
                                        <button
                                            onClick={() => openLedger(item)}
                                            className={`${item.shopfloorWipQty > 0 ? 'px-3' : 'w-full'} py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-300 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer`}
                                            title="View Transaction History"
                                        >
                                            <Eye size={14} /> Ledger
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        </div>
                    </div>
                )
            )}

            {/* Ledger Drawer Component */}
            {isLedgerOpen && selectedWipItem && (
                <WipLedgerDrawer
                    isOpen={isLedgerOpen}
                    onClose={() => setIsLedgerOpen(false)}
                    wipItem={selectedWipItem}
                />
            )}

            {/* WIP Action Modal (Return to Store & Scrap Write-off) */}
            {isActionModalOpen && actionModalItem && (
                <WipActionModal
                    isOpen={isActionModalOpen}
                    onClose={() => {
                        setIsActionModalOpen(false);
                        setActionModalItem(null);
                    }}
                    wipItem={actionModalItem}
                    mode={actionModalMode}
                    onSuccess={(msg) => {
                        onSuccess(msg);
                        fetchWipInventory();
                    }}
                    onError={onError}
                />
            )}
        </div>
    );
}
