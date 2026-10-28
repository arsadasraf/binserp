"use client";

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
    X, Download, Edit3, Trash2, Building2, User, Phone, Mail, Globe, 
    MapPin, CreditCard, ShieldCheck, Tag, Layers, Box, Package, 
    Calendar, CheckCircle2, AlertCircle, FileText, Printer, FileSpreadsheet,
    Eye, ExternalLink, Hash, Info, Layers3, ChevronRight, ChevronDown, ChevronsUpDown, Sparkles,
    GitFork, List, ListFilter, ArrowDownToLine, Check, FilterX, Coins, Plus, Search, Star, AlertTriangle,
    IndianRupee, Boxes
} from 'lucide-react';
import * as XLSX from 'xlsx';
import ColumnFilter from '../tables/ColumnFilter';
import { generateMasterRecordPDF } from '@/src/utils/masterPdfHelper';
import { useGetStoreDataQuery, useCreateStoreRecordMutation, useUpdateStoreRecordMutation } from '@/src/store/services/storeService';
import { usePermission } from '@/src/hooks/usePermission';
import VendorPriceListModal from './VendorPriceListModal';
import PriceListModal from './PriceListModal';
import { 
    explodeFGBOMHierarchy, 
    ExplodedBOMNode, 
    ExplodedBOMResult,
    BOMFilterType,
    consolidateBOMItems,
    ConsolidatedBOMItem,
    filterNestedBOMTree,
    matchesBOMFilter
} from '@/src/utils/bomHierarchyHelper';
import {
    enrichTreeWithPricing,
    enrichConsolidatedItemsWithPricing,
    calculateBOMCostingSummary,
    filterEnrichedTree,
    filterEnrichedConsolidated,
    PriceFilterMode,
    EnrichedExplodedBOMNode,
    EnrichedConsolidatedBOMItem
} from '@/src/utils/bomCostingHelper';

export interface MasterDetailPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: any | null;
    masterTab: 'vendor' | 'customer' | 'location' | 'category' | 'rm-bo-item' | 'fg-items' | 'fg-item' | 'materials' | string;
    onEdit?: (item: any) => void;
    onDelete?: (id: string) => void;
    companyInfo?: any;
    allFGItems?: any[];
    allRMItems?: any[];
    allBOItems?: any[];
}

export default function MasterDetailPreviewModal({
    isOpen,
    onClose,
    item,
    masterTab,
    onEdit,
    onDelete,
    companyInfo: initialCompanyInfo,
    allFGItems: initialAllFGItems,
    allRMItems: initialAllRMItems,
    allBOItems: initialAllBOItems
}: MasterDetailPreviewModalProps) {
    const { data: fetchedCompanyInfo } = useGetStoreDataQuery("company-info", { skip: !isOpen });
    const companyInfo = initialCompanyInfo || fetchedCompanyInfo;

    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

    const tabKey = (masterTab || '').toLowerCase();
    const isFG = tabKey === 'fg-items' || tabKey === 'fg-item' || tabKey === 'finished-goods';

    // FG Sub-tab state: 'overview' (default) or 'bom'
    const [activeFgTab, setActiveFgTab] = useState<'overview' | 'bom'>('overview');

    // BOM Filter state and dual view mode
    const [activeBOMFilter, setActiveBOMFilter] = useState<BOMFilterType>('ALL');
    const [bomViewMode, setBomViewMode] = useState<'tree' | 'table'>('tree');
    const [priceFilterMode, setPriceFilterMode] = useState<PriceFilterMode>('ALL');
    const [isPdfDropdownOpen, setIsPdfDropdownOpen] = useState(false);

    // Reset sub-tab and filters on open / item switch
    useEffect(() => {
        if (isOpen) {
            setActiveFgTab('overview');
            setPriceFilterMode('ALL');
            setActiveBOMFilter('ALL');
        }
    }, [isOpen, item?._id]);

    // Permissions check: User must have BOTH master and purchase access to add/edit price lists
    const { userType, hasTabAccess, isModuleAllowed } = usePermission();
    const canManagePrice = useMemo(() => {
        if (userType === 'company' || userType === 'saasadmin') return true;
        const hasMaster = hasTabAccess('store', 'masters') || hasTabAccess('store', 'fg-items') || isModuleAllowed('store');
        const hasPurchase = hasTabAccess('store', 'purchase') || hasTabAccess('store', 'vendor-price-list') || hasTabAccess('purchase', 'price-list') || isModuleAllowed('purchase');
        return Boolean(hasMaster && hasPurchase);
    }, [userType, hasTabAccess, isModuleAllowed]);

    // Fetch master item pools for BOM hierarchy explosion if FG
    const { data: fetchedFG = [] } = useGetStoreDataQuery("fg-item", { skip: !isOpen || !isFG });
    const { data: fetchedRM = [] } = useGetStoreDataQuery("raw-material", { skip: !isOpen || !isFG });
    const { data: fetchedBO = [] } = useGetStoreDataQuery("bought-out", { skip: !isOpen || !isFG });

    // Fetch vendor price lists & sales price lists for BOM costing
    const { data: fetchedVendorPriceLists = [], refetch: refetchVendorPrices } = useGetStoreDataQuery("vendor-price-list", { skip: !isOpen || !isFG });
    const { data: fetchedSalesPriceLists = [], refetch: refetchSalesPrices } = useGetStoreDataQuery("price-list", { skip: !isOpen || !isFG });
    const { data: fetchedVendors = [] } = useGetStoreDataQuery("vendor", { skip: !isOpen || !isFG });

    const [createStoreRecord] = useCreateStoreRecordMutation();
    const [updateStoreRecord] = useUpdateStoreRecordMutation();

    // Inline price creation modal states
    const [showVendorPriceModal, setShowVendorPriceModal] = useState(false);
    const [vendorPriceInitialData, setVendorPriceInitialData] = useState<any>(null);
    const [showSalesPriceModal, setShowSalesPriceModal] = useState(false);
    const [salesPriceInitialData, setSalesPriceInitialData] = useState<any>(null);
    const [priceSaveNotice, setPriceSaveNotice] = useState<string | null>(null);

    const fgList = initialAllFGItems || fetchedFG || [];
    const rmList = initialAllRMItems || fetchedRM || [];
    const boList = initialAllBOItems || fetchedBO || [];

    // Explode multi-level nested BOM hierarchy recursively
    const explodedBOM: ExplodedBOMResult | null = useMemo(() => {
        if (!isFG || !item) return null;
        return explodeFGBOMHierarchy(item, fgList, rmList, boList);
    }, [isFG, item, fgList, rmList, boList]);

    // 1. Enrich raw tree and consolidated items with Vendor & Sales price lists
    const enrichedConsolidated = useMemo(() => {
        if (!explodedBOM) return [];
        const base = consolidateBOMItems(explodedBOM.flatTree, activeBOMFilter);
        return enrichConsolidatedItemsWithPricing(base, fetchedVendorPriceLists, fetchedSalesPriceLists, fgList);
    }, [explodedBOM, activeBOMFilter, fetchedVendorPriceLists, fetchedSalesPriceLists, fgList]);

    const enrichedNestedTree = useMemo(() => {
        if (!explodedBOM) return [];
        const base = filterNestedBOMTree(explodedBOM.nestedTree, activeBOMFilter);
        return enrichTreeWithPricing(base, fetchedVendorPriceLists, fetchedSalesPriceLists, fgList);
    }, [explodedBOM, activeBOMFilter, fetchedVendorPriceLists, fetchedSalesPriceLists, fgList]);

    const enrichedFlatTree = useMemo(() => {
        if (!explodedBOM) return [];
        const filteredFlat = explodedBOM.flatTree.filter(n => matchesBOMFilter(n, activeBOMFilter));
        return enrichTreeWithPricing(filteredFlat, fetchedVendorPriceLists, fetchedSalesPriceLists, fgList);
    }, [explodedBOM, activeBOMFilter, fetchedVendorPriceLists, fetchedSalesPriceLists, fgList]);

    // 2. Apply Price Filter Mode (All / Priced Only / Missing Price Only)
    const priceFilteredConsolidated = useMemo(() => {
        return filterEnrichedConsolidated(enrichedConsolidated, priceFilterMode);
    }, [enrichedConsolidated, priceFilterMode]);

    const priceFilteredNestedTree = useMemo(() => {
        return filterEnrichedTree(enrichedNestedTree, priceFilterMode);
    }, [enrichedNestedTree, priceFilterMode]);

    const priceFilteredFlatTree = useMemo(() => {
        return filterEnrichedTree(enrichedFlatTree, priceFilterMode);
    }, [enrichedFlatTree, priceFilterMode]);

    // 3. Dynamic Costing & Quantity Dashboard Summary
    const costingSummary = useMemo(() => {
        return calculateBOMCostingSummary(priceFilteredFlatTree, priceFilteredConsolidated);
    }, [priceFilteredFlatTree, priceFilteredConsolidated]);

    // Excel-style column filters state for BOM Workbench
    const [colFilterMaterialName, setColFilterMaterialName] = useState<string[]>([]);
    const [colFilterSubCategory, setColFilterSubCategory] = useState<string[]>([]);
    const [colFilterClassification, setColFilterClassification] = useState<string[]>([]);
    const [colFilterLevel, setColFilterLevel] = useState<string[]>([]);
    const [tableSortConfig, setTableSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    const handleSortChange = (key: string, direction: 'asc' | 'desc') => {
        setTableSortConfig({ key, direction });
    };

    const handleClearAllFilters = () => {
        setColFilterMaterialName([]);
        setColFilterSubCategory([]);
        setColFilterClassification([]);
        setColFilterLevel([]);
        setTableSortConfig(null);
        setPriceFilterMode('ALL');
    };

    const hasActiveFilters = colFilterMaterialName.length > 0 || colFilterSubCategory.length > 0 || colFilterClassification.length > 0 || colFilterLevel.length > 0 || priceFilterMode !== 'ALL';

    const getNormalizedClassification = useCallback((itemType: string): string => {
        if (itemType === 'SubAssembly') return 'Sub-Assembly';
        if (itemType === 'Assembly') return 'Assembly';
        if (itemType === 'Component') return 'Component';
        if (itemType === 'BO') return 'Bought Out';
        return 'Raw Material';
    }, []);

    // Filter and sort for Consolidated View
    const finalDisplayConsolidated = useMemo(() => {
        let items = priceFilteredConsolidated.filter((cItem) => {
            if (colFilterMaterialName.length > 0 && !colFilterMaterialName.includes(cItem.materialName)) return false;
            if (colFilterSubCategory.length > 0 && !colFilterSubCategory.includes(cItem.subCategory || '-')) return false;
            if (colFilterClassification.length > 0) {
                const cls = getNormalizedClassification(cItem.itemType);
                if (!colFilterClassification.includes(cls)) return false;
            }
            return true;
        });

        if (tableSortConfig) {
            const { key, direction } = tableSortConfig;
            items = [...items].sort((a, b) => {
                let valA: any = '';
                let valB: any = '';
                if (key === 'materialName') { valA = a.materialName; valB = b.materialName; }
                else if (key === 'subCategory') { valA = a.subCategory || '-'; valB = b.subCategory || '-'; }
                else if (key === 'classification') { valA = getNormalizedClassification(a.itemType); valB = getNormalizedClassification(b.itemType); }
                else if (key === 'totalQty') { valA = a.totalCumulativeQuantity; valB = b.totalCumulativeQuantity; }
                else if (key === 'unitPrice') { valA = a.priceInfo?.unitPrice || 0; valB = b.priceInfo?.unitPrice || 0; }
                else if (key === 'extendedCost') { valA = a.priceInfo?.extendedCost || 0; valB = b.priceInfo?.extendedCost || 0; }
                if (typeof valA === 'number' && typeof valB === 'number') {
                    return direction === 'asc' ? valA - valB : valB - valA;
                }
                return direction === 'asc' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
            });
        }
        return items;
    }, [priceFilteredConsolidated, colFilterMaterialName, colFilterSubCategory, colFilterClassification, tableSortConfig, getNormalizedClassification]);

    // Filter and sort for Multi-Level Nested Tree View
    const matchesExcelFiltersForNode = useCallback((node: EnrichedExplodedBOMNode): boolean => {
        if (colFilterMaterialName.length > 0 && !colFilterMaterialName.includes(node.materialName)) return false;
        if (colFilterSubCategory.length > 0 && !colFilterSubCategory.includes(node.subCategory || '-')) return false;
        if (colFilterClassification.length > 0) {
            const cls = getNormalizedClassification(node.itemType);
            if (!colFilterClassification.includes(cls)) return false;
        }
        if (colFilterLevel.length > 0 && !colFilterLevel.includes(`L${node.level}`)) return false;
        return true;
    }, [colFilterMaterialName, colFilterSubCategory, colFilterClassification, colFilterLevel, getNormalizedClassification]);

    const filterTreeByExcel = useCallback((nodes: EnrichedExplodedBOMNode[]): EnrichedExplodedBOMNode[] => {
        if (!hasActiveFilters && priceFilterMode === 'ALL') return nodes;
        const result: EnrichedExplodedBOMNode[] = [];
        nodes.forEach(node => {
            const isSelfMatch = matchesExcelFiltersForNode(node);
            const filteredChildren = filterTreeByExcel(node.children || []);
            if (isSelfMatch || filteredChildren.length > 0) {
                result.push({
                    ...node,
                    children: filteredChildren,
                    hasChildren: filteredChildren.length > 0
                });
            }
        });
        return result;
    }, [hasActiveFilters, priceFilterMode, matchesExcelFiltersForNode]);

    const finalDisplayTree = useMemo(() => {
        return filterTreeByExcel(priceFilteredNestedTree);
    }, [priceFilteredNestedTree, filterTreeByExcel]);

    // Tree collapse state for parent sub-assemblies
    const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());

    const toggleCollapse = (key: string) => {
        setCollapsedKeys(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const handleExpandAll = () => {
        setCollapsedKeys(new Set());
    };

    const handleCollapseAll = () => {
        if (!explodedBOM) return;
        const parentKeys = new Set<string>();
        explodedBOM.flatTree.forEach(node => {
            if (node.hasChildren) parentKeys.add(node.key);
        });
        setCollapsedKeys(parentKeys);
    };

    // Open add price modal
    const handleOpenAddPrice = useCallback((nodeOrItem: any) => {
        const isFGType = nodeOrItem.itemType === 'SubAssembly' || nodeOrItem.itemType === 'Assembly' || nodeOrItem.itemType === 'Component';
        if (isFGType) {
            setSalesPriceInitialData({
                fgItem: nodeOrItem.id,
                price: nodeOrItem.priceInfo?.unitPrice || '',
                _id: nodeOrItem.priceInfo?.priceListId
            });
            setShowSalesPriceModal(true);
        } else {
            setVendorPriceInitialData({
                material: nodeOrItem.id,
                itemCategory: nodeOrItem.itemType === 'BO' ? 'bo' : 'rm',
                price: nodeOrItem.priceInfo?.unitPrice || '',
                isPreferred: Boolean(nodeOrItem.priceInfo?.isPreferredVendor),
                _id: nodeOrItem.priceInfo?.priceListId
            });
            setShowVendorPriceModal(true);
        }
    }, []);

    const handleSaveVendorPrice = async (formData: any) => {
        try {
            if (vendorPriceInitialData?._id) {
                await updateStoreRecord({ tab: "vendor-price-list", id: vendorPriceInitialData._id, body: formData }).unwrap();
            } else {
                await createStoreRecord({ tab: "vendor-price-list", body: formData }).unwrap();
            }
            setShowVendorPriceModal(false);
            setVendorPriceInitialData(null);
            refetchVendorPrices();
            setPriceSaveNotice("Vendor price list saved successfully.");
            setTimeout(() => setPriceSaveNotice(null), 4000);
        } catch (err: any) {
            throw err;
        }
    };

    const handleSaveSalesPrice = async (formData: any) => {
        try {
            await createStoreRecord({ tab: "price-list", body: formData }).unwrap();
            setShowSalesPriceModal(false);
            setSalesPriceInitialData(null);
            refetchSalesPrices();
            setPriceSaveNotice("Sales price list entry updated successfully.");
            setTimeout(() => setPriceSaveNotice(null), 4000);
        } catch (err: any) {
            throw err;
        }
    };

    if (!isOpen || !item) return null;

    // Determine color schemes and icons per master type
    let theme = {
        title: 'Master Record Preview',
        subtitle: 'Store Master Information Sheet',
        badge: 'Master Record',
        headerGradient: 'from-slate-900 via-slate-800 to-slate-950',
        borderColor: 'border-slate-700',
        badgeBg: 'bg-slate-500/20 text-slate-300 border-slate-400/30',
        icon: Building2,
        accentColor: 'text-slate-400',
        btnBg: 'bg-slate-700 hover:bg-slate-600',
    };

    if (tabKey === 'vendor' || tabKey === 'vendors') {
        theme = {
            title: item.name || 'Vendor Details',
            subtitle: `Vendor Code: ${item.code || 'N/A'} • ${item.vendorType || 'Rm Vendor'}`,
            badge: item.vendorType || 'Vendor',
            headerGradient: 'from-emerald-950 via-teal-900 to-emerald-900',
            borderColor: 'border-emerald-700',
            badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
            icon: Building2,
            accentColor: 'text-emerald-400',
            btnBg: 'bg-emerald-600 hover:bg-emerald-700',
        };
    } else if (tabKey === 'customer' || tabKey === 'customers') {
        theme = {
            title: item.name || 'Customer Details',
            subtitle: `Customer Code: ${item.code || 'N/A'} • ${item.customerType || 'Manufacturing Sales'}`,
            badge: item.customerType || 'Customer',
            headerGradient: 'from-indigo-950 via-blue-900 to-indigo-900',
            borderColor: 'border-indigo-700',
            badgeBg: 'bg-indigo-500/20 text-indigo-300 border-indigo-400/30',
            icon: User,
            accentColor: 'text-indigo-400',
            btnBg: 'bg-indigo-600 hover:bg-indigo-700',
        };
    } else if (tabKey === 'bought-out' || tabKey === 'bought-outs' || tabKey === 'bo-item' || tabKey === 'bo-items') {
        const cat = typeof item.categoryId === 'object' ? item.categoryId?.name : item.category;
        theme = {
            title: item.name || item.materialName || 'Bought Out Item Details',
            subtitle: `Item Code: ${item.code || item.materialCode || 'N/A'} • Category: ${cat || 'Bought Out'}`,
            badge: 'Bought Out',
            headerGradient: 'from-amber-950 via-yellow-900 to-amber-900',
            borderColor: 'border-amber-700',
            badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
            icon: Box,
            accentColor: 'text-amber-400',
            btnBg: 'bg-amber-600 hover:bg-amber-700',
        };
    } else if (tabKey === 'raw-material' || tabKey === 'raw-materials' || tabKey === 'rm-item' || tabKey === 'rm-items' || tabKey === 'rm-bo-item' || tabKey === 'materials' || tabKey === 'rm-bo') {
        const cat = typeof item.categoryId === 'object' ? item.categoryId?.name : item.category;
        theme = {
            title: item.name || item.materialName || 'Raw Material Details',
            subtitle: `Item Code: ${item.code || item.materialCode || 'N/A'} • Category: ${cat || 'Raw Material'}`,
            badge: item.itemType || cat || 'Raw Material',
            headerGradient: 'from-blue-950 via-indigo-900 to-blue-900',
            borderColor: 'border-blue-700',
            badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
            icon: Box,
            accentColor: 'text-blue-400',
            btnBg: 'bg-blue-600 hover:bg-blue-700',
        };
    } else if (tabKey === 'consumable-item' || tabKey === 'consumables' || tabKey === 'consumable') {
        const cat = typeof item.categoryId === 'object' ? item.categoryId?.name : item.category;
        theme = {
            title: item.name || 'Consumable Item Details',
            subtitle: `Consumable Code: ${item.code || 'N/A'} • Category: ${cat || 'Consumables'}`,
            badge: cat || 'Consumable',
            headerGradient: 'from-teal-950 via-emerald-900 to-teal-900',
            borderColor: 'border-teal-700',
            badgeBg: 'bg-teal-500/20 text-teal-300 border-teal-400/30',
            icon: Box,
            accentColor: 'text-teal-400',
            btnBg: 'bg-teal-600 hover:bg-teal-700',
        };
    } else if (tabKey === 'fg-items' || tabKey === 'fg-item' || tabKey === 'finished-goods') {
        const cat = typeof item.category === 'object' ? item.category?.name : (typeof item.categoryId === 'object' ? item.categoryId?.name : (item.category || item.categoryId || ''));
        theme = {
            title: item.name || item.productName || 'Finished Goods Details',
            subtitle: `FG Code: ${item.code || item.productCode || 'N/A'}${cat ? ` • Category: ${cat}` : ''} • Type: ${item.type || 'Assembly'}`,
            badge: item.type || 'Assembly',
            headerGradient: 'from-purple-950 via-violet-900 to-purple-900',
            borderColor: 'border-purple-700',
            badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-400/30',
            icon: Layers,
            accentColor: 'text-purple-400',
            btnBg: 'bg-purple-600 hover:bg-purple-700',
        };
    } else if (tabKey === 'location' || tabKey === 'locations') {
        theme = {
            title: item.name || 'Storage Location',
            subtitle: `Location Code: ${item.code || 'N/A'} • Type: ${item.type || 'Rack'}`,
            badge: item.type || 'Location',
            headerGradient: 'from-cyan-950 via-sky-900 to-cyan-900',
            borderColor: 'border-sky-700',
            badgeBg: 'bg-sky-500/20 text-sky-300 border-sky-400/30',
            icon: MapPin,
            accentColor: 'text-sky-400',
            btnBg: 'bg-sky-600 hover:bg-sky-700',
        };
    } else if (tabKey === 'category' || tabKey === 'categories') {
        theme = {
            title: item.name || 'Category Specification',
            subtitle: `Category Code: ${item.code || 'N/A'} • Default Unit: ${item.unit || 'PCS'}`,
            badge: item.unit || 'Category',
            headerGradient: 'from-amber-950 via-orange-900 to-amber-900',
            borderColor: 'border-amber-700',
            badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
            icon: Tag,
            accentColor: 'text-amber-400',
            btnBg: 'bg-amber-600 hover:bg-amber-700',
        };
    }

    const Icon = theme.icon;

    const handleDownloadPDF = (filterType: BOMFilterType = activeBOMFilter) => {
        setIsPdfDropdownOpen(false);
        generateMasterRecordPDF({ 
            masterTab, 
            item, 
            companyInfo,
            allFGItems: fgList,
            allRMItems: rmList,
            allBOItems: boList,
            explodedBOM: explodedBOM || undefined,
            bomFilterType: filterType,
            customConsolidatedItems: finalDisplayConsolidated,
            customExplodedNodes: finalDisplayTree
        });
    };

    const handleExportExcel = () => {
        if (!explodedBOM || !item) return;
        const wb = XLSX.utils.book_new();
        const cleanFgName = item.name || 'Finished-Good';

        // Sheet 1: Active Multi-Level BOM Tree
        const treeData: any[] = [];
        const traverseForExcel = (nodes: EnrichedExplodedBOMNode[]) => {
            nodes.forEach(n => {
                const indent = n.level > 2 ? '  '.repeat(n.level - 2) + '↳ ' : '';
                const hasPr = n.priceInfo?.hasPrice;
                const isUnderPriced = n.priceInfo?.underPricedSubAssembly;

                let costingStatus = 'Missing Rate';
                if (isUnderPriced) costingStatus = 'Included in Parent Sub-Assy';
                else if (hasPr) costingStatus = 'Configured';

                treeData.push({
                    'Level': `L${n.level}`,
                    'Parent FG / Assy': n.parentName || cleanFgName,
                    'Item Name': `${indent}${n.materialName}`,
                    'Technical Description': n.description || '-',
                    'Subcategory': n.subCategory || '-',
                    'Classification': getNormalizedClassification(n.itemType),
                    'Unit': n.unit || 'Nos',
                    'Qty / Parent': n.quantityPerParent,
                    'Cumulative Qty': n.cumulativeQuantity,
                    'Unit Rate (INR)': hasPr ? n.priceInfo.unitPrice : '-',
                    'Vendor / Source': n.priceInfo?.vendorName || '-',
                    'Extended Cost (INR)': hasPr ? n.priceInfo.extendedCost : 0,
                    'Costing Status': costingStatus,
                    'Sec Qty / Parent': n.secondaryQuantityPerParent || '-',
                    'Sec Cumulative Qty': n.secondaryCumulativeQuantity || '-',
                    'Sec Unit': n.secondaryUnit || '-'
                });
                if (n.children && n.children.length > 0) {
                    traverseForExcel(n.children);
                }
            });
        };
        traverseForExcel(finalDisplayTree);
        const wsTree = XLSX.utils.json_to_sheet(treeData);
        XLSX.utils.book_append_sheet(wb, wsTree, 'Multi-Level BOM Tree');

        // Sheet 2: Consolidated Summary
        const summaryData = finalDisplayConsolidated.map((c, i) => ({
            '#': i + 1,
            'Item Name': c.materialName,
            'Technical Description': c.description || '-',
            'Subcategory': c.subCategory || '-',
            'Classification': getNormalizedClassification(c.itemType),
            'Total Required Qty (1 FG)': `${c.totalCumulativeQuantity} ${c.unit}`,
            'Unit Rate (INR)': c.priceInfo?.hasPrice ? c.priceInfo.unitPrice : '-',
            'Vendor / Source': c.priceInfo?.vendorName || '-',
            'Total Extended Cost (INR)': c.priceInfo?.hasPrice ? c.priceInfo.extendedCost : 0,
            'Price Status': c.priceInfo?.hasPrice ? 'Configured' : 'Missing Rate',
            'Secondary Total Qty': c.totalSecondaryCumulativeQuantity ? `${c.totalSecondaryCumulativeQuantity} ${c.secondaryUnit || ''}` : '-',
            'Parent Usages': (c.usages || []).map(u => `${u.parentName}: ${u.quantityPerParent} ${u.unit}`).join('; ')
        }));
        const wsSummary = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Consolidated Requirements');

        const filename = `${cleanFgName.replace(/[^a-zA-Z0-9_-]/g, '_')}_BOM_${activeBOMFilter}_${priceFilterMode}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, filename);
    };

    const getDownloadButtonLabel = () => {
        if (!isFG) return "Download PDF";
        switch (activeBOMFilter) {
            case 'RM': return 'Download RM PDF';
            case 'BO': return 'Download BO PDF';
            case 'COMPONENT': return 'Download Component PDF';
            case 'SUBASSEMBLY': return 'Download Sub-Assy PDF';
            default: return 'Download Full BOM PDF';
        }
    };

    return (
        <div className={`fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 ${isFG ? 'lg:p-6 xl:p-8' : 'sm:p-6'} bg-slate-950/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200`}>
            <div className={`bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full ${isFG ? 'max-w-6xl xl:max-w-7xl 2xl:max-w-[1536px]' : 'max-w-4xl'} my-auto overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[94vh] transition-all duration-300`}>
                
                {/* Modal Header */}
                <div className={`p-5 sm:p-6 bg-gradient-to-r ${theme.headerGradient} text-white flex justify-between items-center flex-shrink-0 border-b ${theme.borderColor}`}>
                    <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 shadow-inner shrink-0">
                            <Icon className="w-6 h-6 text-white" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h2 className="text-xl font-extrabold tracking-tight text-white truncate max-w-md lg:max-w-xl xl:max-w-2xl">
                                    {theme.title}
                                </h2>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider border ${theme.badgeBg}`}>
                                    {theme.badge}
                                </span>
                            </div>
                            <p className="text-xs text-slate-300 mt-0.5 truncate">
                                {theme.subtitle}
                            </p>
                        </div>
                    </div>

                    {/* Header Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0 relative">
                        {isFG ? (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleExportExcel}
                                    className="px-3 py-2 bg-emerald-600/90 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 border border-white/20 hover:scale-105 active:scale-95 cursor-pointer"
                                    title="Export BOM to Excel (.xlsx) with current filters"
                                >
                                    <FileSpreadsheet size={15} />
                                    <span className="hidden sm:inline">Export Excel</span>
                                </button>
                                <div className="relative flex items-center">
                                    <button
                                        onClick={() => handleDownloadPDF(activeBOMFilter)}
                                        className={`px-3.5 py-2 ${theme.btnBg} text-white text-xs font-bold rounded-l-xl transition-all shadow-md flex items-center gap-1.5 border border-white/20 hover:brightness-110 active:scale-95 cursor-pointer`}
                                        title="Generate & Download Printable PDF for current view"
                                    >
                                        <Download size={15} />
                                        <span className="hidden sm:inline">{getDownloadButtonLabel()}</span>
                                        <span className="sm:hidden">PDF</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsPdfDropdownOpen(!isPdfDropdownOpen)}
                                        className={`px-2 py-2 ${theme.btnBg} text-white text-xs font-bold rounded-r-xl transition-all shadow-md flex items-center border-y border-r border-white/20 border-l border-white/10 hover:brightness-110 cursor-pointer`}
                                        title="Choose specific BOM category PDF to download"
                                    >
                                        <ChevronDown size={14} className={`transition-transform duration-200 ${isPdfDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {/* PDF Dropdown Menu */}
                                    {isPdfDropdownOpen && (
                                        <div className="absolute right-0 top-full mt-1.5 w-60 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 py-1.5 z-[210] animate-in fade-in slide-in-from-top-1 text-slate-800 dark:text-slate-100">
                                            <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                                Export Specification PDF
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleDownloadPDF('ALL')}
                                                className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-purple-50 dark:hover:bg-purple-950/40 flex items-center justify-between text-slate-700 dark:text-slate-200 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                                            >
                                                <span className="flex items-center gap-2">
                                                    <Layers3 size={14} className="text-purple-500" />
                                                    <span>Full Multi-Level BOM</span>
                                                </span>
                                                {activeBOMFilter === 'ALL' && <Check size={13} className="text-purple-600" />}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDownloadPDF('RM')}
                                                className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center justify-between text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                            >
                                                <span className="flex items-center gap-2">
                                                    <Box size={14} className="text-blue-500" />
                                                    <span>Raw Materials (RM)</span>
                                                </span>
                                                {activeBOMFilter === 'RM' && <Check size={13} className="text-blue-600" />}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDownloadPDF('BO')}
                                                className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-amber-50 dark:hover:bg-amber-950/40 flex items-center justify-between text-slate-700 dark:text-slate-200 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                                            >
                                                <span className="flex items-center gap-2">
                                                    <Package size={14} className="text-amber-500" />
                                                    <span>Bought Out (BO) Items</span>
                                                </span>
                                                {activeBOMFilter === 'BO' && <Check size={13} className="text-amber-600" />}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDownloadPDF('COMPONENT')}
                                                className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-sky-50 dark:hover:bg-sky-950/40 flex items-center justify-between text-slate-700 dark:text-slate-200 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                                            >
                                                <span className="flex items-center gap-2">
                                                    <Layers size={14} className="text-sky-500" />
                                                    <span>In-House Components</span>
                                                </span>
                                                {activeBOMFilter === 'COMPONENT' && <Check size={13} className="text-sky-600" />}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDownloadPDF('SUBASSEMBLY')}
                                                className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center justify-between text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                            >
                                                <span className="flex items-center gap-2">
                                                    <GitFork size={14} className="text-indigo-500" />
                                                    <span>Sub-Assemblies</span>
                                                </span>
                                                {activeBOMFilter === 'SUBASSEMBLY' && <Check size={13} className="text-indigo-600" />}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => handleDownloadPDF()}
                                className={`px-3.5 py-2 ${theme.btnBg} text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 border border-white/20 hover:scale-105 active:scale-95`}
                                title="Generate & Download Printable PDF Specification Sheet"
                            >
                                <Download size={15} />
                                <span className="hidden sm:inline">Download PDF</span>
                            </button>
                        )}

                        {onEdit && (
                            <button
                                onClick={() => {
                                    onClose();
                                    onEdit(item);
                                }}
                                className="px-3 py-2 bg-white/15 hover:bg-white/25 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 border border-white/20"
                                title="Edit this record"
                            >
                                <Edit3 size={15} />
                                <span className="hidden sm:inline">Edit</span>
                            </button>
                        )}

                        <button
                            onClick={onClose}
                            className="w-9 h-9 rounded-full bg-black/30 hover:bg-black/50 transition-all flex items-center justify-center text-white border border-white/20"
                            title="Close preview"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Modal Body */}
                <div className="p-6 sm:p-7 overflow-y-auto flex-1 space-y-6">
                    
                    {/* VENDOR & CUSTOMER VIEW */}
                    {(tabKey === 'vendor' || tabKey === 'vendors' || tabKey === 'customer' || tabKey === 'customers') && (
                        <div className="space-y-6">
                            {/* Grid 1: Basic & Contact Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Card 1: Core Information */}
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        <Building2 size={14} className={theme.accentColor} /> Identification & Category
                                    </div>
                                    <div className="space-y-2 text-xs">
                                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                            <span className="text-slate-500 dark:text-slate-400">Name:</span>
                                            <span className="font-extrabold text-slate-900 dark:text-white">{item.name || '-'}</span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                            <span className="text-slate-500 dark:text-slate-400">Code:</span>
                                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{item.code || '-'}</span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                            <span className="text-slate-500 dark:text-slate-400">Type / Classification:</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">{item.vendorType || item.customerType || '-'}</span>
                                        </div>
                                        <div className="flex justify-between py-1">
                                            <span className="text-slate-500 dark:text-slate-400">Registration Status:</span>
                                            <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold rounded-md text-[11px]">
                                                Active
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Card 2: Contact Communication */}
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        <User size={14} className={theme.accentColor} /> Contact & Communication
                                    </div>
                                    <div className="space-y-2 text-xs">
                                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                            <span className="text-slate-500 dark:text-slate-400">Contact Person:</span>
                                            <span className="font-bold text-slate-900 dark:text-white">{item.contactPerson || '-'}</span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                            <span className="text-slate-500 dark:text-slate-400">Phone Number:</span>
                                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{item.phone || '-'}</span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                            <span className="text-slate-500 dark:text-slate-400">Email Address:</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">{item.email || '-'}</span>
                                        </div>
                                        <div className="flex justify-between py-1">
                                            <span className="text-slate-500 dark:text-slate-400">Website:</span>
                                            <span className="text-slate-700 dark:text-slate-300">{item.website || '-'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Grid 2: Tax & Addresses */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Card 3: Tax & Legal Identifiers */}
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        <ShieldCheck size={14} className={theme.accentColor} /> Tax & Regulatory Identifiers
                                    </div>
                                    <div className="space-y-2 text-xs">
                                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                            <span className="text-slate-500 dark:text-slate-400">GSTIN / Tax No:</span>
                                            <span className="font-mono font-bold text-slate-900 dark:text-white bg-slate-200/60 dark:bg-slate-700 px-2 py-0.5 rounded">
                                                {item.gst || item.gstNumber || '-'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-1">
                                            <span className="text-slate-500 dark:text-slate-400">PAN Number:</span>
                                            <span className="font-mono font-bold text-slate-900 dark:text-white bg-slate-200/60 dark:bg-slate-700 px-2 py-0.5 rounded">
                                                {item.pan || '-'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Card 4: Banking Details */}
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        <CreditCard size={14} className={theme.accentColor} /> Banking & Payment Details
                                    </div>
                                    <div className="space-y-2 text-xs">
                                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                            <span className="text-slate-500 dark:text-slate-400">Bank Name:</span>
                                            <span className="font-bold text-slate-900 dark:text-white">{item.bankDetails?.bankName || '-'}</span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                            <span className="text-slate-500 dark:text-slate-400">Account Number:</span>
                                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{item.bankDetails?.accountNumber || '-'}</span>
                                        </div>
                                        <div className="flex justify-between py-1">
                                            <span className="text-slate-500 dark:text-slate-400">IFSC Code:</span>
                                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{item.bankDetails?.ifscCode || '-'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Card 5: Full Address Details */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    <MapPin size={14} className={theme.accentColor} /> Address Locations
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                    <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                                        <strong className="text-slate-900 dark:text-white block text-[11px] uppercase tracking-wider">Billing / Registered Address</strong>
                                        <p className="text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                                            {item.billingAddress || item.address || 'No address provided'}
                                        </p>
                                        <div className="pt-2 text-[11px] text-slate-500 border-t border-slate-100 dark:border-slate-700">
                                            <b>City/State:</b> {item.billingCity || item.city || '-'}, {item.billingState || item.state || '-'} ({item.billingPincode || item.pincode || '-'})
                                        </div>
                                    </div>

                                    <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                                        <strong className="text-slate-900 dark:text-white block text-[11px] uppercase tracking-wider">Shipping / Delivery Address</strong>
                                        <p className="text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                                            {item.shippingAddress || item.address || 'Same as billing address'}
                                        </p>
                                        <div className="pt-2 text-[11px] text-slate-500 border-t border-slate-100 dark:border-slate-700">
                                            <b>City/State:</b> {item.shippingCity || item.city || '-'}, {item.shippingState || item.state || '-'} ({item.shippingPincode || item.pincode || '-'})
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* RM/BO & CONSUMABLE ITEM VIEW */}
                    {(
                        tabKey === 'raw-material' || tabKey === 'raw-materials' || tabKey === 'rm-item' || tabKey === 'rm-items' ||
                        tabKey === 'bought-out' || tabKey === 'bought-outs' || tabKey === 'bo-item' || tabKey === 'bo-items' ||
                        tabKey === 'rm-bo-item' || tabKey === 'materials' || tabKey === 'material' || tabKey === 'rm-bo' ||
                        tabKey === 'consumable-item' || tabKey === 'consumables' || tabKey === 'consumable'
                    ) && (
                        <div className="space-y-6">
                            {/* Grid 1: Core Specifications */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        <Box size={14} className={theme.accentColor} /> Item Specifications
                                    </div>
                                    <div className="space-y-2 text-xs">
                                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                            <span className="text-slate-500 dark:text-slate-400">Item Name:</span>
                                            <span className="font-extrabold text-slate-900 dark:text-white">{item.name || item.materialName || '-'}</span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                            <span className="text-slate-500 dark:text-slate-400">Item Code:</span>
                                            <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{item.code || item.materialCode || '-'}</span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                            <span className="text-slate-500 dark:text-slate-400">Category:</span>
                                            <span className="font-bold text-slate-900 dark:text-white">
                                                {typeof item.categoryId === 'object' ? item.categoryId?.name : (item.category || '-')}
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-1">
                                            <span className="text-slate-500 dark:text-slate-400">Primary Unit:</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">
                                                {item.unit || 'PCS'}
                                            </span>
                                        </div>
                                        {item.hasSecondaryUnit && item.secondaryUnit && (
                                            <>
                                                <div className="flex justify-between py-1 border-t border-slate-200/60 dark:border-slate-700/60">
                                                    <span className="text-slate-500 dark:text-slate-400">Secondary Unit:</span>
                                                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                                        {item.secondaryUnit}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between py-1 border-t border-slate-200/60 dark:border-slate-700/60">
                                                    <span className="text-slate-500 dark:text-slate-400">Conversion Ratio:</span>
                                                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                                        1 {item.unit || 'Unit'} = {item.conversionFactor ?? 1} {item.secondaryUnit}
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        <MapPin size={14} className={theme.accentColor} /> Storage & Stock Limits
                                    </div>
                                    <div className="space-y-2 text-xs">
                                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                            <span className="text-slate-500 dark:text-slate-400">Minimum Stock (Safety):</span>
                                            <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                                                {item.minimumStock ?? item.minStock ?? 0} {item.unit || 'PCS'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                            <span className="text-slate-500 dark:text-slate-400">Storage Location:</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">
                                                {typeof item.locationId === 'object' ? item.locationId?.name : (typeof item.location === 'object' ? item.location?.name : (item.storageLocation || item.location || '-'))}
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                            <span className="text-slate-500 dark:text-slate-400">HSN Code:</span>
                                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                                {item.hsnCode || '-'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-1">
                                            <span className="text-slate-500 dark:text-slate-400">Standard Rate:</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">{item.rate ? `₹ ${item.rate}` : '-'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Photos / Attachments */}
                            {item.photos && item.photos.length > 0 && (
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        <Eye size={14} className={theme.accentColor} /> Attached Photos & Documents
                                    </div>
                                    <div className="flex flex-wrap gap-4">
                                        {item.photos.map((photo: any, idx: number) => {
                                            const photoUrl = typeof photo === 'string' ? photo : '';
                                            const isPdf = photoUrl.toLowerCase().includes('.pdf');
                                            return (
                                                <div 
                                                    key={idx} 
                                                    onClick={() => window.open(photoUrl, '_blank')}
                                                    className="w-32 h-32 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden relative cursor-pointer hover:border-indigo-500 group shadow-sm flex flex-col items-center justify-center p-2"
                                                >
                                                    {isPdf ? (
                                                        <div className="text-center">
                                                            <FileText size={32} className="text-red-500 mx-auto mb-1" />
                                                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">View PDF</span>
                                                        </div>
                                                    ) : (
                                                        <img src={photoUrl} alt="Item Attachment" className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform" />
                                                    )}
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                                                        <ExternalLink size={14} /> Open
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Description */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2">
                                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Description & Technical Details</span>
                                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                                    {item.descriptions || item.description || 'No additional technical specifications provided.'}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* FINISHED GOODS (FG ITEM) VIEW */}
                    {(tabKey === 'fg-items' || tabKey === 'fg-item' || tabKey === 'finished-goods') && (
                        <div className="space-y-6">
                            {/* Segmented Floating Pill Sub-Tab Navigation (Rule 7 Standard) */}
                            <div className="flex overflow-x-auto max-w-full no-scrollbar bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs gap-1.5 scroll-smooth shrink-0 w-fit">
                                <button
                                    type="button"
                                    onClick={() => setActiveFgTab('overview')}
                                    className={`flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 whitespace-nowrap shrink-0 active:scale-95 cursor-pointer ${
                                        activeFgTab === 'overview'
                                            ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm shadow-indigo-500/25'
                                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                                    }`}
                                >
                                    <Info size={15} className={activeFgTab === 'overview' ? 'text-white' : 'text-slate-500 dark:text-slate-400'} />
                                    <span>Basic Details</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveFgTab('bom')}
                                    className={`flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 whitespace-nowrap shrink-0 active:scale-95 cursor-pointer ${
                                        activeFgTab === 'bom'
                                            ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm shadow-indigo-500/25'
                                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                                    }`}
                                >
                                    <Layers3 size={15} className={activeFgTab === 'bom' ? 'text-white' : 'text-slate-500 dark:text-slate-400'} />
                                    <span>BOM Breakdown & Costing</span>
                                    {explodedBOM && (
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                                            activeFgTab === 'bom' ? 'bg-white/20 text-white font-extrabold' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                        }`}>
                                            {explodedBOM.summary.totalItemCount} Items
                                        </span>
                                    )}
                                </button>
                            </div>

                            {/* TAB 1: BASIC DETAILS OVERVIEW */}
                            {activeFgTab === 'overview' && (
                                <div className="space-y-6">
                                    {/* Master Summary Bar */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
                                            <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Assembly Type</div>
                                            <div className="text-sm font-extrabold font-mono text-purple-600 dark:text-purple-400 mt-1">
                                                {item.type || item.category || 'Component'}
                                            </div>
                                        </div>

                                        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
                                            <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Units of Measure</div>
                                            <div className="text-sm font-extrabold font-mono text-slate-900 dark:text-white mt-1">
                                                {item.unit || 'Nos'}
                                            </div>
                                            {item.hasSecondaryUnit && item.secondaryUnit && (
                                                <div className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 mt-0.5">
                                                    1 {item.unit || 'Unit'} = {item.conversionFactor ?? 1} {item.secondaryUnit}
                                                </div>
                                            )}
                                        </div>

                                        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
                                            <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Storage Location</div>
                                            <div className="text-sm font-extrabold text-slate-800 dark:text-slate-200 mt-1 truncate">
                                                {typeof item.location === 'object' ? item.location?.name : (typeof item.locationId === 'object' ? item.locationId?.name : (item.location || '-'))}
                                            </div>
                                        </div>

                                        <div 
                                            onClick={() => setActiveFgTab('bom')}
                                            className="p-4 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100/70 dark:hover:bg-amber-900/50 rounded-2xl border border-amber-200 dark:border-amber-900/50 text-center cursor-pointer transition-all group"
                                            title="Click to view full BOM Breakdown & Costing"
                                        >
                                            <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center justify-center gap-1">
                                                <span>BOM Hierarchy</span>
                                                <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                                            </div>
                                            <div className="text-sm font-extrabold font-mono text-amber-800 dark:text-amber-300 mt-1">
                                                {explodedBOM?.summary.totalItemCount ?? (Array.isArray(item.bom) ? item.bom.length : 0)} Items
                                            </div>
                                            <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium">
                                                {explodedBOM?.summary.totalLevels ? `${explodedBOM.summary.totalLevels} Level Tree • View BOM →` : '1 Level Direct'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Core Specs */}
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                                        <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                            <Layers size={14} className={theme.accentColor} /> Product Specifications
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-xs">
                                            <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                                <span className="text-slate-500 dark:text-slate-400">Product Name:</span>
                                                <span className="font-extrabold text-slate-900 dark:text-white">{item.name || item.productName || '-'}</span>
                                            </div>
                                            <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                                <span className="text-slate-500 dark:text-slate-400">Product Code / Part No:</span>
                                                <span className="font-mono font-bold text-purple-600 dark:text-purple-400">{item.code || item.productCode || '-'}</span>
                                            </div>
                                            <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                                <span className="text-slate-500 dark:text-slate-400">Type / Classification:</span>
                                                <span className="font-bold text-slate-800 dark:text-slate-200">{item.type || 'Component'}</span>
                                            </div>
                                            <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                                <span className="text-slate-500 dark:text-slate-400">Category:</span>
                                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                                    {typeof item.category === 'object' ? item.category?.name : (typeof item.categoryId === 'object' ? item.categoryId?.name : (item.category || item.categoryId || '-'))}
                                                </span>
                                            </div>
                                            <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                                <span className="text-slate-500 dark:text-slate-400">Primary Unit:</span>
                                                <span className="font-bold text-slate-800 dark:text-slate-200">{item.unit || 'Nos'}</span>
                                            </div>
                                            {item.hasSecondaryUnit && item.secondaryUnit && (
                                                <>
                                                    <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                                        <span className="text-slate-500 dark:text-slate-400">Secondary Unit:</span>
                                                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{item.secondaryUnit}</span>
                                                    </div>
                                                    <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                                        <span className="text-slate-500 dark:text-slate-400">Conversion Ratio:</span>
                                                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                                            1 {item.unit || 'Unit'} = {item.conversionFactor ?? 1} {item.secondaryUnit}
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                            <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                                <span className="text-slate-500 dark:text-slate-400">Storage Location:</span>
                                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                                    {typeof item.location === 'object' ? item.location?.name : (typeof item.locationId === 'object' ? item.locationId?.name : (item.location || '-'))}
                                                </span>
                                            </div>
                                            <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                                <span className="text-slate-500 dark:text-slate-400">Revision Number:</span>
                                                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{item.revisionNumber || '-'}</span>
                                            </div>
                                            <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                                <span className="text-slate-500 dark:text-slate-400">HSN Code:</span>
                                                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{item.hsnCode || '-'}</span>
                                            </div>
                                            <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                                <span className="text-slate-500 dark:text-slate-400">Reorder Level / Min Stock:</span>
                                                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{item.reorderLevel !== undefined ? `${item.reorderLevel} ${item.unit || 'Nos'}` : '-'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Photos / Attachments */}
                                    {item.photos && item.photos.length > 0 && (
                                        <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                                            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                <Eye size={14} className={theme.accentColor} /> Attached Photos & Documents
                                            </div>
                                            <div className="flex flex-wrap gap-4">
                                                {item.photos.map((photo: any, idx: number) => {
                                                    const photoUrl = typeof photo === 'string' ? photo : '';
                                                    const isPdf = photoUrl.toLowerCase().includes('.pdf');
                                                    return (
                                                        <div 
                                                            key={idx} 
                                                            onClick={() => window.open(photoUrl, '_blank')}
                                                            className="w-32 h-32 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden relative cursor-pointer hover:border-indigo-500 group shadow-sm flex flex-col items-center justify-center p-2"
                                                        >
                                                            {isPdf ? (
                                                                <div className="text-center">
                                                                    <FileText size={32} className="text-red-500 mx-auto mb-1" />
                                                                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">View PDF</span>
                                                                </div>
                                                            ) : (
                                                                <img src={photoUrl} alt="Item Attachment" className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform" />
                                                            )}
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                                                                <ExternalLink size={14} /> Open
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Description */}
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2">
                                        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Description & Technical Notes</span>
                                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                                            {item.description || item.descriptions || 'No additional specifications provided.'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: MULTI-LEVEL BOM BREAKDOWN & COSTING DASHBOARD */}
                            {activeFgTab === 'bom' && (
                                explodedBOM && explodedBOM.flatTree.length > 0 ? (
                                    <div className="space-y-5">
                                        {/* Price Save Success Alert */}
                                        {priceSaveNotice && (
                                            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center justify-between shadow-xs animate-in fade-in">
                                                <span className="flex items-center gap-2">
                                                    <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                                                    <span>{priceSaveNotice}</span>
                                                </span>
                                                <button 
                                                    type="button" 
                                                    onClick={() => setPriceSaveNotice(null)} 
                                                    className="text-emerald-600 hover:text-emerald-800 dark:hover:text-emerald-300 p-1 rounded-lg"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        )}

                                        {/* Sub-Assembly Sales Price Notice */}
                                        {costingSummary.excludedChildPartsCount > 0 && (
                                            <div className="p-3.5 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 rounded-2xl flex items-center gap-3 text-xs text-indigo-900 dark:text-indigo-200 shadow-2xs">
                                                <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs shrink-0">
                                                    <Info size={16} />
                                                </div>
                                                <div className="flex-1 leading-relaxed">
                                                    <span className="font-extrabold">Sub-Assembly Sales Pricing Rule Active:</span> Sub-assemblies with an assigned price in the Sales Price List are costed at their assigned price. Their child raw materials and bought-out components are excluded from the extended BOM cost to prevent double-counting.
                                                </div>
                                            </div>
                                        )}

                                        {/* Dynamic Executive Dashboard (5 Metric Cards) */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                                            {/* Card 1: Total Estimated Cost */}
                                            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-200/80 dark:border-indigo-800/80 shadow-2xs">
                                                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                                                    <span className="text-[11px] font-black uppercase tracking-wider">Est. BOM Cost</span>
                                                    <span className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 shadow-2xs">
                                                        <IndianRupee size={14} />
                                                    </span>
                                                </div>
                                                <div className="text-xl sm:text-2xl font-black font-mono text-indigo-700 dark:text-indigo-300 mt-2 truncate">
                                                    ₹{costingSummary.totalEstimatedCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                                                    Per 1 {item.unit || 'Unit'} of FG
                                                </div>
                                            </div>

                                            {/* Card 2: Price Coverage */}
                                            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-200/80 dark:border-emerald-800/80 shadow-2xs">
                                                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                                                    <span className="text-[11px] font-black uppercase tracking-wider">Price Coverage</span>
                                                    <span className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 shadow-2xs">
                                                        <CheckCircle2 size={14} />
                                                    </span>
                                                </div>
                                                <div className="text-xl sm:text-2xl font-black font-mono text-emerald-700 dark:text-emerald-300 mt-2">
                                                    {costingSummary.coveragePercentage}%
                                                </div>
                                                <div className="mt-2 w-full bg-slate-200/80 dark:bg-slate-700/80 h-1.5 rounded-full overflow-hidden">
                                                    <div 
                                                        className="bg-emerald-500 h-full rounded-full transition-all duration-300" 
                                                        style={{ width: `${costingSummary.coveragePercentage}%` }} 
                                                    />
                                                </div>
                                                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                                                    {costingSummary.totalPricedItems} of {costingSummary.totalItems} parts priced
                                                </div>
                                            </div>

                                            {/* Card 3: Missing Prices (Interactive Toggle) */}
                                            <div 
                                                onClick={() => setPriceFilterMode(priceFilterMode === 'MISSING_ONLY' ? 'ALL' : 'MISSING_ONLY')}
                                                className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
                                                    priceFilterMode === 'MISSING_ONLY'
                                                        ? 'bg-rose-100 dark:bg-rose-950/70 border-rose-400 dark:border-rose-600 ring-2 ring-rose-500/20'
                                                        : costingSummary.totalMissingItems > 0 
                                                            ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60 hover:border-rose-300'
                                                            : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
                                                }`}
                                                title="Click to toggle filter for items missing price"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-400">Missing Prices</span>
                                                    <span className={`p-1.5 rounded-xl ${costingSummary.totalMissingItems > 0 ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                                        <AlertTriangle size={14} />
                                                    </span>
                                                </div>
                                                <div className={`text-xl sm:text-2xl font-black font-mono mt-2 ${costingSummary.totalMissingItems > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                    {costingSummary.totalMissingItems}
                                                </div>
                                                <div className="text-[10px] mt-1 flex items-center gap-1">
                                                    {costingSummary.totalMissingItems > 0 ? (
                                                        <span className="text-rose-600 dark:text-rose-400 font-bold underline">
                                                            {priceFilterMode === 'MISSING_ONLY' ? 'Filtering Missing (Reset)' : 'Filter missing parts →'}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-500 dark:text-slate-400 font-medium">All items priced</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Card 4: Total Cumulative Parts Qty */}
                                            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 via-sky-500/5 to-transparent border border-blue-200/80 dark:border-blue-800/80 shadow-2xs">
                                                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                                                    <span className="text-[11px] font-black uppercase tracking-wider">Total Parts Qty</span>
                                                    <span className="p-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 shadow-2xs">
                                                        <Boxes size={14} />
                                                    </span>
                                                </div>
                                                <div className="text-xl sm:text-2xl font-black font-mono text-blue-700 dark:text-blue-300 mt-2 truncate">
                                                    {costingSummary.totalCumulativeQty.toLocaleString()}
                                                </div>
                                                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                                                    Across {explodedBOM.summary.totalLevels ? `${explodedBOM.summary.totalLevels} levels` : 'all levels'}
                                                </div>
                                            </div>

                                            {/* Card 5: Cost by Classification */}
                                            <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 via-violet-500/5 to-transparent border border-purple-200/80 dark:border-purple-800/80 shadow-2xs">
                                                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                                                    <span className="text-[11px] font-black uppercase tracking-wider">Cost by Type</span>
                                                    <span className="p-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 shadow-2xs">
                                                        <Tag size={14} />
                                                    </span>
                                                </div>
                                                <div className="mt-1.5 space-y-1 text-[11px] font-semibold">
                                                    <div className="flex justify-between items-center text-blue-700 dark:text-blue-300">
                                                        <span>RM:</span>
                                                        <span className="font-mono font-bold">₹{costingSummary.rmCost.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-amber-700 dark:text-amber-300">
                                                        <span>BO:</span>
                                                        <span className="font-mono font-bold">₹{costingSummary.boCost.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-purple-700 dark:text-purple-300">
                                                        <span>Comp/Sub:</span>
                                                        <span className="font-mono font-bold">₹{(costingSummary.componentCost + costingSummary.subAssemblyCost).toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Multi-Level Engineering BOM Breakdown & Costing Section */}
                                        <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-4">
                                            {/* Section Title & View Mode Toggle */}
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-700/80">
                                                <div>
                                                    <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                                        <Layers3 size={15} className="text-purple-500" /> Multi-Level Engineering BOM Breakdown & Costing
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                        Interactive BOM costing workbench with live vendor rates, consolidated quantities, and direct price configuration.
                                                    </p>
                                                </div>

                                                {/* View Mode Toggle (Tree View vs Consolidated Table) */}
                                                <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
                                                    <div className="flex items-center bg-slate-200/70 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                                                        <button
                                                            type="button"
                                                            onClick={() => setBomViewMode('tree')}
                                                            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                                                bomViewMode === 'tree'
                                                                    ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-2xs font-extrabold'
                                                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                                            }`}
                                                        >
                                                            <GitFork size={13} />
                                                            <span>Tree View</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setBomViewMode('table')}
                                                            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                                                bomViewMode === 'table'
                                                                    ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-2xs font-extrabold'
                                                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                                            }`}
                                                        >
                                                            <List size={13} />
                                                            <span>Consolidated Table</span>
                                                        </button>
                                                    </div>

                                                    {/* Expand/Collapse All (Tree Mode only) */}
                                                    {bomViewMode === 'tree' && (
                                                        <div className="flex items-center gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={handleExpandAll}
                                                                className="px-2 py-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
                                                            >
                                                                Expand All
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={handleCollapseAll}
                                                                className="px-2 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                                                            >
                                                                Collapse All
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Filters Bar: Category Chips + Pricing Status Chips */}
                                            <div className="space-y-2.5">
                                                {/* Category Filter Chips */}
                                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Category:</span>
                                                    {[
                                                        {
                                                            key: 'ALL' as BOMFilterType,
                                                            label: 'All Items',
                                                            count: explodedBOM.summary.totalItemCount,
                                                            icon: Layers3,
                                                            color: 'text-purple-600 dark:text-purple-400',
                                                            activeClass: 'bg-purple-600 text-white shadow-sm border-purple-600'
                                                        },
                                                        {
                                                            key: 'RM' as BOMFilterType,
                                                            label: 'Raw Materials (RM)',
                                                            count: explodedBOM.summary.rmCount,
                                                            icon: Box,
                                                            color: 'text-blue-600 dark:text-blue-400',
                                                            activeClass: 'bg-blue-600 text-white shadow-sm border-blue-600'
                                                        },
                                                        {
                                                            key: 'BO' as BOMFilterType,
                                                            label: 'Bought Out (BO)',
                                                            count: explodedBOM.summary.boCount,
                                                            icon: Package,
                                                            color: 'text-amber-600 dark:text-amber-400',
                                                            activeClass: 'bg-amber-600 text-white shadow-sm border-amber-600'
                                                        },
                                                        {
                                                            key: 'COMPONENT' as BOMFilterType,
                                                            label: 'Components',
                                                            count: explodedBOM.summary.componentCount,
                                                            icon: Layers,
                                                            color: 'text-sky-600 dark:text-sky-400',
                                                            activeClass: 'bg-sky-600 text-white shadow-sm border-sky-600'
                                                        },
                                                        {
                                                            key: 'SUBASSEMBLY' as BOMFilterType,
                                                            label: 'Sub-Assemblies',
                                                            count: explodedBOM.summary.subAssemblyCount,
                                                            icon: GitFork,
                                                            color: 'text-indigo-600 dark:text-indigo-400',
                                                            activeClass: 'bg-indigo-600 text-white shadow-sm border-indigo-600'
                                                        }
                                                    ].map((tab) => {
                                                        const isActive = activeBOMFilter === tab.key;
                                                        const TabIcon = tab.icon;

                                                        return (
                                                            <div
                                                                key={tab.key}
                                                                onClick={() => setActiveBOMFilter(tab.key)}
                                                                className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                                                                    isActive 
                                                                        ? tab.activeClass 
                                                                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                                }`}
                                                            >
                                                                <TabIcon size={14} className={isActive ? 'text-white' : tab.color} />
                                                                <span>{tab.label}</span>
                                                                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                                                                    isActive 
                                                                        ? 'bg-white/20 text-white font-extrabold' 
                                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                                                }`}>
                                                                    {tab.count}
                                                                </span>

                                                                {/* Quick PDF Download Button on Tab */}
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDownloadPDF(tab.key);
                                                                    }}
                                                                    className={`ml-1 p-1 rounded-lg transition-colors ${
                                                                        isActive 
                                                                            ? 'hover:bg-white/20 text-white/90 hover:text-white' 
                                                                            : 'text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                                                    }`}
                                                                    title={`Download ${tab.label} PDF`}
                                                                >
                                                                    <Download size={12} />
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* Price Filter Chips (All vs Priced Only vs Missing Prices) */}
                                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Pricing Filter:</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setPriceFilterMode('ALL')}
                                                        className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                                            priceFilterMode === 'ALL'
                                                                ? 'bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-800 dark:border-slate-100 shadow-2xs'
                                                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        <span>All Pricing Status</span>
                                                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-200/50 dark:bg-slate-800">
                                                            {explodedBOM.summary.totalItemCount}
                                                        </span>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => setPriceFilterMode('PRICED_ONLY')}
                                                        className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                                            priceFilterMode === 'PRICED_ONLY'
                                                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                                                : 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 border-slate-200 dark:border-slate-700 hover:border-emerald-300'
                                                        }`}
                                                    >
                                                        <CheckCircle2 size={13} />
                                                        <span>Priced Only</span>
                                                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${priceFilterMode === 'PRICED_ONLY' ? 'bg-white/20 text-white' : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'}`}>
                                                            {costingSummary.totalPricedItems}
                                                        </span>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => setPriceFilterMode('MISSING_ONLY')}
                                                        className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                                            priceFilterMode === 'MISSING_ONLY'
                                                                ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                                                                : 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 border-slate-200 dark:border-slate-700 hover:border-rose-300'
                                                        }`}
                                                    >
                                                        <AlertTriangle size={13} />
                                                        <span>Missing Prices Only</span>
                                                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${priceFilterMode === 'MISSING_ONLY' ? 'bg-white/20 text-white' : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300'}`}>
                                                            {costingSummary.totalMissingItems}
                                                        </span>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Active Filter Chips & Reset */}
                                            {hasActiveFilters && (
                                                <div className="flex items-center gap-2 flex-wrap px-3 py-2 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl border border-indigo-200/60 dark:border-indigo-800/60 text-xs">
                                                    <span className="font-extrabold text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                                                        <ListFilter size={13} /> Active Column Filters:
                                                    </span>
                                                    {colFilterMaterialName.length > 0 && (
                                                        <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 flex items-center gap-1 font-medium text-[11px]">
                                                            Items: {colFilterMaterialName.length}
                                                            <button type="button" onClick={() => setColFilterMaterialName([])} className="hover:text-indigo-900 dark:hover:text-white cursor-pointer"><X size={11} /></button>
                                                        </span>
                                                    )}
                                                    {colFilterSubCategory.length > 0 && (
                                                        <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 flex items-center gap-1 font-medium text-[11px]">
                                                            Subcategory: {colFilterSubCategory.join(', ')}
                                                            <button type="button" onClick={() => setColFilterSubCategory([])} className="hover:text-indigo-900 dark:hover:text-white cursor-pointer"><X size={11} /></button>
                                                        </span>
                                                    )}
                                                    {colFilterClassification.length > 0 && (
                                                        <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 flex items-center gap-1 font-medium text-[11px]">
                                                            Classification: {colFilterClassification.join(', ')}
                                                            <button type="button" onClick={() => setColFilterClassification([])} className="hover:text-indigo-900 dark:hover:text-white cursor-pointer"><X size={11} /></button>
                                                        </span>
                                                    )}
                                                    {colFilterLevel.length > 0 && (
                                                        <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 flex items-center gap-1 font-medium text-[11px]">
                                                            Level: {colFilterLevel.join(', ')}
                                                            <button type="button" onClick={() => setColFilterLevel([])} className="hover:text-indigo-900 dark:hover:text-white cursor-pointer"><X size={11} /></button>
                                                        </span>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={handleClearAllFilters}
                                                        className="ml-auto text-xs text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 font-bold cursor-pointer"
                                                    >
                                                        <FilterX size={13} /> Reset Filters
                                                    </button>
                                                </div>
                                            )}

                                            {/* MODE 1: CONSOLIDATED REQUIREMENTS TABLE WITH RATES & ACTIONS */}
                                            {bomViewMode === 'table' ? (
                                                <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900/60">
                                                    <table className="w-full text-xs text-left">
                                                        <thead className="text-[10px] text-slate-500 dark:text-slate-400 uppercase bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-700/80">
                                                            <tr>
                                                                <th className="px-3 py-2.5 text-center w-12">#</th>
                                                                <th className="px-3 py-2.5 min-w-[260px]">
                                                                    <div className="flex items-center justify-between gap-1">
                                                                        <span>Component / Item Name & Description</span>
                                                                        <ColumnFilter
                                                                            column="materialName"
                                                                            title="Item Name"
                                                                            data={enrichedConsolidated}
                                                                            currentFilters={colFilterMaterialName}
                                                                            onFilterChange={setColFilterMaterialName}
                                                                            getValue={(item) => item.materialName}
                                                                            sortConfig={tableSortConfig}
                                                                            onSortChange={handleSortChange}
                                                                        />
                                                                    </div>
                                                                </th>
                                                                <th className="px-3 py-2.5 w-32">
                                                                    <div className="flex items-center justify-between gap-1">
                                                                        <span>Subcategory</span>
                                                                        <ColumnFilter
                                                                            column="subCategory"
                                                                            title="Subcategory"
                                                                            data={enrichedConsolidated}
                                                                            currentFilters={colFilterSubCategory}
                                                                            onFilterChange={setColFilterSubCategory}
                                                                            getValue={(item) => item.subCategory || '-'}
                                                                            sortConfig={tableSortConfig}
                                                                            onSortChange={handleSortChange}
                                                                        />
                                                                    </div>
                                                                </th>
                                                                <th className="px-3 py-2.5 text-center w-36">
                                                                    <div className="flex items-center justify-center gap-1">
                                                                        <span>Classification</span>
                                                                        <ColumnFilter
                                                                            column="classification"
                                                                            title="Classification"
                                                                            data={enrichedConsolidated}
                                                                            currentFilters={colFilterClassification}
                                                                            onFilterChange={setColFilterClassification}
                                                                            getValue={(item) => getNormalizedClassification(item.itemType)}
                                                                            sortConfig={tableSortConfig}
                                                                            onSortChange={handleSortChange}
                                                                        />
                                                                    </div>
                                                                </th>
                                                                <th className="px-3 py-2.5 min-w-[180px]">Parent Usages</th>
                                                                <th className="px-3 py-2.5 text-right w-36">
                                                                    <div className="flex items-center justify-end gap-1">
                                                                        <span>Total Qty (1 FG)</span>
                                                                        <ColumnFilter
                                                                            column="totalQty"
                                                                            title="Total Required"
                                                                            data={enrichedConsolidated}
                                                                            currentFilters={[]}
                                                                            onFilterChange={() => {}}
                                                                            enableSort={true}
                                                                            sortConfig={tableSortConfig}
                                                                            onSortChange={handleSortChange}
                                                                        />
                                                                    </div>
                                                                </th>
                                                                <th className="px-3 py-2.5 text-right w-44">
                                                                    <div className="flex items-center justify-end gap-1">
                                                                        <span>Unit Rate & Vendor</span>
                                                                        <ColumnFilter
                                                                            column="unitPrice"
                                                                            title="Unit Rate"
                                                                            data={enrichedConsolidated}
                                                                            currentFilters={[]}
                                                                            onFilterChange={() => {}}
                                                                            enableSort={true}
                                                                            sortConfig={tableSortConfig}
                                                                            onSortChange={handleSortChange}
                                                                        />
                                                                    </div>
                                                                </th>
                                                                <th className="px-3 py-2.5 text-right w-40">
                                                                    <div className="flex items-center justify-end gap-1">
                                                                        <span>Extended Cost (₹)</span>
                                                                        <ColumnFilter
                                                                            column="extendedCost"
                                                                            title="Extended Cost"
                                                                            data={enrichedConsolidated}
                                                                            currentFilters={[]}
                                                                            onFilterChange={() => {}}
                                                                            enableSort={true}
                                                                            sortConfig={tableSortConfig}
                                                                            onSortChange={handleSortChange}
                                                                        />
                                                                    </div>
                                                                </th>
                                                                <th className="px-3 py-2.5 text-center w-28">Action</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                            {finalDisplayConsolidated.length > 0 ? (
                                                                finalDisplayConsolidated.map((cItem, idx) => {
                                                                    let typeBadgeClass = 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60';
                                                                    let typeText = 'Raw Material (RM)';
                                                                    if (cItem.itemType === 'SubAssembly') {
                                                                        typeBadgeClass = 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60';
                                                                        typeText = '🧩 Sub-Assembly';
                                                                    } else if (cItem.itemType === 'Assembly') {
                                                                        typeBadgeClass = 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60';
                                                                        typeText = '⚙️ Assembly';
                                                                    } else if (cItem.itemType === 'Component') {
                                                                        typeBadgeClass = 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800/60';
                                                                        typeText = '🔧 In-House Component';
                                                                    } else if (cItem.itemType === 'BO') {
                                                                        typeBadgeClass = 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60';
                                                                        typeText = '📦 Bought Out (BO)';
                                                                    }

                                                                    const pInfo = cItem.priceInfo;
                                                                    const isPriced = Boolean(pInfo && pInfo.hasPrice);

                                                                    return (
                                                                        <tr key={cItem.id || cItem.materialName} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                                                            <td className="px-3 py-2.5 text-center font-bold text-slate-400 text-[11px]">
                                                                                {idx + 1}
                                                                            </td>
                                                                            {/* Item Name & Description (Rule 1 Strict Standard) */}
                                                                            <td className="px-3 py-2.5">
                                                                                <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                                                                                    {cItem.materialName || 'N/A'}
                                                                                </div>
                                                                                {cItem.description && (
                                                                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-0.5 line-clamp-2">
                                                                                        {cItem.description}
                                                                                    </div>
                                                                                )}
                                                                            </td>
                                                                            <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300 text-xs">
                                                                                {cItem.subCategory || '-'}
                                                                            </td>
                                                                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                                                                <span className={`px-2 py-0.5 font-bold rounded text-[10px] border ${typeBadgeClass}`}>
                                                                                    {typeText}
                                                                                </span>
                                                                            </td>
                                                                            <td className="px-3 py-2.5">
                                                                                <div className="flex flex-wrap gap-1">
                                                                                    {cItem.usages.map((u, uIdx) => (
                                                                                        <span 
                                                                                            key={uIdx}
                                                                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-[10px] text-slate-700 dark:text-slate-300"
                                                                                        >
                                                                                            <span className="font-medium">{u.parentName}:</span>
                                                                                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{u.quantityPerParent} {u.unit}</span>
                                                                                        </span>
                                                                                    ))}
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                                                                <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs sm:text-sm">
                                                                                    {cItem.totalCumulativeQuantity} {cItem.unit}
                                                                                </div>
                                                                                {cItem.hasSecondaryUnit && cItem.totalSecondaryCumulativeQuantity !== undefined && cItem.totalSecondaryCumulativeQuantity > 0 && (
                                                                                    <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 font-mono">
                                                                                        (= {cItem.totalSecondaryCumulativeQuantity} {cItem.secondaryUnit})
                                                                                    </div>
                                                                                )}
                                                                            </td>

                                                                            {/* Unit Rate & Vendor */}
                                                                            <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                                                                {isPriced ? (
                                                                                    <div>
                                                                                        <div className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                                                                                            ₹{pInfo.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                                        </div>
                                                                                        <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-end gap-1 mt-0.5">
                                                                                            {pInfo.isPreferredVendor && <span className="text-amber-500 font-bold" title="Preferred Vendor">★</span>}
                                                                                            <span className="truncate max-w-[130px]">{pInfo.vendorName || (pInfo.priceSource === 'sales-price-list' ? 'Sales List' : 'Master')}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                ) : (
                                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                                                                                        <AlertTriangle size={10} /> No Rate
                                                                                    </span>
                                                                                )}
                                                                            </td>

                                                                            {/* Extended Cost */}
                                                                            <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                                                                {isPriced ? (
                                                                                    <div className="font-mono font-extrabold text-indigo-700 dark:text-indigo-300 text-xs sm:text-sm">
                                                                                        ₹{pInfo.extendedCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                                    </div>
                                                                                ) : (
                                                                                    <span className="font-mono text-slate-400 text-xs">-</span>
                                                                                )}
                                                                            </td>

                                                                            {/* Action: + Add Price / Edit Price */}
                                                                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                                                                {canManagePrice ? (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => handleOpenAddPrice(cItem)}
                                                                                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 mx-auto cursor-pointer active:scale-95 shadow-2xs ${
                                                                                            isPriced
                                                                                                ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                                                                                : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-xs'
                                                                                        }`}
                                                                                        title={isPriced ? "Edit rate in price list" : "Add rate in price list"}
                                                                                    >
                                                                                        {isPriced ? <Edit3 size={11} /> : <Plus size={11} />}
                                                                                        <span>{isPriced ? 'Edit' : '+ Price'}</span>
                                                                                    </button>
                                                                                ) : (
                                                                                    <span className="text-[10px] text-slate-400 italic">View Only</span>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })
                                                            ) : (
                                                                <tr>
                                                                    <td colSpan={9} className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
                                                                        No items match the active category, price, or column filters.
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </tbody>

                                                        {/* Table Footer: Total Cost Row */}
                                                        {finalDisplayConsolidated.length > 0 && (
                                                            <tfoot className="bg-slate-100/90 dark:bg-slate-800/90 border-t-2 border-slate-300 dark:border-slate-700 text-xs font-bold">
                                                                <tr>
                                                                    <td colSpan={5} className="px-4 py-3 text-right uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                                                        Grand Total BOM Estimated Cost ({finalDisplayConsolidated.length} filtered items):
                                                                    </td>
                                                                    <td className="px-3 py-3 text-right font-mono font-extrabold text-slate-900 dark:text-white">
                                                                        {costingSummary.totalCumulativeQty.toLocaleString()} Units
                                                                    </td>
                                                                    <td className="px-3 py-3 text-right text-slate-400 text-[11px] font-normal">
                                                                        {costingSummary.totalPricedItems}/{costingSummary.totalItems} Priced
                                                                    </td>
                                                                    <td className="px-3 py-3 text-right font-mono font-black text-indigo-700 dark:text-indigo-300 text-sm">
                                                                        ₹{costingSummary.totalEstimatedCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </td>
                                                                    <td className="px-3 py-3"></td>
                                                                </tr>
                                                            </tfoot>
                                                        )}
                                                    </table>
                                                </div>
                                            ) : (
                                                /* MODE 2: MULTI-LEVEL BOM TREE TABLE VIEW WITH RATES & ACTIONS */
                                                <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900/60">
                                                    <table className="w-full text-xs text-left">
                                                        <thead className="text-[10px] text-slate-500 dark:text-slate-400 uppercase bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-700/80">
                                                            <tr>
                                                                <th className="px-3 py-2.5 text-center w-16">
                                                                    <div className="flex items-center justify-center gap-1">
                                                                        <span>Level</span>
                                                                        <ColumnFilter
                                                                            column="level"
                                                                            title="Level"
                                                                            data={explodedBOM.flatTree}
                                                                            currentFilters={colFilterLevel}
                                                                            onFilterChange={setColFilterLevel}
                                                                            getValue={(node) => `L${node.level}`}
                                                                        />
                                                                    </div>
                                                                </th>
                                                                <th className="px-3 py-2.5 min-w-[280px]">
                                                                    <div className="flex items-center justify-between gap-1">
                                                                        <span>Component / Item Name & Description</span>
                                                                        <ColumnFilter
                                                                            column="materialName"
                                                                            title="Item Name"
                                                                            data={explodedBOM.flatTree}
                                                                            currentFilters={colFilterMaterialName}
                                                                            onFilterChange={setColFilterMaterialName}
                                                                            getValue={(node) => node.materialName}
                                                                        />
                                                                    </div>
                                                                </th>
                                                                <th className="px-3 py-2.5 w-32">
                                                                    <div className="flex items-center justify-between gap-1">
                                                                        <span>Subcategory</span>
                                                                        <ColumnFilter
                                                                            column="subCategory"
                                                                            title="Subcategory"
                                                                            data={explodedBOM.flatTree}
                                                                            currentFilters={colFilterSubCategory}
                                                                            onFilterChange={setColFilterSubCategory}
                                                                            getValue={(node) => node.subCategory || '-'}
                                                                        />
                                                                    </div>
                                                                </th>
                                                                <th className="px-3 py-2.5 text-center w-36">
                                                                    <div className="flex items-center justify-center gap-1">
                                                                        <span>Classification</span>
                                                                        <ColumnFilter
                                                                            column="classification"
                                                                            title="Classification"
                                                                            data={explodedBOM.flatTree}
                                                                            currentFilters={colFilterClassification}
                                                                            onFilterChange={setColFilterClassification}
                                                                            getValue={(node) => getNormalizedClassification(node.itemType)}
                                                                        />
                                                                    </div>
                                                                </th>
                                                                <th className="px-3 py-2.5 text-right w-28">Qty / Parent</th>
                                                                <th className="px-3 py-2.5 text-right w-28">Cumulative Qty</th>
                                                                <th className="px-3 py-2.5 text-right w-44">Unit Rate & Vendor</th>
                                                                <th className="px-3 py-2.5 text-right w-40">Extended Cost (₹)</th>
                                                                <th className="px-3 py-2.5 text-center w-28">Action</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                            {(() => {
                                                                const renderTreeRows = (nodes: EnrichedExplodedBOMNode[]): React.ReactNode => {
                                                                    return nodes.map((node) => {
                                                                        const isCollapsed = collapsedKeys.has(node.key);
                                                                        const hasChildren = node.hasChildren && node.children.length > 0;
                                                                        const indentPadding = Math.max(0, (node.level - 2) * 20 + 8);

                                                                        let typeBadgeClass = 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60';
                                                                        let typeText = 'Raw Material (RM)';
                                                                        if (node.itemType === 'SubAssembly') {
                                                                            typeBadgeClass = 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60';
                                                                            typeText = '🧩 FG Sub-Assembly';
                                                                        } else if (node.itemType === 'Assembly') {
                                                                            typeBadgeClass = 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60';
                                                                            typeText = '⚙️ FG Assembly';
                                                                        } else if (node.itemType === 'Component') {
                                                                            typeBadgeClass = 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800/60';
                                                                            typeText = '🔧 In-House Component';
                                                                        } else if (node.itemType === 'BO') {
                                                                            typeBadgeClass = 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60';
                                                                            typeText = '📦 Bought Out (BO)';
                                                                        }

                                                                        const pInfo = node.priceInfo;
                                                                        const isPriced = Boolean(pInfo && pInfo.hasPrice);

                                                                        return (
                                                                            <React.Fragment key={node.key}>
                                                                                <tr className={`transition-colors ${
                                                                                    hasChildren 
                                                                                        ? 'bg-slate-50/70 dark:bg-slate-800/40 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30 font-medium' 
                                                                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                                                                                }`}>
                                                                                    {/* Level Badge */}
                                                                                    <td className="px-3 py-2.5 text-center">
                                                                                        <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                                                                                            node.level === 2 
                                                                                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700' 
                                                                                                : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800'
                                                                                        }`}>
                                                                                            L{node.level}
                                                                                        </span>
                                                                                    </td>

                                                                                    {/* Item Name & Description with Tree Indentation (Rule 1 Standard) */}
                                                                                    <td className="px-3 py-2.5" style={{ paddingLeft: `${indentPadding}px` }}>
                                                                                        <div className="flex items-start gap-2">
                                                                                            {hasChildren ? (
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={() => toggleCollapse(node.key)}
                                                                                                    className="p-1 -ml-1 mt-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shrink-0 cursor-pointer"
                                                                                                    title={isCollapsed ? "Expand nested BOM" : "Collapse nested BOM"}
                                                                                                >
                                                                                                    {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                                                                                                </button>
                                                                                            ) : (
                                                                                                node.level > 2 && (
                                                                                                    <span className="text-slate-400 font-mono text-xs select-none mt-0.5 shrink-0">↳</span>
                                                                                                )
                                                                                            )}
                                                                                            <div className="min-w-0 flex-1">
                                                                                                <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                                                                                                    <span>{node.materialName || 'N/A'}</span>
                                                                                                    {hasChildren && (
                                                                                                        <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200/60 dark:border-indigo-800/60">
                                                                                                            {node.children.length} sub-items
                                                                                                        </span>
                                                                                                    )}
                                                                                                </div>
                                                                                                {node.description && (
                                                                                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-0.5 line-clamp-2">
                                                                                                        {node.description}
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    </td>

                                                                                    {/* Subcategory */}
                                                                                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300 text-xs">
                                                                                        {node.subCategory || '-'}
                                                                                    </td>

                                                                                    {/* Classification */}
                                                                                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                                                                        <span className={`px-2 py-0.5 font-bold rounded text-[10px] border ${typeBadgeClass}`}>
                                                                                            {typeText}
                                                                                        </span>
                                                                                    </td>

                                                                                    {/* Qty Per Parent */}
                                                                                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                                                                        <div className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                                                                                            {node.quantityPerParent} {node.unit}
                                                                                        </div>
                                                                                        {node.hasSecondaryUnit && node.secondaryQuantityPerParent !== undefined && (
                                                                                            <div className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 font-mono">
                                                                                                (= {node.secondaryQuantityPerParent} {node.secondaryUnit})
                                                                                            </div>
                                                                                        )}
                                                                                    </td>

                                                                                    {/* Cumulative Qty */}
                                                                                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                                                                        <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                                                                                            {node.cumulativeQuantity} {node.unit}
                                                                                        </div>
                                                                                        {node.hasSecondaryUnit && node.secondaryCumulativeQuantity !== undefined && (
                                                                                            <div className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 font-mono">
                                                                                                (= {node.secondaryCumulativeQuantity} {node.secondaryUnit})
                                                                                            </div>
                                                                                        )}
                                                                                    </td>

                                                                                    {/* Unit Rate & Vendor */}
                                                                                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                                                                        {isPriced ? (
                                                                                            <div>
                                                                                                <div className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                                                                                                    ₹{pInfo.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                                                </div>
                                                                                                <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-end gap-1 mt-0.5">
                                                                                                    {pInfo.isPreferredVendor && <span className="text-amber-500 font-bold" title="Preferred Vendor">★</span>}
                                                                                                    <span className="truncate max-w-[130px]">{pInfo.vendorName || (pInfo.priceSource === 'sales-price-list' ? 'Sales List' : 'Master')}</span>
                                                                                                </div>
                                                                                            </div>
                                                                                        ) : (
                                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                                                                                                <AlertTriangle size={10} /> No Rate
                                                                                            </span>
                                                                                        )}
                                                                                    </td>

                                                                                    {/* Extended Cost (or covered in sub-assembly) */}
                                                                                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                                                                        {pInfo?.underPricedSubAssembly ? (
                                                                                            <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded" title="Covered under parent Sub-Assembly sales price">
                                                                                                Covered in Sub-Assy
                                                                                            </span>
                                                                                        ) : isPriced ? (
                                                                                            <div className="font-mono font-extrabold text-indigo-700 dark:text-indigo-300 text-xs sm:text-sm">
                                                                                                ₹{pInfo.extendedCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                                            </div>
                                                                                        ) : (
                                                                                            <span className="font-mono text-slate-400 text-xs">-</span>
                                                                                        )}
                                                                                    </td>

                                                                                    {/* Action: + Add / Edit Rate */}
                                                                                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                                                                        {canManagePrice ? (
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => handleOpenAddPrice(node)}
                                                                                                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 mx-auto cursor-pointer active:scale-95 shadow-2xs ${
                                                                                                    isPriced
                                                                                                        ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                                                                                        : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-xs'
                                                                                                }`}
                                                                                                title={isPriced ? "Edit rate in price list" : "Add rate in price list"}
                                                                                            >
                                                                                                {isPriced ? <Edit3 size={11} /> : <Plus size={11} />}
                                                                                                <span>{isPriced ? 'Edit' : '+ Price'}</span>
                                                                                            </button>
                                                                                        ) : (
                                                                                            <span className="text-[10px] text-slate-400 italic">View Only</span>
                                                                                        )}
                                                                                    </td>
                                                                                </tr>

                                                                                {/* Recursively render child items if expanded */}
                                                                                {!isCollapsed && hasChildren && renderTreeRows(node.children)}
                                                                            </React.Fragment>
                                                                        );
                                                                    });
                                                                };

                                                                return finalDisplayTree.length > 0 ? (
                                                                    renderTreeRows(finalDisplayTree)
                                                                ) : (
                                                                    <tr>
                                                                        <td colSpan={9} className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
                                                                            No items match the active category, price, or column filters in the tree hierarchy.
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })()}
                                                        </tbody>

                                                        {/* Table Footer: Total Cost Row */}
                                                        {finalDisplayTree.length > 0 && (
                                                            <tfoot className="bg-slate-100/90 dark:bg-slate-800/90 border-t-2 border-slate-300 dark:border-slate-700 text-xs font-bold">
                                                                <tr>
                                                                    <td colSpan={6} className="px-4 py-3 text-right uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                                                        Grand Total BOM Estimated Cost:
                                                                    </td>
                                                                    <td className="px-3 py-3 text-right text-slate-400 text-[11px] font-normal">
                                                                        {costingSummary.totalPricedItems}/{costingSummary.totalItems} Priced
                                                                    </td>
                                                                    <td className="px-3 py-3 text-right font-mono font-black text-indigo-700 dark:text-indigo-300 text-sm">
                                                                        ₹{costingSummary.totalEstimatedCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </td>
                                                                    <td className="px-3 py-3"></td>
                                                                </tr>
                                                            </tfoot>
                                                        )}
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">
                                        No Bill of Materials (BOM) components defined for this Finished Good.
                                    </div>
                                )
                            )}
                        </div>
                    )}

                    {/* LOCATION & CATEGORY VIEW */}
                    {(tabKey === 'location' || tabKey === 'locations' || tabKey === 'category' || tabKey === 'categories') && (
                        <div className="space-y-6">
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    <Info size={14} className={theme.accentColor} /> Record Details
                                </div>
                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                        <span className="text-slate-500 dark:text-slate-400">Name:</span>
                                        <span className="font-extrabold text-slate-900 dark:text-white">{item.name || '-'}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                        <span className="text-slate-500 dark:text-slate-400">Code:</span>
                                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{item.code || '-'}</span>
                                    </div>
                                    {item.type && (
                                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                            <span className="text-slate-500 dark:text-slate-400">Type / Classification:</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">{item.type}</span>
                                        </div>
                                    )}
                                    {tabKey !== 'category' && tabKey !== 'categories' && item.unit && (
                                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                            <span className="text-slate-500 dark:text-slate-400">Standard Unit:</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">{item.unit}</span>
                                        </div>
                                    )}
                                    {tabKey !== 'category' && tabKey !== 'categories' && item.hsnCode && (
                                        <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                                            <span className="text-slate-500 dark:text-slate-400">HSN Code:</span>
                                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{item.hsnCode}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2">
                                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Description & Location Notes</span>
                                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                                    {item.description || 'No additional notes provided.'}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Audit & History Card */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                        <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                            <ShieldCheck size={14} className="text-indigo-500" /> Audit & Tracking Information
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60">
                                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                                    <User size={15} />
                                </div>
                                <div className="space-y-0.5">
                                    <div className="text-[10px] uppercase font-bold text-slate-400">Created By</div>
                                    <div className="font-bold text-slate-800 dark:text-slate-200">{item.createdByName || 'System'}</div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                        {item.createdAt ? new Date(item.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Initial creation'}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60">
                                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                                    <Edit3 size={15} />
                                </div>
                                <div className="space-y-0.5">
                                    <div className="text-[10px] uppercase font-bold text-slate-400">Last Updated By</div>
                                    <div className="font-bold text-slate-800 dark:text-slate-200">{item.updatedByName || item.createdByName || 'System'}</div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                        {item.updatedAt ? new Date(item.updatedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Recent'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Metadata Footer */}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-[11px] text-slate-400">
                        <div>
                            Record ID: <span className="font-mono text-slate-500">{item._id || 'N/A'}</span>
                        </div>
                    </div>

                </div>
            </div>

            {/* In-place Vendor & Sales Price List Modals */}
            {isFG && (
                <>
                    <VendorPriceListModal
                        isOpen={showVendorPriceModal}
                        onClose={() => {
                            setShowVendorPriceModal(false);
                            setVendorPriceInitialData(null);
                        }}
                        onSubmit={handleSaveVendorPrice}
                        initialData={vendorPriceInitialData}
                        rawMaterials={rmList}
                        boughtOuts={boList}
                        vendors={fetchedVendors}
                    />

                    <PriceListModal
                        isOpen={showSalesPriceModal}
                        onClose={() => {
                            setShowSalesPriceModal(false);
                            setSalesPriceInitialData(null);
                        }}
                        onSubmit={handleSaveSalesPrice}
                        initialData={salesPriceInitialData}
                        fgItems={fgList}
                        priceLists={fetchedSalesPriceLists}
                    />
                </>
            )}
        </div>
    );
}
