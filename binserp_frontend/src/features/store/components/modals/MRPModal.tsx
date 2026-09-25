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
    ListFilter
} from 'lucide-react';
import { apiGet, apiPost, apiPut } from '@/src/lib/api';
import Swal from 'sweetalert2';

interface MRPModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    token: string;
    initialData?: any;
    preselectedPoIds?: string[];
}

interface FGRow {
    fgItem: string;
    fgItemName: string;
    fgItemCode: string;
    description: string;
    quantity: number;
    unit: string;
    poDeliveryDate?: string;
    targetDate: string;
    bomId?: string;
    bomNumber?: string;
    isFromOA?: boolean;
    customerPo?: string;
    customerPoNumber?: string;
    customerName?: string;
    sourceBreakdown?: Array<{
        customerPo?: string;
        customerPoNumber: string;
        customerName: string;
        quantity: number;
    }>;
    sourceCustomerPOs?: string[];
}

export default function MRPModal({ isOpen, onClose, onSuccess, token, initialData, preselectedPoIds }: MRPModalProps) {
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Masters Data
    const [customerList, setCustomerList] = useState<any[]>([]);
    const [fgItemList, setFgItemList] = useState<any[]>([]);
    const [bomsList, setBomsList] = useState<any[]>([]);
    const [incomingPOs, setIncomingPOs] = useState<any[]>([]);
    const [existingMRPPlans, setExistingMRPPlans] = useState<any[]>([]);

    // Plan Mode: Single PO vs Consolidated Multi-PO
    const [planMode, setPlanMode] = useState<'single' | 'consolidated'>('single');
    const [selectedMultiPoIds, setSelectedMultiPoIds] = useState<string[]>([]);
    const [multiPoSearch, setMultiPoSearch] = useState('');
    const [multiPoCustomerFilter, setMultiPoCustomerFilter] = useState('all');
    const [multiPoMrpFilter, setMultiPoMrpFilter] = useState<'pending' | 'all' | 'mrp_done'>('pending');

    // Form State
    const [mrpNumber, setMrpNumber] = useState('');
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [selectedPOId, setSelectedPOId] = useState('');
    const [customerPoNumber, setCustomerPoNumber] = useState('');
    const [poDate, setPoDate] = useState('');
    const [targetDate, setTargetDate] = useState('');
    const [remarks, setRemarks] = useState('');

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
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Helper: Extract mapped FG rows from any Customer PO object
    const extractFGRowsFromPO = (po: any, fgList = fgItemList, bomList = bomsList): FGRow[] => {
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

        return po.items.map((item: any) => {
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

            const qty = (item.quantity || 1) - (item.dispatchedQuantity || item.billedQuantity || 0);

            const itemPoDate = item.expectedDeliveryDate
                ? new Date(item.expectedDeliveryDate).toISOString().split('T')[0]
                : resolvedPoDate;

            let itemCommittedDate = '';
            let isFromOA = false;
            if (item.committedDeliveryDate) {
                itemCommittedDate = new Date(item.committedDeliveryDate).toISOString().split('T')[0];
                isFromOA = true;
            } else if (po.committedDispatchDate) {
                itemCommittedDate = new Date(po.committedDispatchDate).toISOString().split('T')[0];
                isFromOA = true;
            } else {
                itemCommittedDate = itemPoDate || resolvedCommittedDate;
            }

            return {
                fgItem: fgObj?._id || (typeof item.fgItem === 'object' ? item.fgItem?._id : item.fgItem) || '',
                fgItemName: fgObj?.name || pName || 'Finished Good',
                fgItemCode: fgObj?.code || pCode || '',
                description: item.description || fgObj?.description || fgObj?.descriptions || '',
                quantity: qty > 0 ? qty : Number(item.quantity) || 1,
                unit: item.unit || fgObj?.unit || 'PCS',
                poDeliveryDate: itemPoDate,
                targetDate: itemCommittedDate,
                isFromOA,
                customerPo: po._id,
                customerPoNumber: po.poNumber || '',
                customerName: cName,
                bomId: matchedBom?._id,
                bomNumber: matchedBom?.bomNumber || (fgObj?.bom?.length > 0 ? `BOM-${fgObj.code || fgObj.name}` : undefined)
            };
        });
    };

    // Helper: Sync multi-PO selected items into FG table without duplicating line items
    const syncMultiPORows = (poIds: string[], posList = incomingPOs, fgs = fgItemList, boms = bomsList) => {
        if (poIds.length === 0) {
            setFgRows([
                { fgItem: '', fgItemName: '', fgItemCode: '', description: '', quantity: 1, unit: 'PCS', poDeliveryDate: '', targetDate }
            ]);
            setCustomerName('');
            setCustomerPoNumber('');
            return;
        }

        const itemMap = new Map<string, FGRow>();
        let earliestDate = '';

        poIds.forEach((id) => {
            const po = posList.find((p) => String(p._id || p.id) === String(id));
            if (po) {
                const rows = extractFGRowsFromPO(po, fgs, boms);
                rows.forEach((row) => {
                    const itemKey = (row.fgItem || row.fgItemCode || row.fgItemName).toLowerCase().trim();
                    if (!itemKey) return;

                    if (!itemMap.has(itemKey)) {
                        itemMap.set(itemKey, {
                            ...row,
                            sourceBreakdown: [
                                {
                                    customerPo: row.customerPo,
                                    customerPoNumber: row.customerPoNumber || '',
                                    customerName: row.customerName || '',
                                    quantity: row.quantity
                                }
                            ],
                            sourceCustomerPOs: row.customerPoNumber ? [row.customerPoNumber] : []
                        });
                    } else {
                        const existing = itemMap.get(itemKey)!;
                        existing.quantity += row.quantity;
                        if (!existing.description && row.description) existing.description = row.description;
                        if (!existing.bomId && row.bomId) {
                            existing.bomId = row.bomId;
                            existing.bomNumber = row.bomNumber;
                        }

                        // Keep earliest targetDate & poDeliveryDate
                        if (row.targetDate) {
                            if (!existing.targetDate || row.targetDate < existing.targetDate) {
                                existing.targetDate = row.targetDate;
                            }
                        }
                        if (row.poDeliveryDate) {
                            if (!existing.poDeliveryDate || row.poDeliveryDate < existing.poDeliveryDate) {
                                existing.poDeliveryDate = row.poDeliveryDate;
                            }
                        }

                        // Track source breakdown
                        if (!existing.sourceBreakdown) existing.sourceBreakdown = [];
                        existing.sourceBreakdown.push({
                            customerPo: row.customerPo,
                            customerPoNumber: row.customerPoNumber || '',
                            customerName: row.customerName || '',
                            quantity: row.quantity
                        });

                        if (!existing.sourceCustomerPOs) existing.sourceCustomerPOs = [];
                        if (row.customerPoNumber && !existing.sourceCustomerPOs.includes(row.customerPoNumber)) {
                            existing.sourceCustomerPOs.push(row.customerPoNumber);
                        }

                        // Update combined PO & Customer labels
                        existing.customerPoNumber = existing.sourceCustomerPOs.join(', ');
                        if (row.customerName && existing.customerName && !existing.customerName.includes(row.customerName)) {
                            existing.customerName = `${existing.customerName}, ${row.customerName}`;
                        }
                    }
                });

                const cDate = po.committedDispatchDate || po.deliveryDate || po.date;
                if (cDate) {
                    const iso = new Date(cDate).toISOString().split('T')[0];
                    if (!earliestDate || iso < earliestDate) {
                        earliestDate = iso;
                    }
                }
            }
        });

        const mergedRows = Array.from(itemMap.values());
        if (mergedRows.length > 0) {
            setFgRows(mergedRows);
        }
        if (earliestDate) {
            setTargetDate(earliestDate);
        }

        const selectedDocs = posList.filter((p) => poIds.some((id) => String(id) === String(p._id || p.id)));
        const custNames = [...new Set(selectedDocs.map((p) => p.customerName || (typeof p.customer === 'object' ? p.customer?.name : '')).filter(Boolean))];
        setCustomerName(custNames.join(', '));
        setCustomerPoNumber(selectedDocs.map((p) => p.poNumber).filter(Boolean).join(', '));
    };

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                const isMulti = Boolean(initialData.isConsolidated || (initialData.customerPOs && initialData.customerPOs.length > 1));
                setPlanMode(isMulti ? 'consolidated' : 'single');
                if (isMulti && Array.isArray(initialData.customerPOs)) {
                    setSelectedMultiPoIds(initialData.customerPOs.map((p: any) => p.customerPo || p._id || p.id).filter(Boolean));
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
                if (Array.isArray(initialData.fgItems) && initialData.fgItems.length > 0) {
                    setFgRows(initialData.fgItems.map((f: any) => ({
                        fgItem: f.fgItem?._id || f.fgItem || '',
                        fgItemName: f.fgItemName || f.fgItem?.name || '',
                        fgItemCode: f.fgItemCode || f.fgItem?.code || '',
                        description: f.description || '',
                        quantity: Number(f.quantity) || 1,
                        unit: f.unit || 'PCS',
                        poDeliveryDate: f.poDeliveryDate ? new Date(f.poDeliveryDate).toISOString().split('T')[0] : '',
                        targetDate: f.targetDate ? new Date(f.targetDate).toISOString().split('T')[0] : '',
                        customerPo: f.customerPo || undefined,
                        customerPoNumber: f.customerPoNumber || '',
                        customerName: f.customerName || '',
                        bomId: f.bomId || '',
                        bomNumber: f.bomNumber || ''
                    })));
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

    const loadDropdownMasters = async () => {
        setLoading(true);
        try {
            const [custRes, fgRes, bomRes, poRes, mrpRes] = await Promise.allSettled([
                apiGet('/api/store/customer', token),
                apiGet('/api/store/fg-item', token),
                apiGet('/api/store/bom', token),
                apiGet('/api/sales/incoming-po', token),
                apiGet('/api/purchase/mrp/plans', token)
            ]);

            let loadedFGs: any[] = [];
            let loadedBOMs: any[] = [];
            let loadedPOs: any[] = [];

            if (custRes.status === 'fulfilled' && custRes.value) {
                setCustomerList(Array.isArray(custRes.value) ? custRes.value : (custRes.value.customers || custRes.value.data || []));
            }
            if (fgRes.status === 'fulfilled' && fgRes.value) {
                loadedFGs = Array.isArray(fgRes.value) ? fgRes.value : (fgRes.value.fgItems || fgRes.value.data || []);
                setFgItemList(loadedFGs);
            }
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
                    syncMultiPORows(preselectedPoIds, loadedPOs, loadedFGs, loadedBOMs);
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
    const handleSelectCustomerPO = (po: any) => {
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

        setSelectedPOId(po._id);
        setCustomerPoNumber(po.poNumber || '');
        setPoSearch(`PO #${po.poNumber}`);
        setIsPoDropdownOpen(false);

        if (po.poNumber) {
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

        const rows = extractFGRowsFromPO(po, fgItemList, bomsList);
        if (rows.length > 0) {
            setFgRows(rows);
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

    // Filtered FG Items for table row search
    const filteredFGItems = useMemo(() => {
        if (!fgSearchQuery.trim()) return fgItemList;
        const q = fgSearchQuery.toLowerCase().trim();
        return fgItemList.filter(
            (f: any) =>
                (f.name && f.name.toLowerCase().includes(q)) ||
                (f.code && f.code.toLowerCase().includes(q)) ||
                (f.description && f.description.toLowerCase().includes(q))
        );
    }, [fgItemList, fgSearchQuery]);

    // Handle Manual FG Selection in Table Row
    const handleSelectFGForRow = (index: number, selected: any) => {
        if (!selected) return;

        const matchedBom = bomsList.find(
            (b) =>
                (selected &&
                    (b.productName?.toLowerCase() === selected.name?.toLowerCase() ||
                        b.productCode === selected.code))
        );
        const hasEmbeddedBom = selected && Array.isArray(selected.bom) && selected.bom.length > 0;
        const bomNum = matchedBom?.bomNumber || (hasEmbeddedBom ? `BOM-${selected.code || selected.name}` : undefined);
        const bomId = matchedBom?._id || (hasEmbeddedBom ? selected._id : undefined);

        const updated = [...fgRows];
        updated[index] = {
            ...updated[index],
            fgItem: selected._id,
            fgItemName: selected.name || '',
            fgItemCode: selected.code || '',
            description: selected.description || selected.descriptions || updated[index].description || '',
            unit: selected.unit || 'PCS',
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
        updated[index] = {
            ...updated[index],
            [field]: val
        };
        setFgRows(updated);
    };

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

        setSubmitting(true);
        try {
            const isConsolidated = planMode === 'consolidated' || selectedMultiPoIds.length > 1;
            const payload: any = {
                mrpNumber,
                isConsolidated,
                targetDate,
                remarks,
                fgItems: validItems
            };

            if (isConsolidated && selectedMultiPoIds.length > 0) {
                payload.customerPoIds = selectedMultiPoIds;
                const contributingPOs = incomingPOs.filter((p) =>
                    selectedMultiPoIds.some((id) => String(id) === String(p._id || p.id))
                );
                payload.customerPOs = contributingPOs.map((p) => ({
                    customerPo: p._id,
                    customerPoNumber: p.poNumber || '',
                    customer: p.customer?._id || p.customer,
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl w-full max-w-6xl xl:max-w-7xl max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
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
                        /* Consolidated Multi-PO Selection Panel */
                        <div className="bg-gradient-to-br from-indigo-50/90 via-purple-50/50 to-slate-50 dark:from-indigo-950/40 dark:via-purple-950/20 dark:to-slate-900 p-4 rounded-2xl border border-indigo-200 dark:border-indigo-800/80 space-y-3">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                    <Boxes className="text-indigo-600 dark:text-indigo-400" size={16} />
                                    <div>
                                        <h3 className="text-xs font-black text-indigo-950 dark:text-indigo-200 uppercase tracking-wide">
                                            Select Customer POs to Consolidate
                                        </h3>
                                        <p className="text-[11px] text-slate-500">
                                            Check 2 or more customer POs. All FG requirements will be consolidated into a single procurement demand.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
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
                                </div>
                            </div>

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

                        {/* Table */}
                        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-visible shadow-xs bg-white dark:bg-slate-900">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 uppercase border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="px-3 py-3 w-10 text-center">#</th>
                                        <th className="px-3 py-3 min-w-[220px]">Finished Goods (FG) Item</th>
                                        <th className="px-3 py-3 min-w-[150px]">Description</th>
                                        <th className="px-3 py-3 w-24 text-center">Qty</th>
                                        <th className="px-3 py-3 w-16 text-center">Unit</th>
                                        <th className="px-3 py-3 min-w-[125px]">PO Date</th>
                                        <th className="px-3 py-3 min-w-[135px]">Committed Date</th>
                                        <th className="px-3 py-3 w-10 text-right"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                    {fgRows.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                                            <td className="px-3 py-3 text-slate-400 font-bold text-center">{idx + 1}</td>

                                            {/* Keyword-Searchable FG Combobox */}
                                            <td className="px-3 py-3 relative">
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        placeholder="Type to search FG Item..."
                                                        value={
                                                            activeFGSearchIdx === idx
                                                                ? fgSearchQuery
                                                                : row.fgItemName
                                                                ? `${row.fgItemName}${row.description ? ` - ${row.description}` : ''}`
                                                                : ''
                                                        }
                                                        onFocus={() => {
                                                            setActiveFGSearchIdx(idx);
                                                            setFgSearchQuery(row.fgItemName || '');
                                                        }}
                                                        onChange={(e) => {
                                                            setFgSearchQuery(e.target.value);
                                                            handleRowChange(idx, 'fgItemName', e.target.value);
                                                        }}
                                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-2xs"
                                                    />
                                                    <ChevronDown
                                                        size={14}
                                                        className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none"
                                                    />
                                                </div>

                                                {row.bomNumber && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1 mr-2">
                                                        <CheckCircle2 size={11} /> BOM Linked: {row.bomNumber}
                                                    </span>
                                                )}

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
                                                                    title={`${b.customerName ? `${b.customerName} — ` : ''}${b.quantity} ${row.unit}`}
                                                                >
                                                                    <span>{b.customerPoNumber}:</span>
                                                                    <span className="font-extrabold text-blue-900 dark:text-blue-100">{b.quantity} {row.unit}</span>
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
                                                            <span className="text-[10px] text-slate-500 font-medium">
                                                                {row.customerName}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : null}

                                                {/* Search Results Dropdown */}
                                                {activeFGSearchIdx === idx && (
                                                    <div
                                                        ref={fgDropdownRef}
                                                        className="absolute left-3 right-3 mt-1 max-h-52 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 p-1 space-y-0.5"
                                                    >
                                                        {filteredFGItems.length === 0 ? (
                                                            <div className="p-3 text-center text-xs text-slate-400">
                                                                No FG master found
                                                            </div>
                                                        ) : (
                                                            filteredFGItems.map((fg: any) => {
                                                                const matchedBom = bomsList.find(
                                                                    (b) =>
                                                                        b.productName?.toLowerCase() ===
                                                                            fg.name?.toLowerCase() ||
                                                                        b.productCode === fg.code
                                                                );
                                                                const hasBom =
                                                                    matchedBom ||
                                                                    (Array.isArray(fg.bom) && fg.bom.length > 0);

                                                                return (
                                                                    <button
                                                                        key={fg._id}
                                                                        type="button"
                                                                        onClick={() => handleSelectFGForRow(idx, fg)}
                                                                        className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between cursor-pointer"
                                                                    >
                                                                        <div>
                                                                            <span className="font-bold text-slate-900 dark:text-white block">
                                                                                {fg.name}
                                                                            </span>
                                                                            <span className="text-[10px] text-slate-400">
                                                                                {(fg.description || fg.descriptions) ? `${fg.description || fg.descriptions} • ` : ''}Unit: {fg.unit || 'PCS'}
                                                                            </span>
                                                                        </div>
                                                                        <span
                                                                            className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase ${
                                                                                hasBom
                                                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                                                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                                                            }`}
                                                                        >
                                                                            {hasBom ? 'BOM Attached' : 'No BOM'}
                                                                        </span>
                                                                    </button>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Description */}
                                            <td className="px-3 py-3">
                                                <input
                                                    type="text"
                                                    placeholder="Specs / notes..."
                                                    value={row.description}
                                                    onChange={(e) => handleRowChange(idx, 'description', e.target.value)}
                                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                />
                                            </td>

                                            {/* Quantity */}
                                            <td className="px-3 py-3 text-center">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={row.quantity}
                                                    onChange={(e) =>
                                                        handleRowChange(idx, 'quantity', Math.max(1, Number(e.target.value)))
                                                    }
                                                    required
                                                    className="w-full px-2 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-center font-bold text-indigo-600 dark:text-indigo-400 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                />
                                            </td>

                                            {/* Unit */}
                                            <td className="px-3 py-3 text-center text-slate-600 dark:text-slate-400 font-bold">
                                                {row.unit || 'PCS'}
                                            </td>

                                            {/* Row PO Date */}
                                            <td className="px-3 py-3">
                                                <input
                                                    type="date"
                                                    value={row.poDeliveryDate || ''}
                                                    onChange={(e) => handleRowChange(idx, 'poDeliveryDate', e.target.value)}
                                                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                />
                                            </td>

                                            {/* Row Committed Date */}
                                            <td className="px-3 py-3">
                                                <input
                                                    type="date"
                                                    value={row.targetDate}
                                                    onChange={(e) => handleRowChange(idx, 'targetDate', e.target.value)}
                                                    className={`w-full px-2.5 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                                                        row.isFromOA
                                                            ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/20 font-bold text-emerald-900 dark:text-emerald-200'
                                                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white'
                                                    }`}
                                                />
                                                {row.isFromOA && (
                                                    <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                                                        OA Committed
                                                    </span>
                                                )}
                                            </td>

                                            {/* Delete Row */}
                                            <td className="px-3 py-3 text-right">
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
                                    ))}
                                </tbody>
                            </table>
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
        </div>
    );
}
