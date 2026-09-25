import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
    FileCheck, Plus, Search, Calendar, User, Eye, CheckCircle2, Clock, Filter, 
    ArrowRight, X, Building2, Printer, LayoutGrid, List, Edit2, Trash2, UserCheck, 
    History, ShieldCheck, Download, ShoppingBag, ShoppingCart, Truck, IndianRupee, 
    FileText, CheckCircle, PackageCheck, Lock, Upload, Paperclip, ExternalLink, Image as ImageIcon,
    AlertTriangle, Package, Layers, RotateCcw, Tag, Settings, SlidersHorizontal, CheckSquare, Square,
    ChevronDown, ChevronUp
} from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/src/lib/api';
import SearchableSelect from '../SearchableSelect';
import SearchableMultiSelect from '../SearchableMultiSelect';
import OrderAcknowledgementModal from '../modals/OrderAcknowledgementModal';
import MRPModal from '../modals/MRPModal';
import MRPDetailsModal from '../modals/MRPDetailsModal';
import CustomerPOItemWiseView from '../views/CustomerPOItemWiseView';
import { generateFrontendOrderAcknowledgementPDF } from '@/src/utils/generateOrderAcknowledgementPDF';
import { getCurrencySymbol, CURRENCY_OPTIONS, normalizeCurrencyCode } from '@/src/utils/currencyHelper';
import { useExchangeRates } from '@/src/hooks/useExchangeRates';
import { useTimeLockPolicy } from '@/src/hooks/useTimeLockPolicy';

interface CustomerPoTabProps {
    token: string | null;
    onError: (msg: string) => void;
    onSuccess: (msg: string) => void;
}

export default function CustomerPoTab({ token, onError, onSuccess }: CustomerPoTabProps) {
    const { exchangeRates, convertToINR } = useExchangeRates(token);
    const [loading, setLoading] = useState(true);
    const [poList, setPoList] = useState<any[]>([]);
    const [quotations, setQuotations] = useState<any[]>([]);
    const [fgItems, setFgItems] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [companyInfo, setCompanyInfo] = useState<any>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('All');
    const [filterCustomers, setFilterCustomers] = useState<string[]>([]);
    const [excludeMrpDone, setExcludeMrpDone] = useState(false);
    const [filterDateType, setFilterDateType] = useState<'entry' | 'committed' | 'either'>('entry');
    const [filterMonth, setFilterMonth] = useState<string>(''); // format: 'YYYY-MM'
    const [viewMode, setViewMode] = useState<'po' | 'items'>('po');
    const [showDashboard, setShowDashboard] = useState<boolean>(false);
    const [showFilters, setShowFilters] = useState<boolean>(false);

    const customerOptions = useMemo(() => {
        return (Array.isArray(customers) ? customers : []).map((c: any) => ({
            value: (c._id || c.id)?.toString(),
            label: c.name || c.companyName || 'Customer',
            subLabel: c.code ? `Code: ${c.code}` : undefined
        })).filter(o => o.value);
    }, [customers]);

    const uniquePoItemsCount = useMemo(() => {
        const itemKeys = new Set<string>();
        (Array.isArray(poList) ? poList : []).forEach(po => {
            if (po.status === 'Cancelled') return;
            (po.items || []).forEach((it: any) => {
                const fgObj = it.fgItem && typeof it.fgItem === 'object' ? it.fgItem : null;
                const fgId = fgObj?._id || (typeof it.fgItem === 'string' ? it.fgItem : null);
                const rawName = (it.productName || fgObj?.name || '').trim();
                const key = fgId || (rawName ? `name_${rawName.toLowerCase()}` : null);
                if (key) itemKeys.add(key.toString());
            });
        });
        return itemKeys.size;
    }, [poList]);

    // Create / Edit Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingPo, setEditingPo] = useState<any | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [selectedQuoteId, setSelectedQuoteId] = useState<string>('');
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    const clearError = (field: string) => {
        setFormErrors(prev => {
            const next = { ...prev };
            delete next[field];
            delete next.server_error;
            return next;
        });
    };

    // Order Acknowledgement Modal State
    const [acknowledgingPo, setAcknowledgingPo] = useState<any | null>(null);

    // Live 1-second ticking timer for dynamic edit/delete countdown
    const [nowTime, setNowTime] = useState(Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNowTime(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const { getPolicyHours } = useTimeLockPolicy(token);

    const getRemainingEditSeconds = (createdAt: string | Date | undefined) => {
        if (!createdAt) return 0;
        const policyHours = getPolicyHours('customerPo');
        if (policyHours === -1) return Infinity;
        if (policyHours <= 0) return 0;
        const created = new Date(createdAt).getTime();
        if (isNaN(created)) return 0;
        const elapsed = Math.floor((nowTime - created) / 1000);
        const limit = policyHours * 3600;
        return Math.max(0, limit - elapsed);
    };

    const isEditAllowed = (createdAt: string | Date | undefined) => {
        const policyHours = getPolicyHours('customerPo');
        if (policyHours === -1) return true;
        if (policyHours <= 0) return false;
        return getRemainingEditSeconds(createdAt) > 0;
    };

    const formatRemainingTime = (totalSeconds: number) => {
        if (totalSeconds === Infinity) return 'Unlimited';
        if (totalSeconds <= 0) return '00:00:00';
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const handleDeletePo = async (po: any) => {
        if (!isEditAllowed(po.createdAt || po.date)) {
            const hrs = getPolicyHours('customerPo');
            onError(hrs <= 0 ? "Customer PO is locked immediately upon creation by company policy" : `Customer PO can only be deleted within ${hrs} hours of creation`);
            return;
        }
        if (!window.confirm(`Are you sure you want to delete Customer PO #${po.poNumber}?`)) return;

        try {
            await apiDelete(`/api/sales/incoming-po/${po._id}`, token);
            onSuccess(`Customer PO #${po.poNumber} deleted successfully`);
            fetchData();
        } catch (err: any) {
            onError(err.message || "Failed to delete Customer PO");
        }
    };

    // Document / Photo Attachment State
    const [poFile, setPoFile] = useState<File | null>(null);
    const [poFilePreview, setPoFilePreview] = useState<string | null>(null);
    const [existingPdf, setExistingPdf] = useState<string | null>(null);
    const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [viewingMrpPlan, setViewingMrpPlan] = useState<any | null>(null);

    const [newPo, setNewPo] = useState({
        poNumber: '',
        quotationReference: '',
        customer: '',
        customerName: '',
        currency: 'INR',
        date: new Date().toISOString().slice(0, 10),
        transportationMethod: 'Road Freight',
        transportationCharges: 0,
        remarks: '',
        status: 'Received',
        items: [] as any[],
        subtotal: 0,
        taxAmount: 0,
        totalAmount: 0
    });

    // View Modal State (With Dispatch History & DC/Invoice Timeline)
    const [selectedPo, setSelectedPo] = useState<any | null>(null);
    const [timelineData, setTimelineData] = useState<{ deliveryChallans: any[]; invoices: any[] }>({ deliveryChallans: [], invoices: [] });
    const [timelineLoading, setTimelineLoading] = useState(false);
    const [activeViewTab, setActiveViewTab] = useState<'overview' | 'dispatch'>('overview');


    const [priceLists, setPriceLists] = useState<any[]>([]);

    const fetchData = async () => {
        if (!token) return;
        try {
            setLoading(true);
            const [poRes, quotRes, fgRes, custRes, compRes, priceRes] = await Promise.all([
                apiGet('/api/sales/incoming-po', token).catch(() => ({ pos: [] })),
                apiGet('/api/sales/quotation', token).catch(() => ({ quotations: [] })),
                apiGet('/api/store/fg-item', token).catch(() => []),
                apiGet('/api/store/customer', token).catch(() => []),
                apiGet('/api/store/company-info', token).catch(() => null),
                apiGet('/api/sales/price-list', token).catch(() => ({ priceLists: [] }))
            ]);

            const listPOs = Array.isArray(poRes?.pos) ? poRes.pos : (Array.isArray(poRes?.data) ? poRes.data : (Array.isArray(poRes) ? poRes : []));
            const listQuotes = Array.isArray(quotRes?.quotations) ? quotRes.quotations : (Array.isArray(quotRes?.data) ? quotRes.data : (Array.isArray(quotRes) ? quotRes : []));
            const listFgs = Array.isArray(fgRes?.fgItems) ? fgRes.fgItems : (Array.isArray(fgRes) ? fgRes : []);
            const listCusts = Array.isArray(custRes?.customers) ? custRes.customers : (Array.isArray(custRes) ? custRes : []);
            const listPrices = Array.isArray(priceRes?.priceLists) ? priceRes.priceLists : (Array.isArray(priceRes?.data) ? priceRes.data : (Array.isArray(priceRes) ? priceRes : []));

            setPoList(listPOs);
            setQuotations(listQuotes);
            setFgItems(listFgs);
            setCustomers(listCusts);
            setPriceLists(listPrices);
            setCompanyInfo(compRes?.companyInfo || compRes);
        } catch (err: any) {
            console.error("Fetch Customer POs error:", err);
            onError(err.message || "Failed to fetch Customer POs");
        } finally {
            setLoading(false);
        }
    };

    const fgOptions = useMemo(() => {
        return (Array.isArray(fgItems) ? fgItems : [])
            .map(m => {
                const pEntry = (Array.isArray(priceLists) ? priceLists : []).find((p: any) => {
                    const pFgId = typeof p.fgItem === 'string' ? p.fgItem : (p.fgItem?._id || p.fgItem?.id);
                    return pFgId?.toString() === (m._id || m.id)?.toString();
                });
                const pCurrency = pEntry?.currency || m.currency || 'INR';
                const rate = pEntry && pEntry.price != null ? Number(pEntry.price) : (Number(m.sellingPrice || m.unitPrice || 0));
                const priceText = rate > 0 ? ` — ${getCurrencySymbol(pCurrency)}${rate} (${pCurrency})` : '';
                const desc = m.description || m.descriptions || '';
                const descText = desc ? ` — ${desc}` : '';
                return {
                    value: (m._id || m.id)?.toString(),
                    label: `${m.name || m.itemName || 'FG Item'}${descText}${priceText}`,
                    rate: rate,
                    raw: m,
                    priceEntry: pEntry
                };
            })
            .filter(o => o.value);
    }, [fgItems, priceLists]);

    useEffect(() => {
        fetchData();
    }, [token]);

    const fetchPoTimeline = async (poId: string) => {
        if (!token || !poId) return;
        try {
            setTimelineLoading(true);
            const res = await apiGet(`/api/sales/incoming-po/${poId}/dispatch-history`, token);
            const dcs = res.data?.deliveryChallans || res.deliveryChallans || [];
            const invs = res.data?.invoices || res.invoices || [];
            setTimelineData({
                deliveryChallans: dcs,
                invoices: invs
            });

            if (selectedPo && Array.isArray(selectedPo.items)) {
                const totalOrd = selectedPo.items.reduce((acc: number, cur: any) => acc + Number(cur.quantity || 0), 0);
                const totalDisp = dcs.reduce((acc: number, dc: any) => acc + (dc.items || []).reduce((iAcc: number, it: any) => iAcc + Number(it.quantity || 0), 0), 0);
                const totalInv = invs.reduce((acc: number, inv: any) => acc + (inv.items || []).reduce((iAcc: number, it: any) => iAcc + Number(it.quantity || 0), 0), 0);
                const effectiveFulfilled = Math.max(totalDisp, totalInv);

                if (totalOrd > 0 && effectiveFulfilled > 0) {
                    if (effectiveFulfilled >= totalOrd && selectedPo.status !== 'Completed') {
                        handleStatusChange(selectedPo._id, 'Completed');
                    } else if (effectiveFulfilled < totalOrd && selectedPo.status !== 'Partially Dispatched' && selectedPo.status !== 'Completed') {
                        handleStatusChange(selectedPo._id, 'Partially Dispatched');
                    }
                }
            }
        } catch (err: any) {
            console.error("Fetch PO Timeline error:", err);
        } finally {
            setTimelineLoading(false);
        }
    };

    useEffect(() => {
        if (selectedPo && selectedPo._id) {
            fetchPoTimeline(selectedPo._id);
        } else {
            setTimelineData({ deliveryChallans: [], invoices: [] });
        }
    }, [selectedPo]);

    const generatePoNo = () => {
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        return `CPO-${dateStr}-${randomNum}`;
    };

    const getUserName = (userObj: any) => {
        if (!userObj) return 'System User';
        if (typeof userObj === 'string') return userObj;
        return userObj.name || userObj.email || 'User';
    };

    const handleOpenCreateModal = () => {
        setEditingPo(null);
        setSelectedQuoteId('');
        setFormErrors({});
        setPoFile(null);
        setPoFilePreview(null);
        setExistingPdf(null);
        setExistingPhotos([]);
        setNewPo({
            poNumber: generatePoNo(),
            quotationReference: '',
            customer: '',
            customerName: '',
            currency: 'INR',
            date: new Date().toISOString().slice(0, 10),
            transportationMethod: 'Road Freight',
            transportationCharges: 0,
            remarks: '',
            status: 'Received',
            items: [{ fgItem: '', hsnCode: '', productName: '', description: '', quantity: 1, unit: 'PCS', rate: 0, taxRate: 18, expectedDeliveryDate: '', amount: 0 }],
            subtotal: 0,
            taxAmount: 0,
            totalAmount: 0
        });
        setIsCreateModalOpen(true);
    };

    const handleOpenEditModal = (po: any) => {
        if (!isEditAllowed(po.createdAt || po.date)) {
            const hrs = getPolicyHours('customerPo');
            onError(hrs <= 0 ? "Customer PO is locked immediately upon creation by company policy" : `Customer PO can only be edited or deleted within ${hrs} hours of creation`);
            return;
        }
        setEditingPo(po);
        setSelectedQuoteId(po.quotationReference?._id || po.quotationReference || '');
        setFormErrors({});
        setPoFile(null);
        setPoFilePreview(null);
        setExistingPdf(po.pdf || null);
        setExistingPhotos(Array.isArray(po.photos) ? po.photos : (po.photos ? [po.photos] : []));
        setNewPo({
            poNumber: po.poNumber || '',
            quotationReference: po.quotationReference?._id || po.quotationReference || '',
            customer: po.customer?._id || po.customer || '',
            customerName: po.customerName || po.customer?.name || '',
            currency: po.currency || 'INR',
            date: po.date ? new Date(po.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
            transportationMethod: po.transportationMethod || 'Road Freight',
            transportationCharges: po.transportationCharges || 0,
            remarks: po.remarks || '',
            status: po.status || 'Received',
            items: Array.isArray(po.items) && po.items.length > 0
                ? po.items.map((it: any) => ({
                    fgItem: it.fgItem?._id || it.fgItem || '',
                    productName: it.productName || it.fgItem?.name || '',
                    hsnCode: it.hsnCode || '',
                    description: it.description || '',
                    quantity: it.quantity || 1,
                    unit: it.unit || 'PCS',
                    rate: it.rate || 0,
                    taxRate: it.taxRate != null ? it.taxRate : 18,
                    expectedDeliveryDate: it.expectedDeliveryDate ? new Date(it.expectedDeliveryDate).toISOString().slice(0, 10) : '',
                    amount: it.amount || (it.quantity * it.rate * 1.18)
                }))
                : [{ fgItem: '', hsnCode: '', productName: '', description: '', quantity: 1, unit: 'PCS', rate: 0, taxRate: 18, expectedDeliveryDate: '', amount: 0 }],
            subtotal: po.subtotal || 0,
            taxAmount: po.taxAmount || 0,
            totalAmount: po.totalAmount || 0
        });
        setIsCreateModalOpen(true);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 15 * 1024 * 1024) {
            onError("File size exceeds 15MB limit");
            return;
        }

        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
        const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
        const isImg = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(file.name);

        if (!isPdf && !isImg && !validTypes.includes(file.type)) {
            onError("Please upload a PDF document or JPEG/PNG image");
            return;
        }

        setPoFile(file);
        if (isImg) {
            const reader = new FileReader();
            reader.onload = () => {
                setPoFilePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        } else {
            setPoFilePreview(null);
        }
    };

    const handleSelectQuotation = (quotId: string) => {
        setSelectedQuoteId(quotId);
        setFormErrors({});
        const selectedQuot = (Array.isArray(quotations) ? quotations : []).find((q: any) => q._id === quotId);
        if (!selectedQuot) return;

        const custId = selectedQuot.customer?._id || selectedQuot.customer;
        const matchedCust = (customers || []).find((c: any) => (c._id || c.id)?.toString() === custId?.toString());

        const autoItems = (selectedQuot.items || []).map((it: any) => {
            const qty = Number(it.quantity) || 1;
            const fgId = (it.fgItem?._id || it.fgItem || '').toString();
            const matchedFg = (fgItems || []).find((m: any) => (m._id || m.id)?.toString() === fgId);
            const pEntry = (Array.isArray(priceLists) ? priceLists : []).find((p: any) => {
                const pFgId = typeof p.fgItem === 'string' ? p.fgItem : (p.fgItem?._id || p.fgItem?.id);
                return pFgId?.toString() === fgId;
            });
            const rate = Number(it.rate || it.unitPrice) > 0 
                ? Number(it.rate || it.unitPrice) 
                : (pEntry && pEntry.price != null ? Number(pEntry.price) : Number(matchedFg?.sellingPrice || 0));
            const tax = it.taxRate != null 
                ? Number(it.taxRate) 
                : (pEntry && pEntry.taxRate != null ? Number(pEntry.taxRate) : Number(matchedFg?.taxRate || 18));
            const hsn = it.hsnCode || matchedFg?.hsnCode || pEntry?.hsnCode || '';
            const lineSub = qty * rate;
            const lineTax = lineSub * (tax / 100);

            return {
                fgItem: fgId,
                productName: matchedFg?.name || it.fgItem?.name || it.productName || 'FG Item',
                hsnCode: hsn,
                description: it.description || matchedFg?.description || '',
                quantity: qty,
                unit: it.unit || matchedFg?.unit || 'PCS',
                rate: rate,
                taxRate: tax,
                expectedDeliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                amount: lineSub + lineTax
            };
        });

        const sub = autoItems.reduce((acc: number, cur: any) => acc + (cur.quantity * cur.rate), 0);
        const taxSum = autoItems.reduce((acc: number, cur: any) => acc + (cur.quantity * cur.rate * (cur.taxRate / 100)), 0);

        setNewPo(prev => ({
            ...prev,
            quotationReference: quotId,
            customer: custId || '',
            customerName: selectedQuot.customerName || matchedCust?.name || '',
            currency: selectedQuot.currency || prev.currency || 'INR',
            items: autoItems.length > 0 ? autoItems : [{ fgItem: '', hsnCode: '', productName: '', description: '', quantity: 1, unit: 'PCS', rate: 0, taxRate: 18, expectedDeliveryDate: '', amount: 0 }],
            subtotal: sub,
            taxAmount: taxSum,
            totalAmount: sub + taxSum + Number(prev.transportationCharges || 0)
        }));
    };

    const handleSelectCustomer = (custId: string) => {
        clearError('customer');
        const selectedCust = (Array.isArray(customers) ? customers : []).find((c: any) => (c._id || c.id)?.toString() === custId?.toString());
        if (selectedCust) {
            setNewPo(prev => ({
                ...prev,
                customer: custId,
                customerName: selectedCust.name || selectedCust.companyName || ''
            }));
        } else {
            setNewPo(prev => ({ ...prev, customer: custId }));
        }
    };

    const handleAddItem = () => {
        setNewPo(prev => ({
            ...prev,
            items: [...prev.items, { fgItem: '', hsnCode: '', productName: '', description: '', quantity: 1, unit: 'PCS', rate: 0, taxRate: 18, expectedDeliveryDate: '', amount: 0 }]
        }));
    };

    const handleRemoveItem = (index: number) => {
        const updated = newPo.items.filter((_, i) => i !== index);
        recalculateTotals(updated);
    };

    const handleItemChange = (index: number, field: string, value: any) => {
        clearError(`item_${index}_${field}`);
        const updated = [...newPo.items];
        if (field === 'fgItem') {
            const selectedFg = (Array.isArray(fgItems) ? fgItems : []).find((m: any) => (m._id || m.id)?.toString() === value?.toString());
            const autoName = selectedFg?.name || selectedFg?.itemName || '';
            const autoDesc = selectedFg?.description || selectedFg?.details || autoName;
            const autoUnit = selectedFg?.unit || selectedFg?.uom || 'PCS';

            // Lookup price & HSN from Sales Price List or FG Item
            const priceEntry = (Array.isArray(priceLists) ? priceLists : []).find((p: any) => {
                const pFgId = typeof p.fgItem === 'string' ? p.fgItem : (p.fgItem?._id || p.fgItem?.id);
                return pFgId?.toString() === value?.toString();
            });

            const autoRate = priceEntry && priceEntry.price != null ? Number(priceEntry.price) : (Number(selectedFg?.sellingPrice || selectedFg?.unitPrice || selectedFg?.rate || 0));
            const autoTax = priceEntry && priceEntry.taxRate != null ? Number(priceEntry.taxRate) : (Number(selectedFg?.taxRate || selectedFg?.gstRate || 18));
            const autoHsn = (selectedFg as any)?.hsnCode || (selectedFg as any)?.hsn || priceEntry?.hsnCode || '';

            updated[index] = {
                ...updated[index],
                fgItem: value,
                productName: autoName,
                hsnCode: autoHsn || updated[index].hsnCode || '',
                description: autoDesc,
                unit: autoUnit,
                rate: autoRate,
                taxRate: autoTax
            };
        } else {
            updated[index] = { ...updated[index], [field]: value };
        }

        recalculateTotals(updated);
    };

    const recalculateTotals = (itemsList: any[]) => {
        let sub = 0;
        let taxSum = 0;

        const updatedItems = itemsList.map(it => {
            const qty = Number(it.quantity) || 0;
            const rate = Number(it.rate) || 0;
            const taxPct = Number(it.taxRate) || 0;
            const lineSub = qty * rate;
            const lineTax = lineSub * (taxPct / 100);
            const lineTotal = lineSub + lineTax;

            sub += lineSub;
            taxSum += lineTax;

            return {
                ...it,
                amount: lineTotal,
                taxAmount: lineTax
            };
        });

        const grand = sub + taxSum + Number(newPo.transportationCharges || 0);

        setNewPo(prev => ({
            ...prev,
            items: updatedItems,
            subtotal: sub,
            taxAmount: taxSum,
            totalAmount: grand
        }));
    };

    const handleStatusChange = async (poId: string, newStatus: string) => {
        try {
            const res = await apiPut(`/api/sales/incoming-po/${poId}`, { status: newStatus }, token);
            onSuccess(`Customer PO status updated to ${newStatus}`);
            const updated = res.incomingPO || res.data || res;
            if (selectedPo && selectedPo._id === poId) {
                setSelectedPo(updated);
            }
            fetchData();
        } catch (err: any) {
            onError(err.message || "Failed to update PO status");
        }
    };





    const handleCreatePoSubmit = async () => {
        const errors: Record<string, string> = {};
        if (!newPo.poNumber || !newPo.poNumber.trim()) {
            errors.poNumber = "Customer PO Number is required";
        }
        if (!newPo.customer) {
            errors.customer = "Please select Customer from Master list";
        }
        if (!newPo.date) {
            errors.date = "PO Date is required";
        }
        if (!newPo.items || newPo.items.length === 0) {
            errors.items = "At least one item is required";
        } else {
            newPo.items.forEach((it, idx) => {
                if (!it.fgItem) {
                    errors[`item_${idx}_fgItem`] = "Select FG Item";
                }
                if (!it.quantity || Number(it.quantity) <= 0) {
                    errors[`item_${idx}_quantity`] = "Qty > 0 required";
                }
                if (it.rate === undefined || it.rate === null || Number(it.rate) <= 0) {
                    errors[`item_${idx}_rate`] = "Rate > 0 required";
                }
            });
        }

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            setTimeout(() => {
                const firstErr = document.querySelector('[data-has-error="true"]');
                if (firstErr) {
                    firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    (firstErr.querySelector('input, select, button') as HTMLElement)?.focus?.();
                }
            }, 50);
            return;
        }

        setFormErrors({});
        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('poNumber', newPo.poNumber.trim());
            formData.append('customer', newPo.customer);
            formData.append('customerName', newPo.customerName);
            formData.append('currency', newPo.currency || 'INR');
            if (newPo.quotationReference) {
                formData.append('quotationReference', newPo.quotationReference);
            }
            formData.append('date', newPo.date);
            formData.append('transportationMethod', newPo.transportationMethod);
            formData.append('transportationCharges', String(newPo.transportationCharges || 0));
            formData.append('remarks', newPo.remarks || '');
            formData.append('status', newPo.status || 'Received');
            formData.append('subtotal', String(newPo.subtotal || 0));
            formData.append('taxAmount', String(newPo.taxAmount || 0));
            formData.append('totalAmount', String(newPo.totalAmount || 0));
            formData.append('items', JSON.stringify(newPo.items));

            if (poFile) {
                const isPdf = poFile.name.toLowerCase().endsWith('.pdf') || poFile.type === 'application/pdf';
                if (isPdf) {
                    formData.append('pdf', poFile);
                } else {
                    formData.append('photos', poFile);
                    formData.append('document', poFile);
                }
            }

            if (editingPo && editingPo._id) {
                if (existingPdf) formData.append('existingPdf', existingPdf);
                if (existingPhotos.length > 0) formData.append('existingPhotos', JSON.stringify(existingPhotos));
                await apiPut(`/api/sales/incoming-po/${editingPo._id}`, formData, token);
                onSuccess(`Customer PO #${newPo.poNumber} updated successfully`);
            } else {
                await apiPost('/api/sales/incoming-po', formData, token);
                onSuccess("Customer PO created successfully");
            }
            setIsCreateModalOpen(false);
            setEditingPo(null);
            setPoFile(null);
            setPoFilePreview(null);
            fetchData();
        } catch (err: any) {
            setFormErrors({ server_error: err.message || "Failed to save Customer PO" });
        } finally {
            setSubmitting(false);
        }
    };

    const filteredPoList = useMemo(() => {
        return (Array.isArray(poList) ? poList : []).filter((p: any) => {
            const matchSearch =
                !searchTerm ||
                (p.poNumber && p.poNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (p.customerName && p.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (p.customer?.name && p.customer.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (p.quotationReference && p.quotationReference.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (p.items && p.items.some((i: any) => (i.productName || i.description || i.fgItem?.name || '').toLowerCase().includes(searchTerm.toLowerCase())));

            const matchStatus = filterStatus === 'All' || p.status === filterStatus;

            let matchCustomer = true;
            if (filterCustomers.length > 0 && !filterCustomers.includes('All') && !filterCustomers.includes('all')) {
                const custId = (p.customer?._id || p.customer)?.toString();
                matchCustomer = filterCustomers.includes(custId);
            }

            const matchMrpDone = !excludeMrpDone || (p.status !== 'MRP Done' && p.status !== 'Partially Dispatched' && p.status !== 'Completed');

            let matchDate = true;
            if (filterMonth) {
                const getYearMonth = (val: any) => {
                    if (!val) return '';
                    const d = new Date(val);
                    if (isNaN(d.getTime())) return '';
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                };

                const entryYm = getYearMonth(p.date || p.createdAt || p.poDate);
                const commitYm = getYearMonth(p.committedDispatchDate || p.committedDeliveryDate || p.deliveryDate);

                if (filterDateType === 'entry') {
                    matchDate = entryYm === filterMonth;
                } else if (filterDateType === 'committed') {
                    matchDate = commitYm === filterMonth;
                } else {
                    matchDate = entryYm === filterMonth || commitYm === filterMonth;
                }
            }

            return matchSearch && matchStatus && matchCustomer && matchMrpDone && matchDate;
        });
    }, [poList, searchTerm, filterStatus, filterCustomers, excludeMrpDone, filterMonth, filterDateType]);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filterStatus !== 'All') count++;
        if (filterCustomers.length > 0 && !filterCustomers.includes('All') && !filterCustomers.includes('all')) count++;
        if (excludeMrpDone) count++;
        if (filterMonth) count++;
        if (searchTerm.trim()) count++;
        return count;
    }, [filterStatus, filterCustomers, excludeMrpDone, filterMonth, searchTerm]);

    const hasActiveFilters = activeFilterCount > 0;

    // Scoped POs based on active search, customer, excludeMrpDone, and date/month filters (used for live status dropdown counts)
    const scopedPoList = useMemo(() => {
        return (Array.isArray(poList) ? poList : []).filter((po: any) => {
            const matchSearch =
                !searchTerm ||
                (po.poNumber && po.poNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (po.customerName && po.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (po.quotationReference && po.quotationReference.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (po.items && po.items.some((i: any) => (i.productName || i.description || i.fgItem?.name || '').toLowerCase().includes(searchTerm.toLowerCase())));

            let matchCustomer = true;
            if (filterCustomers.length > 0 && !filterCustomers.includes('All') && !filterCustomers.includes('all')) {
                const custId = (po.customer?._id || po.customer)?.toString();
                matchCustomer = filterCustomers.includes(custId);
            }

            let matchMrpDone = true;
            if (excludeMrpDone) {
                matchMrpDone = po.status !== 'MRP Done' && po.status !== 'Partially Dispatched' && po.status !== 'Completed';
            }

            let matchDate = true;
            if (filterMonth) {
                const getYearMonth = (val: any) => {
                    if (!val) return '';
                    const d = new Date(val);
                    if (isNaN(d.getTime())) return '';
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                };

                const entryYm = getYearMonth(po.date || po.poDate || po.createdAt);
                const commitYm = getYearMonth(po.committedDeliveryDate || po.deliveryDate);

                if (filterDateType === 'entry') {
                    matchDate = entryYm === filterMonth;
                } else if (filterDateType === 'committed') {
                    matchDate = commitYm === filterMonth;
                } else {
                    matchDate = entryYm === filterMonth || commitYm === filterMonth;
                }
            }

            return matchSearch && matchCustomer && matchMrpDone && matchDate;
        });
    }, [poList, searchTerm, filterCustomers, excludeMrpDone, filterMonth, filterDateType]);

    // Live PO count per status for the dropdown (dynamically scoped)
    const statusCounts = useMemo(() => {
        const counts: Record<string, number> = { All: scopedPoList.length };
        ['Received', 'Accepted', 'MRP Done', 'Partially Dispatched', 'Completed', 'Cancelled'].forEach(st => {
            counts[st] = scopedPoList.filter(p => p.status === st).length;
        });
        return counts;
    }, [scopedPoList]);

    // Dynamic Order Book Financials in INR calculated on filtered POs
    const overallFinancials = useMemo(() => {
        let totalInr = 0;
        let readyForMrpInr = 0;
        let readyForMrpCount = 0;
        let inProgressInr = 0;
        let inProgressCount = 0;
        let completedInr = 0;
        let completedCount = 0;
        const currencyTotals: Record<string, number> = {};
        const currencyInrTotals: Record<string, number> = {};

        (Array.isArray(filteredPoList) ? filteredPoList : []).forEach(po => {
            if (po.status === 'Cancelled') return;
            const amount = Number(po.totalAmount || po.subtotal || 0);
            const curr = (po.currency || 'INR').trim().toUpperCase();
            currencyTotals[curr] = (currencyTotals[curr] || 0) + amount;

            const inrConversion = convertToINR(amount, curr);
            const inrVal = inrConversion.inrAmount;
            totalInr += inrVal;
            currencyInrTotals[curr] = (currencyInrTotals[curr] || 0) + inrVal;

            if (po.status === 'Received' || po.status === 'Accepted') {
                readyForMrpInr += inrVal;
                readyForMrpCount++;
            } else if (po.status === 'MRP Done' || po.status === 'Partially Dispatched') {
                inProgressInr += inrVal;
                inProgressCount++;
            } else if (po.status === 'Completed') {
                completedInr += inrVal;
                completedCount++;
            }
        });

        return {
            totalInr,
            formattedTotalInr: `₹${totalInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            readyForMrpInr,
            formattedReadyForMrpInr: `₹${readyForMrpInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
            readyForMrpCount,
            inProgressInr,
            formattedInProgressInr: `₹${inProgressInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
            inProgressCount,
            completedInr,
            formattedCompletedInr: `₹${completedInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
            completedCount,
            currencyTotals,
            currencyInrTotals,
            hasForeign: Object.keys(currencyTotals).some(c => c !== 'INR' && currencyTotals[c] > 0)
        };
    }, [filteredPoList, convertToINR]);

    // Filtered Order Book Financials in INR
    const consolidatedFinancials = useMemo(() => {
        let totalInr = 0;
        const currencyTotals: Record<string, number> = {};
        const currencyInrTotals: Record<string, number> = {};

        (Array.isArray(filteredPoList) ? filteredPoList : []).forEach(po => {
            if (po.status === 'Cancelled') return;
            const amount = Number(po.totalAmount || po.subtotal || 0);
            const curr = (po.currency || 'INR').trim().toUpperCase();
            currencyTotals[curr] = (currencyTotals[curr] || 0) + amount;

            const inrConversion = convertToINR(amount, curr);
            totalInr += inrConversion.inrAmount;
            currencyInrTotals[curr] = (currencyInrTotals[curr] || 0) + inrConversion.inrAmount;
        });

        return {
            totalInr,
            formattedTotalInr: `₹${totalInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            currencyTotals,
            currencyInrTotals,
            hasForeign: Object.keys(currencyTotals).some(c => c !== 'INR' && currencyTotals[c] > 0)
        };
    }, [filteredPoList, convertToINR]);

    // Consolidated MRP Creation from Multi-PO Selection
    const [selectedPoIds, setSelectedPoIds] = useState<string[]>([]);
    const [isMrpModalOpen, setIsMrpModalOpen] = useState(false);

    // Selected POs Financials in INR
    const selectedFinancials = useMemo(() => {
        let selectedInr = 0;
        const selectedCurrencies: Record<string, number> = {};
        const selectedPos = (Array.isArray(poList) ? poList : []).filter(p => selectedPoIds.includes(p._id));

        selectedPos.forEach(po => {
            const amount = Number(po.totalAmount || po.subtotal || 0);
            const curr = (po.currency || 'INR').trim().toUpperCase();
            selectedCurrencies[curr] = (selectedCurrencies[curr] || 0) + amount;
            const inr = convertToINR(amount, curr);
            selectedInr += inr.inrAmount;
        });

        return {
            count: selectedPos.length,
            selectedInr,
            formattedSelectedInr: `₹${selectedInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            selectedCurrencies,
            hasForeign: Object.keys(selectedCurrencies).some(c => c !== 'INR' && selectedCurrencies[c] > 0)
        };
    }, [poList, selectedPoIds, convertToINR]);

    const handleViewMrpPlan = async (po: any) => {
        const mrpId = po.mrpPlan?._id || (typeof po.mrpPlan === 'string' ? po.mrpPlan : null);
        const mrpNo = po.mrpNumber || po.mrpPlan?.mrpNumber;
        if (!token) return;
        try {
            if (po.mrpPlan && typeof po.mrpPlan === 'object' && po.mrpPlan.fgItems) {
                setViewingMrpPlan(po.mrpPlan);
                return;
            }
            if (mrpId) {
                const res = await apiGet(`/api/purchase/mrp-plan/${mrpId}`, token);
                if (res?.mrpPlan || res?.data) {
                    setViewingMrpPlan(res.mrpPlan || res.data);
                    return;
                }
            }
            if (mrpNo) {
                const res = await apiGet(`/api/purchase/mrp-plan?search=${encodeURIComponent(mrpNo)}`, token);
                const plans = res?.mrpPlans || res?.data || [];
                const matched = plans.find((p: any) => p.mrpNumber === mrpNo);
                if (matched) {
                    setViewingMrpPlan(matched);
                    return;
                }
            }
            onError(`Could not find details for MRP: ${mrpNo || 'Linked Plan'}`);
        } catch (err: any) {
            console.error("Failed to load MRP plan details:", err);
            onError(err.message || "Failed to load MRP plan details");
        }
    };

    const isPoEligibleForMRP = (po: any) => {
        return po && (po.status === 'Received' || po.status === 'Accepted');
    };

    const eligibleFilteredPOs = useMemo(() => {
        return (Array.isArray(filteredPoList) ? filteredPoList : []).filter(isPoEligibleForMRP);
    }, [filteredPoList]);

    const allFilteredSelected = filteredPoList.length > 0 && filteredPoList.every(po => selectedPoIds.includes(po._id));
    const allEligibleSelected = allFilteredSelected;

    const toggleSelectAllFiltered = () => {
        if (allFilteredSelected) {
            const filteredIds = new Set(filteredPoList.map(p => p._id));
            setSelectedPoIds(prev => prev.filter(id => !filteredIds.has(id)));
        } else {
            const toAdd = filteredPoList.map(p => p._id);
            setSelectedPoIds(prev => Array.from(new Set([...prev, ...toAdd])));
        }
    };
    const toggleSelectAllEligible = toggleSelectAllFiltered;

    const toggleSelectPo = (poId: string) => {
        setSelectedPoIds(prev => prev.includes(poId) ? prev.filter(id => id !== poId) : [...prev, poId]);
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            {/* 1. EXECUTIVE CUSTOMER PO DASHBOARD - CONVERTED VALUATIONS & METRICS */}
            <div className="space-y-3">
                {!showDashboard ? (
                    <div className="hidden sm:flex bg-white dark:bg-slate-900 p-2.5 sm:px-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3 sm:gap-6 flex-wrap">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Order Book:</span>
                                <span className="font-mono font-bold text-slate-900 dark:text-white">{overallFinancials.formattedTotalInr}</span>
                                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-extrabold">({filteredPoList.length} POs)</span>
                                {hasActiveFilters && (
                                    <span className="px-1.5 py-0.2 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 rounded text-[9px] font-bold border border-blue-200 dark:border-blue-800">
                                        Filtered
                                    </span>
                                )}
                            </div>
                            <div className="hidden sm:flex items-center gap-1.5">
                                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Ready for MRP:</span>
                                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{overallFinancials.readyForMrpCount} POs</span>
                            </div>
                            <div className="hidden md:flex items-center gap-1.5">
                                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">In Progress:</span>
                                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{overallFinancials.inProgressCount} POs</span>
                            </div>
                            <div className="hidden md:flex items-center gap-1.5">
                                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Completed:</span>
                                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{overallFinancials.completedCount} POs</span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowDashboard(true)}
                            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900/50 cursor-pointer shrink-0 transition-colors"
                            title="Show Executive KPI Dashboard"
                        >
                            <span className="hidden sm:inline">Show Dashboard</span>
                            <span className="sm:hidden text-[11px]">Stats</span>
                            <ChevronDown size={14} />
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Top Dashboard Header with Title and Accessible Hide / Collapse Button */}
                        <div className="flex items-center justify-between pb-1 px-1">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Executive Customer PO Dashboard</span>
                                {hasActiveFilters && (
                                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                                        Filtered ({filteredPoList.length} of {poList.length})
                                    </span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowDashboard(false)}
                                className="px-2.5 py-1 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1 cursor-pointer border border-slate-200 dark:border-slate-700"
                                title="Hide Executive KPI Dashboard"
                            >
                                <ChevronUp size={14} />
                                <span>Hide</span>
                            </button>
                        </div>

                        {/* 4 Primary Executive KPI Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {/* Card 1: Total Order Book */}
                            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between gap-2.5 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Order Book</span>
                                    <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                                        <IndianRupee size={16} />
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                                        {overallFinancials.formattedTotalInr}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 flex-wrap">
                                        <span className="text-blue-600 dark:text-blue-400 font-extrabold">{filteredPoList.length} POs</span>
                                        <span>•</span>
                                        <span>Converted to INR</span>
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: Ready for MRP / Demand Planning */}
                            <div 
                                onClick={() => {
                                    if (filterStatus === 'Received' || filterStatus === 'Accepted') {
                                        setFilterStatus('All');
                                    } else {
                                        setFilterStatus('Received');
                                    }
                                }}
                                className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between gap-2.5 hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors cursor-pointer group"
                                title="Click to filter Ready for MRP POs"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ready for MRP</span>
                                    <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
                                        <Layers size={16} />
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono tracking-tight">
                                        {overallFinancials.formattedReadyForMrpInr}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 flex-wrap">
                                        <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{overallFinancials.readyForMrpCount} POs</span>
                                        <span>•</span>
                                        <span>Received & Accepted</span>
                                    </div>
                                </div>
                            </div>

                            {/* Card 3: MRP In Progress / Production */}
                            <div 
                                onClick={() => setFilterStatus(filterStatus === 'MRP Done' ? 'All' : 'MRP Done')}
                                className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between gap-2.5 hover:border-amber-400 dark:hover:border-amber-600 transition-colors cursor-pointer group"
                                title="Click to filter MRP Done POs"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">MRP In Progress</span>
                                    <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
                                        <Clock size={16} />
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 font-mono tracking-tight">
                                        {overallFinancials.formattedInProgressInr}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 flex-wrap">
                                        <span className="text-amber-600 dark:text-amber-400 font-extrabold">{overallFinancials.inProgressCount} POs</span>
                                        <span>•</span>
                                        <span>MRP Planned / Dispatched</span>
                                    </div>
                                </div>
                            </div>

                            {/* Card 4: Completed / Fulfilled */}
                            <div 
                                onClick={() => setFilterStatus(filterStatus === 'Completed' ? 'All' : 'Completed')}
                                className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between gap-2.5 hover:border-emerald-400 dark:hover:border-emerald-600 transition-colors cursor-pointer group"
                                title="Click to filter Completed POs"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Completed & Invoiced</span>
                                    <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
                                        <CheckCircle2 size={16} />
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
                                        {overallFinancials.formattedCompletedInr}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 flex-wrap">
                                        <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{overallFinancials.completedCount} POs</span>
                                        <span>•</span>
                                        <span>100% Dispatched</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Currency Conversion Info Bar from Store Prefix Settings */}
                        <div className="bg-slate-50/80 dark:bg-slate-800/40 px-3.5 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 text-[11px] flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                    <Tag size={12} className="text-blue-500" />
                                    <span>Currency Conversion Rates (Store &gt; Masters &gt; Setting Prefix):</span>
                                </span>
                                <span className="font-mono text-slate-600 dark:text-slate-400">
                                    1 USD ≈ ₹{(exchangeRates.USD || 84.50).toFixed(2)} | 1 EUR ≈ ₹{(exchangeRates.EUR || 92.00).toFixed(2)} | 1 GBP ≈ ₹{(exchangeRates.GBP || 108.00).toFixed(2)} | 1 AED ≈ ₹{(exchangeRates.AED || 23.00).toFixed(2)}
                                </span>
                            </div>

                            <Link 
                                href="/dashboard/store/masters/prefix-settings"
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline shrink-0"
                            >
                                <Settings size={11} />
                                <span>Manage Exchange Rates</span>
                            </Link>
                        </div>

                        {/* Foreign Currency Breakdown (if order book has foreign currencies) */}
                        {overallFinancials.hasForeign && (
                            <div className="flex flex-wrap items-center gap-1.5 text-xs bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                                <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mr-1">Foreign Breakdown:</span>
                                {Object.keys(overallFinancials.currencyTotals).map(curr => {
                                    const amt = overallFinancials.currencyTotals[curr];
                                    if (amt <= 0) return null;
                                    const sym = getCurrencySymbol(curr);
                                    const isForeign = curr !== 'INR';
                                    return (
                                        <div key={curr} className="px-2 py-0.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-medium flex items-center gap-1">
                                            <span className="font-bold text-slate-700 dark:text-slate-200">{sym}{amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {curr}</span>
                                            {isForeign && (
                                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                                                    (≈ ₹{(overallFinancials.currencyInrTotals[curr] || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })})
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}

                {/* Dynamic Selection Summary Banner (when 1+ POs selected) */}
                {selectedPoIds.length > 0 && (
                    <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 text-white p-3.5 sm:p-4 rounded-2xl shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse"></span>
                                <span className="font-extrabold text-xs uppercase tracking-wider text-blue-100">Active Multi-PO Selection</span>
                            </div>
                            <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="text-2xl font-black font-mono">{selectedFinancials.formattedSelectedInr}</span>
                                <span className="text-xs text-blue-100 font-bold">({selectedFinancials.count} Customer PO{selectedFinancials.count > 1 ? 's' : ''} Selected)</span>
                            </div>
                            {selectedFinancials.hasForeign && (
                                <div className="text-[10px] text-blue-100 font-mono">
                                    Converted into INR using Store Prefix Settings rates
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap self-end md:self-center">
                            <button
                                type="button"
                                onClick={() => setIsMrpModalOpen(true)}
                                className="px-4 py-2 bg-white hover:bg-blue-50 text-indigo-700 font-extrabold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all transform hover:scale-[1.02] cursor-pointer"
                            >
                                <Layers size={14} className="text-indigo-600" />
                                <span>Create Consolidated MRP ({selectedFinancials.count})</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedPoIds([])}
                                className="px-3 py-2 bg-white/20 hover:bg-white/30 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                            >
                                Clear Selection
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Search, Filter & Action Toolbar */}
            <div className="bg-white dark:bg-slate-900 p-2.5 sm:p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5">
                {/* Main Control Row - Fits in a SINGLE line on Desktop (`lg:flex`) */}
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2 sm:gap-2.5">
                    {/* Left & Center: Search + ViewMode + Desktop Inline Filters */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        {/* Search Input: Compact on desktop so filters fit in the same line */}
                        <div className="relative flex-1 lg:flex-initial lg:w-44 xl:w-52 shrink-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                                type="text"
                                placeholder={viewMode === 'items' ? "Search Item, Description, PO #..." : "Search PO #, Customer or Item..."}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-slate-50/50 dark:bg-slate-800/50"
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                                    title="Clear search"
                                >
                                    <X size={13} />
                                </button>
                            )}
                        </div>

                        {/* View Mode Toggle Button */}
                        <div className="hidden sm:flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl shrink-0 border border-slate-200/80 dark:border-slate-700/80">
                            <button
                                type="button"
                                onClick={() => setViewMode('po')}
                                className={`flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    viewMode === 'po'
                                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                                }`}
                                title="View Customer Purchase Orders"
                            >
                                <FileCheck size={13} />
                                <span>POs ({poList.length})</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('items')}
                                className={`flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    viewMode === 'items'
                                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                                }`}
                                title="View All Items and their Customer POs"
                            >
                                <Package size={13} />
                                <span>Items ({uniquePoItemsCount})</span>
                            </button>
                        </div>

                        {/* Inline Filters on Desktop (`lg:flex`) */}
                        <div className="hidden lg:flex items-center gap-1.5 xl:gap-2 flex-wrap min-w-0">
                            {/* Customer Select */}
                            <SearchableMultiSelect
                                options={customerOptions}
                                selectedValues={filterCustomers}
                                onChange={setFilterCustomers}
                                placeholder="All Customers"
                                searchPlaceholder="Search customer..."
                                className="w-36 xl:w-48"
                            />

                            {/* Status Select */}
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="px-2 xl:px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 outline-none cursor-pointer focus:ring-2 focus:ring-blue-500/20 max-w-[125px] xl:max-w-[145px]"
                                title="Filter by Status"
                            >
                                <option value="All">All Statuses ({statusCounts.All || 0})</option>
                                <option value="Received">Received ({statusCounts.Received || 0})</option>
                                <option value="Accepted">Accepted ({statusCounts.Accepted || 0})</option>
                                <option value="MRP Done">MRP Done ({statusCounts['MRP Done'] || 0})</option>
                                <option value="Partially Dispatched">Part. Dispatched ({statusCounts['Partially Dispatched'] || 0})</option>
                                <option value="Completed">Completed ({statusCounts.Completed || 0})</option>
                                <option value="Cancelled">Cancelled ({statusCounts.Cancelled || 0})</option>
                            </select>

                            {/* Month Filter */}
                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                                <Calendar size={13} className="text-blue-500 shrink-0" />
                                <select
                                    value={filterDateType}
                                    onChange={(e) => setFilterDateType(e.target.value as any)}
                                    className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer pr-1"
                                    title="Date basis"
                                >
                                    <option value="entry">PO</option>
                                    <option value="committed">Due</option>
                                    <option value="either">Any</option>
                                </select>
                                <input
                                    type="month"
                                    value={filterMonth}
                                    onChange={(e) => setFilterMonth(e.target.value)}
                                    className="px-1.5 py-0.5 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 rounded border border-slate-200 dark:border-slate-700 outline-none cursor-pointer text-center"
                                    title="Choose month (YYYY-MM)"
                                />
                                {filterMonth && (
                                    <button
                                        type="button"
                                        onClick={() => setFilterMonth('')}
                                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                                        title="Clear month"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>

                            {/* Exclude MRP Done */}
                            <button
                                type="button"
                                onClick={() => {
                                    setExcludeMrpDone(prev => !prev);
                                    if (filterStatus === 'MRP Done') setFilterStatus('All');
                                }}
                                className={`px-2 xl:px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border shrink-0 flex items-center gap-1 ${
                                    excludeMrpDone
                                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-700 shadow-2xs'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                }`}
                                title={excludeMrpDone ? "Currently hiding MRP Done POs" : "Click to hide MRP Done POs"}
                            >
                                <span>{excludeMrpDone ? '✓ Excl. MRP' : 'Hide MRP'}</span>
                            </button>

                            {/* Reset Button (only when filters active) */}
                            {hasActiveFilters && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchTerm('');
                                        setFilterStatus('All');
                                        setFilterCustomers([]);
                                        setExcludeMrpDone(false);
                                        setFilterMonth('');
                                        setFilterDateType('entry');
                                    }}
                                    className="p-1.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-800 transition-all flex items-center gap-1 cursor-pointer shrink-0 text-xs font-bold"
                                    title="Reset all filters"
                                >
                                    <RotateCcw size={13} />
                                    <span className="hidden xl:inline">Reset</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Right Action Group: Mobile Toggles + Dashboard Toggle + Actions */}
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 self-end lg:self-auto">
                        {/* Mobile Only: Small Filter Toggle Icon */}
                        <button
                            type="button"
                            onClick={() => setShowFilters(prev => !prev)}
                            className={`lg:hidden p-2 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer border ${
                                showFilters || activeFilterCount > 0
                                    ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950/60 dark:border-blue-800 dark:text-blue-300'
                                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                            }`}
                            title={showFilters ? "Hide Filters" : "Show Filters"}
                            aria-label="Toggle Filters"
                        >
                            <Filter size={15} />
                            {activeFilterCount > 0 && (
                                <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>

                        {/* Dashboard Toggle: Small icon on mobile, compact labeled button on desktop */}
                        <button
                            type="button"
                            onClick={() => setShowDashboard(prev => !prev)}
                            className={`p-2 sm:px-2.5 sm:py-1.5 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                                showDashboard
                                    ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950/60 dark:border-blue-800 dark:text-blue-300'
                                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                            }`}
                            title={showDashboard ? "Hide Executive KPI Dashboard" : "Show Executive KPI Dashboard"}
                            aria-label="Toggle Dashboard"
                        >
                            <LayoutGrid size={15} />
                            <span className="hidden sm:inline">{showDashboard ? "Hide" : "Dashboard"}</span>
                        </button>

                        {/* Consolidated MRP Button */}
                        <button
                            type="button"
                            onClick={() => setIsMrpModalOpen(true)}
                            className={`px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                                selectedPoIds.length > 0 
                                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm' 
                                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                            }`}
                            title="Create Single Consolidated MRP from multiple Customer POs"
                        >
                            <Layers size={14} />
                            <span className="hidden xl:inline">Consolidated MRP</span>
                            <span className="xl:hidden">MRP</span>
                            {selectedPoIds.length > 0 ? ` (${selectedPoIds.length})` : ''}
                        </button>

                        {/* Log Customer PO Button */}
                        <button
                            type="button"
                            onClick={handleOpenCreateModal}
                            className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                            <Plus size={15} />
                            <span className="hidden sm:inline">Log Customer PO</span>
                            <span className="sm:hidden">Log</span>
                        </button>
                    </div>
                </div>

                {/* Mobile Collapsible Filter Drawer */}
                {showFilters && (
                    <div className="lg:hidden pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between pb-1">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Filter Options</span>
                            <button
                                type="button"
                                onClick={() => setShowFilters(false)}
                                className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center gap-0.5"
                            >
                                <ChevronUp size={13} />
                                <span>Collapse</span>
                            </button>
                        </div>

                        {/* Mobile View Mode Switcher */}
                        <div className="flex sm:hidden bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                            <button
                                type="button"
                                onClick={() => setViewMode('po')}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    viewMode === 'po'
                                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                                        : 'text-slate-500'
                                }`}
                            >
                                <FileCheck size={14} />
                                <span>POs ({poList.length})</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('items')}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    viewMode === 'items'
                                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                                        : 'text-slate-500'
                                }`}
                            >
                                <Package size={14} />
                                <span>Items ({uniquePoItemsCount})</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {/* Mobile Customer Select */}
                            <div className="flex flex-col gap-1">
                                <label className="text-[11px] font-bold text-slate-500">Customer</label>
                                <SearchableMultiSelect
                                    options={customerOptions}
                                    selectedValues={filterCustomers}
                                    onChange={setFilterCustomers}
                                    placeholder="All Customers"
                                    searchPlaceholder="Search customer..."
                                    className="w-full"
                                />
                            </div>

                            {/* Mobile Status Select */}
                            <div className="flex flex-col gap-1">
                                <label className="text-[11px] font-bold text-slate-500">Status</label>
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="w-full px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
                                >
                                    <option value="All">All Statuses ({statusCounts.All || 0})</option>
                                    <option value="Received">Received ({statusCounts.Received || 0})</option>
                                    <option value="Accepted">Accepted ({statusCounts.Accepted || 0})</option>
                                    <option value="MRP Done">MRP Done ({statusCounts['MRP Done'] || 0})</option>
                                    <option value="Partially Dispatched">Partially Dispatched ({statusCounts['Partially Dispatched'] || 0})</option>
                                    <option value="Completed">Completed ({statusCounts.Completed || 0})</option>
                                    <option value="Cancelled">Cancelled ({statusCounts.Cancelled || 0})</option>
                                </select>
                            </div>

                            {/* Mobile Month Filter */}
                            <div className="flex flex-col gap-1 sm:col-span-2">
                                <label className="text-[11px] font-bold text-slate-500">Month Filter</label>
                                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <Calendar size={13} className="text-blue-500 shrink-0" />
                                    <select
                                        value={filterDateType}
                                        onChange={(e) => setFilterDateType(e.target.value as any)}
                                        className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
                                    >
                                        <option value="entry">PO / Entry Month</option>
                                        <option value="committed">Committed Month</option>
                                        <option value="either">Either Month</option>
                                    </select>
                                    <input
                                        type="month"
                                        value={filterMonth}
                                        onChange={(e) => setFilterMonth(e.target.value)}
                                        className="flex-1 px-2 py-0.5 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 rounded border border-slate-200 dark:border-slate-700 outline-none text-center"
                                    />
                                    {filterMonth && (
                                        <button
                                            type="button"
                                            onClick={() => setFilterMonth('')}
                                            className="text-slate-400 p-0.5"
                                        >
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Mobile Bottom Actions (Exclude MRP + Reset) */}
                        <div className="flex items-center justify-between pt-1">
                            <button
                                type="button"
                                onClick={() => {
                                    setExcludeMrpDone(prev => !prev);
                                    if (filterStatus === 'MRP Done') setFilterStatus('All');
                                }}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                    excludeMrpDone
                                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                }`}
                            >
                                <span>{excludeMrpDone ? '✓ Exclude MRP Done' : 'Hide MRP Done'}</span>
                            </button>

                            {hasActiveFilters && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchTerm('');
                                        setFilterStatus('All');
                                        setFilterCustomers([]);
                                        setExcludeMrpDone(false);
                                        setFilterMonth('');
                                        setFilterDateType('entry');
                                    }}
                                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center gap-1"
                                >
                                    <RotateCcw size={12} />
                                    <span>Reset Filters</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Live Counter & Valuation Indicator */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <span>Showing <strong className="text-slate-900 dark:text-white font-bold">{filteredPoList.length}</strong> of <strong className="text-slate-900 dark:text-white font-bold">{poList.length}</strong> Customer POs</span>
                        {hasActiveFilters && (
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 text-[10px] font-bold">Filtered</span>
                        )}
                    </div>
                    <div className="flex items-center gap-1 font-mono text-xs">
                        <span>Converted Valuation:</span>
                        <strong className="text-blue-600 dark:text-blue-400 font-extrabold text-sm">{consolidatedFinancials.formattedTotalInr}</strong>
                    </div>
                </div>
            </div>

            {viewMode === 'items' ? (
                <CustomerPOItemWiseView
                    poList={poList}
                    fgItems={fgItems}
                    customers={customers}
                    onViewPo={(po) => setSelectedPo(po)}
                    searchTerm={searchTerm}
                    filterCustomers={filterCustomers}
                />
            ) : (
                <>

                    {loading ? (
                        <div className="flex justify-center p-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : filteredPoList.length === 0 ? (
                        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                            <FileCheck className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                                {hasActiveFilters ? "No Customer Purchase Orders Match Filter" : "No Customer Purchase Orders Found"}
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                {hasActiveFilters 
                                    ? "Try adjusting or resetting your search and filter criteria."
                                    : "Log incoming customer POs to initiate fulfillment, DCs, and invoicing."}
                            </p>
                            {hasActiveFilters && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchTerm('');
                                        setFilterStatus('All');
                                        setFilterCustomers([]);
                                        setExcludeMrpDone(false);
                                        setFilterMonth('');
                                        setFilterDateType('entry');
                                    }}
                                    className="mt-4 px-3 py-1.5 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 transition-all inline-flex items-center gap-1.5 cursor-pointer"
                                >
                                    <RotateCcw size={13} />
                                    <span>Reset All Filters</span>
                                </button>
                            )}
                        </div>
                    ) : (
                        /* Table & Cards View */
                        <div className="space-y-3">

                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                        {/* Desktop Table View - Scrollable with Sticky Header */}
                        <div className="hidden md:block overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] min-h-[350px]">
                        <table className="w-full text-sm text-left relative">
                            <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 shadow-2xs">
                                <tr>
                                    <th className="px-3 py-3.5 w-10 text-center">
                                        <input
                                            type="checkbox"
                                            checked={allFilteredSelected}
                                            onChange={toggleSelectAllFiltered}
                                            disabled={filteredPoList.length === 0}
                                            title={filteredPoList.length === 0 ? "No Customer POs to select" : "Select all POs in current view"}
                                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4 disabled:opacity-30 disabled:cursor-not-allowed"
                                        />
                                    </th>
                                    <th className="px-4 py-3.5">Customer PO #</th>
                                    <th className="px-4 py-3.5">Customer Name</th>
                                    <th className="px-4 py-3.5 text-center">PO Date</th>
                                    <th className="px-4 py-3.5 text-center">Committed Date / Day</th>
                                    <th className="px-4 py-3.5 text-right">Total Amount</th>
                                    <th className="px-4 py-3.5 text-center">Fulfillment Status</th>
                                    <th className="px-4 py-3.5 text-center">Created By</th>
                                    <th className="px-4 py-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {filteredPoList.map((po) => {
                                    const total = Number(po.totalAmount || po.subtotal || 0);
                                    const hasOA = Boolean(po.acknowledgementNumber || po.acknowledgementDate || po.committedDispatchDate);
                                    const commitDate = po.committedDispatchDate;
                                    const leadDays = commitDate && po.date
                                        ? Math.max(0, Math.round((new Date(commitDate).getTime() - new Date(po.date).getTime()) / (1000 * 60 * 60 * 24)))
                                        : null;
                                    const remDays = commitDate
                                        ? Math.ceil((new Date(commitDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                                        : null;
                                    const isSelected = selectedPoIds.includes(po._id);
                                    const isEligible = isPoEligibleForMRP(po);

                                    return (
                                        <tr key={po._id || po.poNumber} className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors ${isSelected ? 'bg-blue-50/70 dark:bg-blue-950/30' : ''}`}>
                                            <td className="px-3 py-3.5 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelectPo(po._id)}
                                                    title={po.mrpNumber ? `Linked to MRP #${po.mrpNumber}` : "Select Customer PO"}
                                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                                                />
                                            </td>
                                            <td className="px-4 py-3.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span>{po.poNumber}</span>
                                                    {(po.pdf || (Array.isArray(po.photos) && po.photos.length > 0)) && (
                                                        <a
                                                            href={po.pdf || po.photos[0]}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            title={po.pdf ? "View Attached Customer PO (PDF)" : "View Attached Customer PO (Photo)"}
                                                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                                po.pdf 
                                                                    ? "bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400 border border-red-200 dark:border-red-800" 
                                                                    : "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800"
                                                            } hover:scale-105 transition-transform`}
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            {po.pdf ? <FileText size={11} /> : <Paperclip size={11} />}
                                                            {po.pdf ? "PDF" : "Photo"}
                                                        </a>
                                                    )}
                                                </div>
                                                {po.quotationReference?.quotationNumber && (
                                                    <span className="block text-[10px] text-slate-400 font-sans font-normal">
                                                        Ref Quote: {po.quotationReference.quotationNumber}
                                                    </span>
                                                )}
                                                {(po.mrpNumber || po.mrpPlan) && (
                                                    <div className="mt-1">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleViewMrpPlan(po);
                                                            }}
                                                            title="Click to view linked MRP demand plan & explosion"
                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
                                                        >
                                                            <Layers size={10} />
                                                            <span>MRP: {po.mrpNumber || (typeof po.mrpPlan === 'object' ? po.mrpPlan.mrpNumber : 'Linked')}</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </td>

                                            <td className="px-4 py-3.5 font-bold text-slate-800 dark:text-slate-200 text-xs">
                                                <div className="flex items-center gap-1.5">
                                                    <Building2 size={13} className="text-blue-500 shrink-0" />
                                                    <span className="truncate max-w-[180px]">{po.customerName || po.customer?.name || 'Customer'}</span>
                                                </div>
                                            </td>

                                            <td className="px-4 py-3.5 text-center font-bold text-slate-700 dark:text-slate-300 text-xs whitespace-nowrap">
                                                {po.date ? new Date(po.date).toLocaleDateString('en-GB') : 'N/A'}
                                            </td>

                                            <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                                {hasOA && commitDate ? (
                                                    <div className="flex flex-col items-center gap-1">
                                                        <div className="font-bold text-indigo-600 dark:text-indigo-400 text-xs flex items-center justify-center gap-1">
                                                            <Calendar size={12} className="text-indigo-500 shrink-0" />
                                                            <span>{new Date(commitDate).toLocaleDateString('en-GB')}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1 justify-center flex-wrap">
                                                            {leadDays !== null && (
                                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800" title={`Committed lead time: ${leadDays} days from PO Date`}>
                                                                    {leadDays} Day{leadDays !== 1 ? 's' : ''}
                                                                </span>
                                                            )}
                                                            {po.status === 'Completed' ? (
                                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200">
                                                                    ✓ Dispatched
                                                                </span>
                                                            ) : remDays !== null ? (
                                                                remDays > 0 ? (
                                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200">
                                                                        {remDays}d left
                                                                    </span>
                                                                ) : remDays === 0 ? (
                                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 animate-pulse">
                                                                        Due Today
                                                                    </span>
                                                                ) : (
                                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200">
                                                                        {Math.abs(remDays)}d overdue
                                                                    </span>
                                                                )
                                                            ) : null}
                                                        </div>
                                                        {po.acknowledgementNumber && (
                                                            <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500" title="Order Acknowledgement Number">
                                                                {po.acknowledgementNumber}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => setAcknowledgingPo(po)}
                                                        title="Order Acknowledgement not generated. Click to accept and commit date."
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 hover:bg-indigo-50 text-slate-500 hover:text-indigo-700 dark:bg-slate-800 dark:hover:bg-indigo-950/60 dark:text-slate-400 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 transition-colors"
                                                    >
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                                                        Pending OA
                                                    </button>
                                                )}
                                            </td>

                                            <td className="px-4 py-3.5 text-right font-mono text-sm">
                                                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                                    <span className="font-extrabold text-blue-600 dark:text-blue-400">
                                                        {getCurrencySymbol(po.currency)}{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                        {normalizeCurrencyCode(po.currency)}
                                                    </span>
                                                </div>
                                                {(() => {
                                                    const inr = convertToINR(total, po.currency);
                                                    if (inr.isForeign) {
                                                        return (
                                                            <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5" title={`Conversion: 1 ${po.currency} = ₹${inr.rate.toFixed(2)} INR`}>
                                                                ≈ {inr.formattedINR} <span className="font-normal text-slate-400">(@ ₹{inr.rate.toFixed(2)})</span>
                                                            </div>
                                                        );
                                                    }
                                                    return (
                                                        <div className="text-[10px] font-medium text-slate-400 mt-0.5">
                                                            Consolidated: ₹{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </div>
                                                    );
                                                })()}
                                            </td>

                                            <td className="px-4 py-3.5 text-center">
                                                <select
                                                    value={po.status || 'Received'}
                                                    onChange={(e) => handleStatusChange(po._id, e.target.value)}
                                                    className={`px-2.5 py-1 rounded-full text-xs font-bold border-none outline-none cursor-pointer ${
                                                        po.status === 'Completed' || po.status === 'Accepted' ? 'bg-emerald-100 text-emerald-800' :
                                                        po.status === 'MRP Done' ? 'bg-blue-100 text-blue-800' :
                                                        po.status === 'Partially Dispatched' ? 'bg-indigo-100 text-indigo-800' :
                                                        po.status === 'Cancelled' ? 'bg-rose-100 text-rose-800' :
                                                        'bg-amber-100 text-amber-800'
                                                    }`}
                                                >
                                                    <option value="Received">Received</option>
                                                    <option value="Accepted">Accepted</option>
                                                    <option value="MRP Done">MRP Done</option>
                                                    <option value="Partially Dispatched">Partially Dispatched</option>
                                                    <option value="Completed">Completed</option>
                                                    <option value="Cancelled">Cancelled</option>
                                                </select>
                                            </td>

                                            <td className="px-4 py-3.5 text-center text-xs font-medium text-slate-600 dark:text-slate-400">
                                                <div className="flex items-center justify-center gap-1 font-bold text-slate-700 dark:text-slate-300">
                                                    <User size={13} className="text-blue-500" />
                                                    {getUserName(po.createdBy || po.receivedBy)}
                                                </div>
                                                {po.createdAt && <div className="text-[10px] text-slate-400">{new Date(po.createdAt).toLocaleDateString('en-GB')}</div>}
                                            </td>

                                            <td className="px-4 py-3.5 text-right space-x-1.5">
                                                <button
                                                    onClick={() => setSelectedPo(po)}
                                                    title="View Details & DC/Invoice Timeline"
                                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1"
                                                >
                                                    <Eye size={13} /> View
                                                </button>

                                                <button
                                                    onClick={() => setAcknowledgingPo(po)}
                                                    title={hasOA ? `Order Acknowledgement Created (${po.acknowledgementNumber || 'OA'}) - Click to view/edit schedule` : "Order Acknowledgement & Commitment Schedule"}
                                                    className={`px-2.5 py-1.5 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1 ${
                                                        hasOA 
                                                            ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" 
                                                            : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                                                    }`}
                                                >
                                                    <FileText size={13} /> {hasOA ? '✓ OA' : 'OA / Accept'}
                                                </button>

                                                {(() => {
                                                    const remainingSecs = getRemainingEditSeconds(po.createdAt || po.date);
                                                    const isWithinLimit = isEditAllowed(po.createdAt || po.date);

                                                    return (
                                                        <>
                                                            {isWithinLimit ? (
                                                                <>
                                                                    {remainingSecs === Infinity ? (
                                                                        <span 
                                                                            title="Unlimited editing window configured by company policy"
                                                                            className="px-2 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-xl font-mono text-[10px] font-bold border border-emerald-200 dark:border-emerald-800 inline-flex items-center gap-1 shrink-0"
                                                                        >
                                                                            <ShieldCheck size={11} className="text-emerald-600" />
                                                                            Unlimited
                                                                        </span>
                                                                    ) : (
                                                                        <span 
                                                                            title={`Editing and deletion allowed for another ${formatRemainingTime(remainingSecs)}`}
                                                                            className="px-2 py-1 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 rounded-xl font-mono text-[10px] font-bold border border-amber-200 dark:border-amber-800 inline-flex items-center gap-1 shrink-0"
                                                                        >
                                                                            <Clock size={11} className="text-amber-600 animate-pulse" />
                                                                            {formatRemainingTime(remainingSecs)}
                                                                        </span>
                                                                    )}
                                                                    <button
                                                                        onClick={() => handleOpenEditModal(po)}
                                                                        title={`Edit PO (${formatRemainingTime(remainingSecs)} left)`}
                                                                        className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1"
                                                                    >
                                                                        <Edit2 size={13} /> Edit
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeletePo(po)}
                                                                        title={`Delete PO (${formatRemainingTime(remainingSecs)} left)`}
                                                                        className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400 text-xs font-bold rounded-xl transition-colors inline-flex items-center"
                                                                    >
                                                                        <Trash2 size={13} />
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <span title={`Editing and deleting window expired (${getPolicyHours('customerPo')}h limit)`} className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-400 text-[11px] font-medium rounded-xl inline-flex items-center gap-1 opacity-60">
                                                                    <Lock size={12} /> Locked
                                                                </span>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View - Scrollable */}
                    <div className="block md:hidden p-3 space-y-3 pb-28 sm:pb-20 bg-gray-50/50 dark:bg-slate-900/40 max-h-[calc(100vh-270px)] overflow-y-auto">
                        {filteredPoList.map((po) => {
                            const total = Number(po.totalAmount || po.subtotal || 0);
                            const remainingSecs = getRemainingEditSeconds(po.createdAt || po.date);
                            const isWithinLimit = isEditAllowed(po.createdAt || po.date);
                            const hasOA = Boolean(po.acknowledgementNumber || po.acknowledgementDate || po.committedDispatchDate);
                            const commitDate = po.committedDispatchDate;
                            const leadDays = commitDate && po.date
                                ? Math.max(0, Math.round((new Date(commitDate).getTime() - new Date(po.date).getTime()) / (1000 * 60 * 60 * 24)))
                                : null;

                            const isSelected = selectedPoIds.includes(po._id);
                            const isEligible = isPoEligibleForMRP(po);

                            return (
                                <div
                                    key={po._id || po.poNumber}
                                    className={`bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-3 transition-colors ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50/20' : ''}`}
                                >
                                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-2.5">
                                        <div className="flex items-start gap-2.5">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleSelectPo(po._id)}
                                                title={po.mrpNumber ? `Linked to MRP #${po.mrpNumber}` : "Select Customer PO"}
                                                className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                                            />
                                            <div>
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-sm">{po.poNumber}</span>
                                                {(po.pdf || (Array.isArray(po.photos) && po.photos.length > 0)) && (
                                                    <a
                                                        href={po.pdf || po.photos[0]}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                            po.pdf 
                                                                ? "bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400 border border-red-200" 
                                                                : "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200"
                                                        }`}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {po.pdf ? <FileText size={10} /> : <Paperclip size={10} />}
                                                        {po.pdf ? "PDF" : "Photo"}
                                                    </a>
                                                )}
                                                {isWithinLimit ? (
                                                    remainingSecs === Infinity ? (
                                                        <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-md font-mono text-[9px] font-bold border border-emerald-200 dark:border-emerald-800 inline-flex items-center gap-0.5">
                                                            <ShieldCheck size={9} className="text-emerald-600" />
                                                            Unlimited
                                                        </span>
                                                    ) : (
                                                        <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 rounded-md font-mono text-[9px] font-bold border border-amber-200 dark:border-amber-800 inline-flex items-center gap-0.5">
                                                            <Clock size={9} className="text-amber-600 animate-pulse" />
                                                            {formatRemainingTime(remainingSecs)}
                                                        </span>
                                                    )
                                                ) : (
                                                    <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-400 rounded-md text-[9px] font-bold inline-flex items-center gap-0.5">
                                                        <Lock size={9} /> Locked
                                                    </span>
                                                )}
                                            </div>
                                            {po.quotationReference?.quotationNumber && (
                                                <span className="text-[10px] text-slate-400 font-mono block">
                                                    Ref Quote: {po.quotationReference.quotationNumber}
                                                </span>
                                            )}
                                            {(po.mrpNumber || po.mrpPlan) && (
                                                <div className="mt-1">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleViewMrpPlan(po);
                                                        }}
                                                        title="Click to view linked MRP demand plan & explosion"
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
                                                    >
                                                        <Layers size={10} />
                                                        <span>MRP: {po.mrpNumber || (typeof po.mrpPlan === 'object' ? po.mrpPlan.mrpNumber : 'Linked')}</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <select
                                            value={po.status || 'Received'}
                                            onChange={(e) => handleStatusChange(po._id, e.target.value)}
                                            className={`px-2.5 py-1 rounded-full text-xs font-bold border-none outline-none cursor-pointer ${
                                                po.status === 'Completed' || po.status === 'Accepted' ? 'bg-emerald-100 text-emerald-800' :
                                                po.status === 'MRP Done' ? 'bg-blue-100 text-blue-800' :
                                                po.status === 'Partially Dispatched' ? 'bg-indigo-100 text-indigo-800' :
                                                po.status === 'Cancelled' ? 'bg-rose-100 text-rose-800' :
                                                'bg-amber-100 text-amber-800'
                                            }`}
                                        >
                                            <option value="Received">Received</option>
                                            <option value="Accepted">Accepted</option>
                                            <option value="MRP Done">MRP Done</option>
                                            <option value="Partially Dispatched">Partially Dispatched</option>
                                            <option value="Completed">Completed</option>
                                            <option value="Cancelled">Cancelled</option>
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Customer</span>
                                            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{po.customerName || po.customer?.name || 'Customer'}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">PO Date</span>
                                            <p className="font-medium text-slate-700 dark:text-slate-300">{po.date ? new Date(po.date).toLocaleDateString('en-GB') : 'N/A'}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Committed Date / Day</span>
                                            {hasOA && commitDate ? (
                                                <p className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                                                    <Calendar size={11} className="text-indigo-500 shrink-0" />
                                                    <span>{new Date(commitDate).toLocaleDateString('en-GB')}</span>
                                                    {leadDays !== null && <span className="text-[10px] text-indigo-500 font-mono">({leadDays}d)</span>}
                                                </p>
                                            ) : (
                                                <p className="text-slate-400 italic text-[11px]">Pending OA</p>
                                            )}
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Total Amount</span>
                                            <p className="font-extrabold text-sm text-blue-600 dark:text-blue-400 font-mono flex items-center gap-1 flex-wrap">
                                                <span>{getCurrencySymbol(po.currency)}{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                    {normalizeCurrencyCode(po.currency)}
                                                </span>
                                            </p>
                                            {(() => {
                                                const inr = convertToINR(total, po.currency);
                                                if (inr.isForeign) {
                                                    return (
                                                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block font-mono">
                                                            ≈ {inr.formattedINR} (@ ₹{inr.rate.toFixed(2)})
                                                        </span>
                                                    );
                                                }
                                                return (
                                                    <span className="text-[10px] font-medium text-slate-400 block font-mono">
                                                        Consolidated: ₹{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Created By</span>
                                            <p className="text-slate-600 dark:text-slate-400">{getUserName(po.createdBy || po.receivedBy)}</p>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-700">
                                        <button
                                            onClick={() => setSelectedPo(po)}
                                            className="flex-1 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center gap-1"
                                        >
                                            <Eye size={13} /> View
                                        </button>
                                        <button
                                            onClick={() => setAcknowledgingPo(po)}
                                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1 border ${
                                                hasOA 
                                                    ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800" 
                                                    : "text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800"
                                            }`}
                                        >
                                            <FileText size={13} /> {hasOA ? '✓ OA' : 'OA / Accept'}
                                        </button>

                                        {isWithinLimit ? (
                                            <>
                                                <button
                                                    onClick={() => handleOpenEditModal(po)}
                                                    title={`Edit PO (${formatRemainingTime(remainingSecs)} left)`}
                                                    className="py-1.5 px-2.5 text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center gap-1"
                                                >
                                                    <Edit2 size={13} /> Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDeletePo(po)}
                                                    title={`Delete PO (${formatRemainingTime(remainingSecs)} left)`}
                                                    className="py-1.5 px-2.5 text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-900/30 rounded-lg border border-rose-200 dark:border-rose-800 flex items-center gap-1"
                                                >
                                                    <Trash2 size={13} /> Delete
                                                </button>
                                            </>
                                        ) : null}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
            )}
                </>
            )}

            {/* Create / Edit Customer PO Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-[98vw] xl:max-w-7xl 2xl:max-w-[1550px] overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
                        
                        <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white flex justify-between items-center flex-shrink-0 border-b border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                                    {editingPo ? <Edit2 size={20} /> : <FileCheck size={20} />}
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-base sm:text-lg font-black tracking-tight truncate">
                                        {editingPo ? 'Edit Customer Purchase Order' : 'Log Customer Purchase Order (Inward PO)'}
                                    </h2>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">PO #: <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{newPo.poNumber}</span></p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setIsCreateModalOpen(false); setEditingPo(null); }}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-2"
                                title="Close"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-3.5 sm:p-6 overflow-y-auto flex-1 space-y-4 sm:space-y-6">
                            
                            {/* In-Form Error Guidance Banner */}
                            {Object.keys(formErrors).length > 0 && (
                                <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-2xl flex items-center justify-between gap-3 text-rose-800 dark:text-rose-300 animate-in fade-in duration-150 shadow-xs">
                                    <div className="flex items-center gap-2.5">
                                        <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                                        <span className="text-xs font-bold">
                                            {formErrors.server_error || `Please fill in the compulsory field${Object.keys(formErrors).length > 1 ? 's' : ''} highlighted in red below.`}
                                        </span>
                                    </div>
                                    {!formErrors.server_error && (
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-200">
                                            {Object.keys(formErrors).length} required
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Step 1: Customer & Linked Quotation Logistics */}
                            <div className="bg-slate-50/80 dark:bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3 sm:space-y-4">
                                <h3 className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                                    1. Customer & Linked Quotation Details
                                </h3>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Linked Outward Quotation <span className="text-slate-400 font-normal">(Optional - Auto-Fills Customer & Rates)</span>
                                        </label>
                                        <SearchableSelect
                                            options={[
                                                { value: '', label: '-- None (Direct Customer PO) --' },
                                                ...(Array.isArray(quotations) ? quotations : []).map(q => ({
                                                    value: q._id,
                                                    label: `${q.quotationNumber} - ${q.customerName || 'Customer'} (₹${Number(q.totalAmount || 0).toLocaleString()})`
                                                }))
                                            ]}
                                            value={selectedQuoteId}
                                            onChange={(val: any) => {
                                                if (!val) {
                                                    setSelectedQuoteId('');
                                                    setNewPo(prev => ({ ...prev, quotationReference: '' }));
                                                } else {
                                                    handleSelectQuotation(val);
                                                }
                                            }}
                                            placeholder="Select Linked Quotation (Optional)..."
                                        />
                                    </div>

                                    <div className="sm:col-span-2 space-y-1" data-has-error={!!formErrors.customer}>
                                        <label className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            <span>Customer from Master <span className="text-rose-500">*</span></span>
                                            {formErrors.customer && <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">{formErrors.customer}</span>}
                                        </label>
                                        <SearchableSelect
                                            options={(Array.isArray(customers) ? customers : []).map(c => ({
                                                value: (c._id || c.id)?.toString(),
                                                label: `${c.name || c.companyName} ${c.code ? `(${c.code})` : ''} ${c.city ? `- ${c.city}` : ''}`.trim()
                                            }))}
                                            value={newPo.customer}
                                            hasError={!!formErrors.customer}
                                            onChange={(val: any) => handleSelectCustomer(val)}
                                            placeholder="Search & Select Customer from Master..."
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-blue-600 dark:text-blue-400 mb-1.5">
                                            Currency *
                                        </label>
                                        <select
                                            value={newPo.currency || 'INR'}
                                            onChange={(e) => setNewPo({ ...newPo, currency: e.target.value })}
                                            className="w-full px-3.5 py-2 bg-blue-50/50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-sm font-bold text-blue-700 dark:text-blue-300 outline-none focus:ring-2 focus:ring-blue-500/20"
                                        >
                                            {CURRENCY_OPTIONS.map((c) => (
                                                <option key={c.code} value={c.code}>
                                                    {c.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-1" data-has-error={!!formErrors.poNumber}>
                                        <label className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            <span>Customer PO Number <span className="text-rose-500">*</span></span>
                                            {formErrors.poNumber && <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">{formErrors.poNumber}</span>}
                                        </label>
                                        <input
                                            type="text"
                                            value={newPo.poNumber}
                                            onChange={(e) => {
                                                setNewPo({ ...newPo, poNumber: e.target.value });
                                                if (e.target.value.trim()) clearError('poNumber');
                                            }}
                                            placeholder="e.g. PO-CUST-8823"
                                            className={`w-full px-3.5 py-2 rounded-xl text-sm font-semibold outline-none transition-all ${
                                                formErrors.poNumber
                                                    ? 'bg-rose-50/50 dark:bg-rose-950/40 border border-rose-500 text-rose-900 dark:text-rose-100 ring-1 ring-rose-400'
                                                    : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20'
                                            }`}
                                        />
                                    </div>

                                    <div className="space-y-1" data-has-error={!!formErrors.date}>
                                        <label className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            <span>Customer PO Date <span className="text-rose-500">*</span></span>
                                            {formErrors.date && <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">{formErrors.date}</span>}
                                        </label>
                                        <input
                                            type="date"
                                            value={newPo.date}
                                            onChange={(e) => {
                                                setNewPo({ ...newPo, date: e.target.value });
                                                if (e.target.value) clearError('date');
                                            }}
                                            className={`w-full px-3.5 py-2 rounded-xl text-sm font-semibold outline-none transition-all ${
                                                formErrors.date
                                                    ? 'bg-rose-50/50 dark:bg-rose-950/40 border border-rose-500 text-rose-900 dark:text-rose-100 ring-1 ring-rose-400'
                                                    : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20'
                                            }`}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Transportation Mode
                                        </label>
                                        <select
                                            value={newPo.transportationMethod}
                                            onChange={(e) => setNewPo({ ...newPo, transportationMethod: e.target.value })}
                                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none"
                                        >
                                            <option value="Road Freight">Road Freight (By Truck)</option>
                                            <option value="Air Freight">Air Freight (Express)</option>
                                            <option value="Sea Freight">Sea Freight (Cargo)</option>
                                            <option value="Courier Service">Courier Service</option>
                                            <option value="Customer Pickup">Customer Self Pickup</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Freight / Transport Charges ({getCurrencySymbol(newPo.currency)})
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={newPo.transportationCharges}
                                            onChange={(e) => {
                                                const val = Number(e.target.value) || 0;
                                                setNewPo(prev => ({ ...prev, transportationCharges: val }));
                                                recalculateTotals(newPo.items);
                                            }}
                                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Step 2: Ordered Items - 1 Line on Desktop */}
                            <div className="bg-slate-50/80 dark:bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                                        2. Ordered Items & Line Pricing
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={handleAddItem}
                                        className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/80 bg-blue-50 dark:bg-blue-950/60 px-3.5 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
                                    >
                                        + Add Item
                                    </button>
                                </div>

                                {/* Desktop Table Header */}
                                <div className="hidden lg:grid grid-cols-12 gap-3 px-3 py-1.5 text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    <div className="col-span-3">FG Item * (Price List)</div>
                                    <div className="col-span-2">Specifications</div>
                                    <div className="col-span-1 text-center">HSN</div>
                                    <div className="col-span-1 text-center">Qty</div>
                                    <div className="col-span-1 text-center">Unit</div>
                                    <div className="col-span-2 text-right">Unit Rate ({getCurrencySymbol(newPo.currency)})</div>
                                    <div className="col-span-1 text-center">GST %</div>
                                    <div className="col-span-1 text-right">Action</div>
                                </div>

                                {/* Items Rows */}
                                <div className="space-y-2.5">
                                    {newPo.items.map((item, idx) => (
                                        <div key={idx} className="p-3 sm:p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                            <div className="grid grid-cols-12 gap-2.5 sm:gap-3 items-center">
                                                
                                                {/* FG Item Column */}
                                                <div className="col-span-12 lg:col-span-3" data-has-error={!!formErrors[`item_${idx}_fgItem`]}>
                                                    <label className="flex justify-between items-center lg:hidden text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                                        <span>FG Item <span className="text-rose-500">*</span></span>
                                                        {formErrors[`item_${idx}_fgItem`] && <span className="text-[9px] text-rose-600 dark:text-rose-400 font-bold">{formErrors[`item_${idx}_fgItem`]}</span>}
                                                    </label>
                                                    <SearchableSelect
                                                        options={fgOptions}
                                                        value={item.fgItem}
                                                        hasError={!!formErrors[`item_${idx}_fgItem`]}
                                                        onChange={(val: any) => handleItemChange(idx, 'fgItem', val)}
                                                        placeholder="Select FG Item..."
                                                    />
                                                </div>

                                                {/* Specifications */}
                                                <div className="col-span-12 sm:col-span-6 lg:col-span-2">
                                                    <label className="block lg:hidden text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                                        Specifications
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={item.description || ''}
                                                        onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                                                        placeholder="Specs, grade, dimensions..."
                                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                                                    />
                                                </div>

                                                {/* HSN Code Column */}
                                                <div className="col-span-6 sm:col-span-3 lg:col-span-1">
                                                    <label className="block lg:hidden text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                                        HSN
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={item.hsnCode || ''}
                                                        onChange={(e) => handleItemChange(idx, 'hsnCode', e.target.value)}
                                                        placeholder="HSN"
                                                        className="w-full px-2 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-slate-200 text-center outline-none focus:ring-1 focus:ring-blue-500"
                                                    />
                                                </div>

                                                {/* Qty */}
                                                <div className="col-span-6 sm:col-span-3 lg:col-span-1" data-has-error={!!formErrors[`item_${idx}_quantity`]}>
                                                    <label className="flex justify-between items-center lg:hidden text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                                        <span>Qty <span className="text-rose-500">*</span></span>
                                                        {formErrors[`item_${idx}_quantity`] && <span className="text-[9px] text-rose-600 dark:text-rose-400 font-bold">{formErrors[`item_${idx}_quantity`]}</span>}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={item.quantity}
                                                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                                        className={`w-full px-2 py-2 border rounded-xl text-xs font-bold text-center outline-none transition-all ${
                                                            formErrors[`item_${idx}_quantity`]
                                                                ? 'bg-rose-50/50 dark:bg-rose-950/40 border-rose-500 text-rose-900 dark:text-rose-100 ring-1 ring-rose-400'
                                                                : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white'
                                                        }`}
                                                    />
                                                </div>

                                                {/* Unit */}
                                                <div className="col-span-6 sm:col-span-3 lg:col-span-1">
                                                    <label className="block lg:hidden text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                                        Unit
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={item.unit || 'PCS'}
                                                        onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                                                        className="w-full px-2 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 text-center"
                                                    />
                                                </div>

                                                {/* Rate */}
                                                <div className="col-span-6 sm:col-span-4 lg:col-span-2" data-has-error={!!formErrors[`item_${idx}_rate`]}>
                                                    <label className="flex justify-between items-center lg:hidden text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                                        <span>Rate <span className="text-rose-500">*</span></span>
                                                        {formErrors[`item_${idx}_rate`] && <span className="text-[9px] text-rose-600 dark:text-rose-400 font-bold">{formErrors[`item_${idx}_rate`]}</span>}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={item.rate}
                                                        onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                                                        placeholder={`Rate ${getCurrencySymbol(newPo.currency)}`}
                                                        className={`w-full px-3 py-2 border rounded-xl text-xs font-extrabold text-right font-mono outline-none transition-all ${
                                                            formErrors[`item_${idx}_rate`]
                                                                ? 'bg-rose-50/50 dark:bg-rose-950/40 border-rose-500 text-rose-900 dark:text-rose-100 ring-1 ring-rose-400'
                                                                : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-blue-600 dark:text-blue-400'
                                                        }`}
                                                    />
                                                </div>

                                                {/* GST % */}
                                                <div className="col-span-4 sm:col-span-3 lg:col-span-1">
                                                    <label className="block lg:hidden text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                                        GST %
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="28"
                                                        value={item.taxRate}
                                                        onChange={(e) => handleItemChange(idx, 'taxRate', e.target.value)}
                                                        className="w-full px-2 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 text-center"
                                                    />
                                                </div>

                                                {/* Action Column */}
                                                <div className="col-span-2 sm:col-span-2 lg:col-span-1 flex justify-end items-end pb-0.5 gap-1.5">
                                                    {idx === newPo.items.length - 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={handleAddItem}
                                                            className="p-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded-xl transition-colors cursor-pointer shadow-2xs"
                                                            title="Add Next Line Item"
                                                        >
                                                            <Plus size={18} />
                                                        </button>
                                                    )}
                                                    {newPo.items.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveItem(idx)}
                                                            className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                                                            title="Remove Item"
                                                        >
                                                            <X size={18} />
                                                        </button>
                                                    )}
                                                </div>

                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Bottom Add Line Item Bar */}
                                <div className="pt-1.5">
                                    <button
                                        type="button"
                                        onClick={handleAddItem}
                                        className="w-full py-3 px-4 border-2 border-dashed border-blue-200 hover:border-blue-500 dark:border-blue-800/80 dark:hover:border-blue-500 bg-blue-50/40 hover:bg-blue-50 dark:bg-blue-950/20 dark:hover:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-2xs cursor-pointer active:scale-[0.99] group"
                                    >
                                        <Plus size={16} className="text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
                                        <span>+ Add New Line Item</span>
                                    </button>
                                </div>
                            </div>

                            {/* Step 3: PO Document / Photo Attachment & Remarks */}
                            <div className="bg-slate-50/80 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4">
                                <h3 className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-2">
                                    <Paperclip size={15} /> 3. Customer PO Attachment (PDF or JPEG / PNG Photo) & Notes
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    {/* Upload Zone */}
                                    <div className="space-y-2">
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                            Upload Customer PO File / Photo <span className="text-slate-400 font-normal">(PDF, JPG, JPEG, PNG up to 15MB)</span>
                                        </label>

                                        {!poFile && !existingPdf && existingPhotos.length === 0 ? (
                                            <label
                                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                                                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                                                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setIsDragging(false);
                                                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                                        handleFileChange({ target: { files: e.dataTransfer.files } } as any);
                                                    }
                                                }}
                                                className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all group ${
                                                    isDragging
                                                        ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/60 ring-4 ring-blue-500/20 scale-[1.01]'
                                                        : 'border-slate-300 dark:border-slate-700 hover:border-blue-500 bg-white dark:bg-slate-900'
                                                }`}
                                            >
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-2 transition-transform ${
                                                    isDragging
                                                        ? 'bg-blue-600 text-white scale-110 animate-bounce'
                                                        : 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 group-hover:scale-110'
                                                }`}>
                                                    <Upload size={22} />
                                                </div>
                                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                                    {isDragging ? 'Drop PO File Here' : 'Click to upload or drag & drop PO'}
                                                </span>
                                                <span className="text-[11px] text-slate-400 mt-0.5">
                                                    PDF Document or JPEG / PNG Photo of Customer PO
                                                </span>
                                                <input
                                                    type="file"
                                                    accept=".pdf, .jpg, .jpeg, .png, image/*, application/pdf"
                                                    onChange={handleFileChange}
                                                    className="hidden"
                                                />
                                            </label>
                                        ) : (
                                            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                                                {/* New File Selected */}
                                                {poFile && (
                                                    <div className="flex items-center justify-between gap-3 p-3 bg-blue-50/70 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            {poFilePreview ? (
                                                                <img src={poFilePreview} alt="PO Preview" className="w-12 h-12 object-cover rounded-lg border border-blue-300 shadow-sm" />
                                                            ) : (
                                                                <div className="w-12 h-12 bg-red-100 dark:bg-red-950/80 text-red-600 rounded-lg flex flex-col items-center justify-center font-bold text-[10px] shadow-sm">
                                                                    <FileText size={18} />
                                                                    PDF
                                                                </div>
                                                            )}
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{poFile.name}</p>
                                                                <p className="text-[10px] text-slate-500 font-mono">{(poFile.size / 1024).toFixed(1)} KB • {poFile.type || 'Document'}</p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setPoFile(null);
                                                                setPoFilePreview(null);
                                                            }}
                                                            className="p-1.5 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950 rounded-lg transition-colors"
                                                            title="Remove File"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Existing Attached File (if in edit mode without new file) */}
                                                {!poFile && (existingPdf || existingPhotos.length > 0) && (
                                                    <div className="space-y-2">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Current Attached Document</span>
                                                        {existingPdf && (
                                                            <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                                                <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400">
                                                                    <FileText size={16} className="text-red-500" /> Attached Customer PO (PDF)
                                                                </div>
                                                                <a
                                                                    href={existingPdf}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                                                                >
                                                                    <Eye size={13} /> View
                                                                </a>
                                                            </div>
                                                        )}
                                                        {existingPhotos.map((photoUrl, idx) => (
                                                            <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                                                                    <img src={photoUrl} alt="PO photo" className="w-8 h-8 object-cover rounded border" /> PO Photo #{idx + 1}
                                                                </div>
                                                                <a
                                                                    href={photoUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                                                                >
                                                                    <Eye size={13} /> View
                                                                </a>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                <label className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                                                    <Upload size={13} /> Change / Replace Attachment
                                                    <input
                                                        type="file"
                                                        accept=".pdf, .jpg, .jpeg, .png, image/*, application/pdf"
                                                        onChange={handleFileChange}
                                                        className="hidden"
                                                    />
                                                </label>
                                            </div>
                                        )}
                                    </div>

                                    {/* Remarks / Customer Instructions */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Remarks / Customer PO Terms & Notes
                                        </label>
                                        <textarea
                                            rows={4}
                                            value={newPo.remarks}
                                            onChange={(e) => setNewPo({ ...newPo, remarks: e.target.value })}
                                            placeholder="Enter any special customer delivery instructions, payment terms, or inspection notes..."
                                            className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Summary Card */}
                            <div className="bg-blue-50/70 dark:bg-blue-950/40 p-4 sm:p-5 rounded-2xl border border-blue-200 dark:border-blue-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
                                <div className="text-xs space-y-1">
                                    <div className="font-bold text-slate-700 dark:text-slate-300">
                                        Subtotal: <span className="font-mono text-slate-900 dark:text-white">{getCurrencySymbol(newPo.currency)}{newPo.subtotal.toLocaleString()}</span>
                                    </div>
                                    <div className="font-bold text-slate-700 dark:text-slate-300">
                                        Total Tax (GST): <span className="font-mono text-slate-900 dark:text-white">{getCurrencySymbol(newPo.currency)}{newPo.taxAmount.toLocaleString()}</span>
                                    </div>
                                </div>
                                <div className="text-left sm:text-right">
                                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Grand Total PO Amount ({newPo.currency || 'INR'})</span>
                                    <span className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
                                        {getCurrencySymbol(newPo.currency)}{newPo.totalAmount.toLocaleString()}
                                    </span>
                                </div>
                            </div>

                        </div>

                        <div className="p-3.5 sm:p-5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 flex-shrink-0">
                            <button onClick={() => { setIsCreateModalOpen(false); setEditingPo(null); }} className="w-full sm:w-auto px-5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                                Cancel
                            </button>
                            <button
                                onClick={handleCreatePoSubmit}
                                disabled={submitting}
                                className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <FileCheck size={16} />
                                {submitting ? 'Saving...' : (editingPo ? 'Update Customer PO' : 'Save Customer PO')}
                            </button>
                        </div>

                    </div>
                </div>
            )}

            {/* View Details & Document Fulfillment Timeline Modal */}
            {selectedPo && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-[98vw] xl:max-w-7xl 2xl:max-w-[1550px] overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
                        
                        <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white flex justify-between items-center flex-shrink-0 border-b border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                                    <FileCheck size={20} />
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-base sm:text-lg font-black font-mono tracking-tight text-blue-600 dark:text-blue-400 truncate">{selectedPo.poNumber}</h2>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">Customer PO Overview, User Ownership Audit & Document Timeline</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedPo(null)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-2"
                                title="Close"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Tab Bar */}
                        <div className="flex overflow-x-auto bg-slate-100 dark:bg-slate-800/80 px-3 sm:px-6 pt-2 border-b border-slate-200 dark:border-slate-800 gap-1.5 sm:gap-2 flex-shrink-0">
                            <button
                                onClick={() => setActiveViewTab('overview')}
                                className={`px-4 sm:px-5 py-2.5 font-bold text-xs flex items-center gap-2 rounded-t-xl transition-all whitespace-nowrap cursor-pointer ${
                                    activeViewTab === 'overview'
                                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 border-t-2 border-x border-blue-600 dark:border-blue-500 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                }`}
                            >
                                <FileText size={15} /> Customer PO Overview & Items
                            </button>
                            <button
                                onClick={() => setActiveViewTab('dispatch')}
                                className={`px-4 sm:px-5 py-2.5 font-bold text-xs flex items-center gap-2 rounded-t-xl transition-all whitespace-nowrap cursor-pointer ${
                                    activeViewTab === 'dispatch'
                                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 border-t-2 border-x border-blue-600 dark:border-blue-500 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                }`}
                            >
                                <Truck size={15} /> Dispatch & Billing Timeline ({timelineData.deliveryChallans.length} DCs, {timelineData.invoices.length} Invoices)
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-6 flex-1">
                            
                            {activeViewTab === 'overview' ? (
                                /* TAB 1: OVERVIEW & ITEMS */
                                <div className="space-y-6">
                                    {/* General Status & Interactive Control */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3.5 text-xs bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                                        <div>
                                            <span className="text-slate-400 block mb-0.5">Linked Quotation Ref:</span>
                                            <strong className="text-blue-600 dark:text-blue-400 font-mono font-bold">
                                                {selectedPo.quotationReference?.quotationNumber || 'Direct PO'}
                                            </strong>
                                        </div>

                                        <div>
                                            <span className="text-slate-400 block mb-0.5">Customer PO Date:</span>
                                            <strong className="text-slate-800 dark:text-slate-200 font-bold">
                                                {selectedPo.date ? new Date(selectedPo.date).toLocaleDateString('en-GB') : 'N/A'}
                                            </strong>
                                        </div>

                                        <div>
                                            <span className="text-slate-400 block mb-0.5">OA Committed Date / Day:</span>
                                            {selectedPo.committedDispatchDate ? (
                                                <div className="flex items-center gap-1 flex-wrap">
                                                    <strong className="text-indigo-600 dark:text-indigo-400 font-bold">
                                                        {new Date(selectedPo.committedDispatchDate).toLocaleDateString('en-GB')}
                                                    </strong>
                                                    {(() => {
                                                        if (selectedPo.date && selectedPo.committedDispatchDate) {
                                                            const d = Math.max(0, Math.round((new Date(selectedPo.committedDispatchDate).getTime() - new Date(selectedPo.date).getTime()) / (1000 * 60 * 60 * 24)));
                                                            return (
                                                                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                                                    {d}d
                                                                </span>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 italic text-xs">Pending OA</span>
                                            )}
                                        </div>

                                        <div>
                                            <span className="text-slate-400 block mb-0.5">Currency:</span>
                                            <strong className="text-blue-600 dark:text-blue-400 font-bold">
                                                {selectedPo.currency || 'INR'} ({getCurrencySymbol(selectedPo.currency)})
                                            </strong>
                                        </div>

                                        <div>
                                            <span className="text-slate-400 block mb-0.5">Total PO Value:</span>
                                            <strong className="text-blue-600 font-extrabold font-mono text-sm block">
                                                {getCurrencySymbol(selectedPo.currency)}{Number(selectedPo.totalAmount || selectedPo.subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </strong>
                                            {(() => {
                                                const inr = convertToINR(Number(selectedPo.totalAmount || selectedPo.subtotal || 0), selectedPo.currency);
                                                if (!inr.isForeign) return null;
                                                return (
                                                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 font-mono block mt-0.5">
                                                        ≈ {inr.formattedINR} (Rate: ₹{inr.rate.toFixed(2)})
                                                    </span>
                                                );
                                            })()}
                                        </div>

                                        <div>
                                            <span className="text-slate-400 block mb-0.5">Fulfillment Status:</span>
                                            <select
                                                value={selectedPo.status || 'Received'}
                                                onChange={(e) => handleStatusChange(selectedPo._id, e.target.value)}
                                                className="px-3 py-1 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 outline-none cursor-pointer"
                                            >
                                                <option value="Received">Received</option>
                                                <option value="Accepted">Accepted</option>
                                                <option value="MRP Done">MRP Done</option>
                                                <option value="Partially Dispatched">Partially Dispatched</option>
                                                <option value="Completed">Completed</option>
                                                <option value="Cancelled">Cancelled</option>
                                            </select>
                                        </div>

                                        <div>
                                            <span className="text-slate-400 block mb-0.5">Edit/Delete Window:</span>
                                            {(() => {
                                                const remSecs = getRemainingEditSeconds(selectedPo.createdAt || selectedPo.date);
                                                if (remSecs > 0) {
                                                    return (
                                                        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 rounded-lg font-mono text-[11px] font-bold border border-amber-200 dark:border-amber-800 inline-flex items-center gap-1">
                                                            <Clock size={11} className="text-amber-600 animate-pulse" />
                                                            {formatRemainingTime(remSecs)}
                                                        </span>
                                                    );
                                                }
                                                return (
                                                    <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-500 rounded-lg text-[11px] font-bold inline-flex items-center gap-1">
                                                        <Lock size={11} /> Locked
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                    </div>

                                    {/* User Audit Ownership Box */}
                                    <div className="p-4 bg-blue-50/60 dark:bg-blue-950/40 rounded-2xl border border-blue-200 dark:border-blue-800 space-y-3">
                                        <h4 className="text-xs font-extrabold text-blue-900 dark:text-blue-200 uppercase tracking-wider flex items-center gap-1.5">
                                            <ShieldCheck size={16} className="text-blue-600 dark:text-blue-400" />
                                            User Audit Tracking & Ownership
                                        </h4>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-blue-100 dark:border-blue-900">
                                                <User size={16} className="text-blue-600 shrink-0" />
                                                <div className="truncate">
                                                    <span className="text-[10px] text-slate-400 block">Created / Logged By User</span>
                                                    <strong className="text-slate-800 dark:text-slate-200 font-bold truncate block">{getUserName(selectedPo.createdBy || selectedPo.receivedBy)}</strong>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-blue-100 dark:border-blue-900">
                                                <UserCheck size={16} className="text-emerald-600 shrink-0" />
                                                <div className="truncate">
                                                    <span className="text-[10px] text-slate-400 block">Last Updated By User</span>
                                                    <strong className="text-slate-800 dark:text-slate-200 font-bold truncate block">{getUserName(selectedPo.updatedBy || selectedPo.createdBy || selectedPo.receivedBy)}</strong>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status Audit History Log */}
                                        {Array.isArray(selectedPo.statusHistory) && selectedPo.statusHistory.length > 0 && (
                                            <div className="pt-2 border-t border-blue-100 dark:border-blue-900 space-y-2">
                                                <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1">
                                                    <History size={13} /> Status Audit History Log
                                                </span>
                                                <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                                                    {selectedPo.statusHistory.map((h: any, idx: number) => (
                                                        <div key={idx} className="flex justify-between items-center text-[11px] bg-white/80 dark:bg-slate-900/80 px-3 py-1.5 rounded-lg border border-blue-100/60 dark:border-blue-900/60">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded text-[10px]">
                                                                    {h.status}
                                                                </span>
                                                                <span className="text-slate-600 dark:text-slate-400 font-medium">By: {getUserName(h.updatedBy)}</span>
                                                            </div>
                                                            <span className="text-slate-400 font-mono text-[10px]">
                                                                {h.updatedAt ? new Date(h.updatedAt).toLocaleString('en-GB') : ''}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Customer Info Card */}
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                            <Building2 size={14} className="text-blue-500" /> Customer Information
                                        </h4>
                                        <div className="font-extrabold text-slate-900 dark:text-white text-sm">
                                            {selectedPo.customerName || selectedPo.customer?.name || 'Customer'}
                                        </div>
                                        <div className="text-slate-500 font-medium space-x-3">
                                            {selectedPo.customer?.email && <span>Email: {selectedPo.customer.email}</span>}
                                            {selectedPo.customer?.phone && <span>Phone: {selectedPo.customer.phone}</span>}
                                        </div>
                                    </div>

                                    {/* Ordered FG Items Section */}
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Ordered FG Items & Rates</h4>
                                        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                                            <table className="w-full text-xs text-left">
                                                <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">
                                                    <tr>
                                                        <th className="p-3">FG Item Name</th>
                                                        <th className="p-3 text-center">HSN</th>
                                                        <th className="p-3 text-center">Ordered Qty</th>
                                                        <th className="p-3 text-right">Unit Rate ({selectedPo.currency || 'INR'})</th>
                                                        <th className="p-3 text-center">GST %</th>
                                                        <th className="p-3 text-right">Line Total ({selectedPo.currency || 'INR'})</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                                    {(selectedPo.items || []).map((item: any, idx: number) => {
                                                        const qty = Number(item.quantity) || 1;
                                                        const rate = Number(item.rate) || 0;
                                                        const tax = Number(item.taxRate != null ? item.taxRate : 18);
                                                        const lineTotal = item.amount ? Number(item.amount) : (qty * rate * (1 + tax / 100));

                                                        return (
                                                            <tr key={idx}>
                                                                <td className="p-3 font-bold">
                                                                    {item.fgItem?.name || item.productName || 'FG Item'}
                                                                    {item.fgItem?.code && <span className="text-[10px] text-slate-400 font-mono ml-1">[{item.fgItem.code}]</span>}
                                                                    {item.description && <span className="block text-[10px] font-normal text-slate-400">{item.description}</span>}
                                                                </td>
                                                                <td className="p-3 text-center font-mono text-xs text-slate-600 dark:text-slate-400">{item.hsnCode || item.hsn || '-'}</td>
                                                                <td className="p-3 text-center font-bold text-blue-600">{qty} {item.unit || 'PCS'}</td>
                                                                <td className="p-3 text-right font-bold font-mono">{getCurrencySymbol(selectedPo.currency)}{rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                                <td className="p-3 text-center font-bold text-slate-600">{tax}%</td>
                                                                <td className="p-3 text-right font-extrabold font-mono text-blue-600">{getCurrencySymbol(selectedPo.currency)}{lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Customer PO Attachment Card */}
                                    {(selectedPo.pdf || (Array.isArray(selectedPo.photos) && selectedPo.photos.length > 0)) ? (
                                        <div className="p-5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                                <h4 className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                                                    <Paperclip size={16} /> Customer Purchase Order Attachment (Original Copy)
                                                </h4>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {selectedPo.pdf && (
                                                        <a
                                                            href={selectedPo.pdf}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5 shadow-sm"
                                                        >
                                                            <Eye size={14} /> Preview Original PDF <ExternalLink size={12} />
                                                        </a>
                                                    )}
                                                    {Array.isArray(selectedPo.photos) && selectedPo.photos.map((photo: string, idx: number) => (
                                                        <a
                                                            key={idx}
                                                            href={photo}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5 shadow-sm"
                                                        >
                                                            <Eye size={14} /> Preview Photo #{idx + 1} <ExternalLink size={12} />
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* PDF Embedded Frame or Image Display */}
                                            {selectedPo.pdf ? (
                                                <div className="w-full h-96 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white shadow-inner">
                                                    <iframe
                                                        src={`${selectedPo.pdf}#toolbar=0`}
                                                        className="w-full h-full"
                                                        title="Customer PO PDF"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="flex flex-wrap gap-4 pt-2">
                                                    {(selectedPo.photos || []).map((photo: string, idx: number) => (
                                                        <a
                                                            key={idx}
                                                            href={photo}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="group block relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-lg transition-all"
                                                        >
                                                            <img src={photo} alt={`PO photo ${idx + 1}`} className="h-48 w-auto object-cover group-hover:scale-105 transition-transform duration-300" />
                                                            <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs gap-1.5 backdrop-blur-[2px]">
                                                                <Eye size={16} /> Open Full Size
                                                            </div>
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-400">
                                            No PO document copy or photo was attached when this order was created.
                                        </div>
                                    )}

                                    {/* Remarks & Notes */}
                                    {selectedPo.remarks && (
                                        <div className="p-4 bg-amber-50/60 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-900/50 space-y-1 text-xs">
                                            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
                                                Customer Notes / Remarks
                                            </span>
                                            <p className="text-slate-700 dark:text-slate-300 font-medium whitespace-pre-wrap">{selectedPo.remarks}</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* TAB 2: DISPATCH TIMELINE & ITEM BALANCE TRACKING */
                                <div className="space-y-6">
                                    {(() => {
                                        const dcs = timelineData.deliveryChallans || [];
                                        const invs = timelineData.invoices || [];

                                        // Compute item-by-item remaining balance
                                        const itemFulfillmentList = (selectedPo.items || []).map((poItem: any) => {
                                            const fgId = poItem.fgItem?._id || poItem.fgItem;
                                            const pName = (poItem.productName || poItem.fgItem?.name || '').toLowerCase().trim();
                                            const ordQty = Number(poItem.quantity || 0);

                                            // Sum matching DC quantities
                                            let dcQty = 0;
                                            dcs.forEach((dc: any) => {
                                                (dc.items || []).forEach((dcIt: any) => {
                                                    const dcFgId = dcIt.material || dcIt.component || dcIt.fgItem;
                                                    const dcName = (dcIt.materialName || dcIt.componentName || dcIt.name || '').toLowerCase().trim();
                                                    if ((fgId && dcFgId && fgId.toString() === dcFgId.toString()) || (pName && dcName && pName === dcName)) {
                                                        dcQty += Number(dcIt.quantity || 0);
                                                    }
                                                });
                                            });

                                            // Sum matching Invoice quantities
                                            let invQty = 0;
                                            invs.forEach((inv: any) => {
                                                (inv.items || []).forEach((invIt: any) => {
                                                    const invFgId = invIt.material || invIt.component || invIt.fgItem;
                                                    const invName = (invIt.materialName || invIt.componentName || invIt.name || '').toLowerCase().trim();
                                                    if ((fgId && invFgId && fgId.toString() === invFgId.toString()) || (pName && invName && pName === invName)) {
                                                        invQty += Number(invIt.quantity || 0);
                                                    }
                                                });
                                            });

                                            // Effective fulfilled is max of DC dispatched and Invoiced
                                            const fulfilledQty = Math.max(dcQty, invQty);
                                            const remainingQty = Math.max(0, ordQty - fulfilledQty);

                                            return {
                                                productName: poItem.productName || poItem.fgItem?.name || 'Product Item',
                                                unit: poItem.unit || 'PCS',
                                                orderedQty: ordQty,
                                                dcQty,
                                                invQty,
                                                fulfilledQty,
                                                remainingQty,
                                                status: remainingQty === 0 ? 'Fulfilled' : (fulfilledQty > 0 ? 'Partial' : 'Pending')
                                            };
                                        });

                                        const totalOrd = itemFulfillmentList.reduce((acc: number, cur: any) => acc + cur.orderedQty, 0);
                                        const totalFulfilled = itemFulfillmentList.reduce((acc: number, cur: any) => acc + cur.fulfilledQty, 0);
                                        const fulfillmentPct = totalOrd > 0 ? Math.min(100, Math.round((totalFulfilled / totalOrd) * 100)) : 0;

                                        return (
                                            <div className="space-y-6">
                                                
                                                {/* Header Stats Bar */}
                                                <div className="p-4 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                                    <div>
                                                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                                                            <PackageCheck size={16} className="text-slate-600 dark:text-slate-400" /> Item Fulfillment & Remaining Balance Summary
                                                        </h4>
                                                        <p className="text-xs text-slate-500 mt-0.5">Generating a DC or Invoice reduces item remaining balance quantity.</p>
                                                    </div>
                                                    <div className="text-xs font-bold bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                                                        Total Progress: <span className="font-mono text-slate-900 dark:text-white font-extrabold">{totalFulfilled} / {totalOrd} PCS</span> ({fulfillmentPct}%)
                                                    </div>
                                                </div>

                                                {/* Item-by-Item Balance Matrix Table */}
                                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                                                    <div className="p-3 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-700 dark:text-slate-300">
                                                        Item-by-Item Remaining Balance Tracker
                                                    </div>
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-xs text-left">
                                                            <thead className="bg-slate-50 dark:bg-slate-800 font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                                                <tr>
                                                                    <th className="p-3">Product Item</th>
                                                                    <th className="p-3 text-center">Ordered Qty</th>
                                                                    <th className="p-3 text-center">DC Dispatched</th>
                                                                    <th className="p-3 text-center">Invoiced Qty</th>
                                                                    <th className="p-3 text-center bg-blue-50/50 dark:bg-blue-950/30">Remaining Balance</th>
                                                                    <th className="p-3 text-center">Item Status</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                                                {itemFulfillmentList.map((row: any, idx: number) => (
                                                                    <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50">
                                                                        <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{row.productName}</td>
                                                                        <td className="p-3 text-center font-bold text-slate-700 dark:text-slate-300">{row.orderedQty} {row.unit}</td>
                                                                        <td className="p-3 text-center font-mono text-slate-700 dark:text-slate-300">{row.dcQty} {row.unit}</td>
                                                                        <td className="p-3 text-center font-mono text-slate-700 dark:text-slate-300">{row.invQty} {row.unit}</td>
                                                                        <td className="p-3 text-center font-mono font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-950/20">
                                                                            {row.remainingQty} {row.unit}
                                                                        </td>
                                                                        <td className="p-3 text-center">
                                                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                                                                row.status === 'Fulfilled' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                                                                                row.status === 'Partial' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                                                                                'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                                                            }`}>
                                                                                {row.status}
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>

                                                {/* Independent Dispatch Documents: DCs and Invoices */}
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                    
                                                    {/* Delivery Challans (DC) */}
                                                    <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                                                        <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                                                            <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                                                <Truck size={15} className="text-slate-500" /> Delivery Challans (DC) ({dcs.length})
                                                            </h5>
                                                        </div>

                                                        {dcs.length === 0 ? (
                                                            <p className="text-slate-400 italic text-xs py-4 text-center">No Delivery Challans generated yet.</p>
                                                        ) : (
                                                            <div className="space-y-2.5 max-h-72 overflow-y-auto">
                                                                {dcs.map((dc: any) => (
                                                                    <div key={dc._id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
                                                                        <div className="flex justify-between items-center">
                                                                            <span className="font-mono font-extrabold text-slate-900 dark:text-white">{dc.dcNumber}</span>
                                                                            <span className="text-slate-500 font-mono text-[11px]">{dc.date ? new Date(dc.date).toLocaleDateString('en-GB') : ''}</span>
                                                                        </div>
                                                                        {Array.isArray(dc.items) && dc.items.length > 0 && (
                                                                            <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700/60 space-y-1">
                                                                                {dc.items.map((it: any, iIdx: number) => (
                                                                                    <div key={iIdx} className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300">
                                                                                        <span>• {it.materialName || it.componentName || it.name || 'Dispatched Item'}</span>
                                                                                        <span className="font-mono font-bold text-slate-900 dark:text-white">{it.quantity} {it.unit || 'PCS'}</span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Tax Invoices */}
                                                    <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                                                        <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                                                            <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                                                <IndianRupee size={15} className="text-slate-500" /> Tax Invoices ({invs.length})
                                                            </h5>
                                                        </div>

                                                        {invs.length === 0 ? (
                                                            <p className="text-slate-400 italic text-xs py-4 text-center">No Tax Invoices generated yet.</p>
                                                        ) : (
                                                            <div className="space-y-2.5 max-h-72 overflow-y-auto">
                                                                {invs.map((inv: any) => (
                                                                    <div key={inv._id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
                                                                        <div className="flex justify-between items-center">
                                                                            <span className="font-mono font-extrabold text-slate-900 dark:text-white">{inv.invoiceNumber}</span>
                                                                            <span className="text-slate-500 font-mono text-[11px]">{inv.date ? new Date(inv.date).toLocaleDateString('en-GB') : ''}</span>
                                                                        </div>
                                                                        <div className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
                                                                            Amount: ₹{Number(inv.totalAmount || 0).toLocaleString()}
                                                                        </div>
                                                                        {Array.isArray(inv.items) && inv.items.length > 0 && (
                                                                            <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700/60 space-y-1">
                                                                                {inv.items.map((it: any, iIdx: number) => (
                                                                                    <div key={iIdx} className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300">
                                                                                        <span>• {it.materialName || it.componentName || it.name || 'Billed Item'}</span>
                                                                                        <span className="font-mono font-bold text-slate-900 dark:text-white">{it.quantity} {it.unit || 'PCS'}</span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                </div>

                                            </div>
                                        );
                                    })()}
                                </div>
                            )}

                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-slate-800 flex flex-wrap justify-between items-center gap-3 border-t border-slate-200 dark:border-slate-700">
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setAcknowledgingPo(selectedPo)}
                                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
                                    title="Acknowledge Order, Set Commitment Dates & Print OA"
                                >
                                    <FileText size={14} /> Order Acceptance (OA)
                                </button>

                                <button
                                    onClick={() => generateFrontendOrderAcknowledgementPDF({ po: selectedPo, companyInfo })}
                                    className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs"
                                    title="Print / Save Order Acknowledgement Document"
                                >
                                    <Printer size={14} /> Print OA
                                </button>


                                <button
                                    onClick={() => {
                                        const poToEdit = selectedPo;
                                        setSelectedPo(null);
                                        handleOpenEditModal(poToEdit);
                                    }}
                                    className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold text-xs rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                    <Edit2 size={14} /> Edit Customer PO
                                </button>
                                <button
                                    onClick={() => handleDeletePo(selectedPo)}
                                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400 font-bold text-xs rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                    <Trash2 size={14} /> Delete PO
                                </button>
                            </div>
                            <button onClick={() => setSelectedPo(null)} className="px-5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white font-bold text-xs rounded-xl transition-colors cursor-pointer">
                                Close
                            </button>
                        </div>

                    </div>
                </div>
            )}

            {/* Order Acknowledgement / Acceptance Modal */}
            {acknowledgingPo && (
                <OrderAcknowledgementModal
                    isOpen={!!acknowledgingPo}
                    po={acknowledgingPo}
                    companyInfo={companyInfo}
                    token={token}
                    onClose={() => setAcknowledgingPo(null)}
                    onSuccess={(updatedPo) => {
                        setPoList(prev => prev.map(p => p._id === updatedPo._id ? updatedPo : p));
                        if (selectedPo && selectedPo._id === updatedPo._id) {
                            setSelectedPo(updatedPo);
                        }
                        onSuccess("Customer PO Acknowledged & Accepted successfully!");
                    }}
                    onError={onError}
                />
            )}

            {/* Floating Bulk Action Bar for Consolidated MRP Creation */}
            {selectedPoIds.length > 0 && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 bg-slate-900/95 text-white dark:bg-slate-800/95 border border-slate-700 shadow-2xl backdrop-blur-md px-5 py-3 rounded-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
                        <span className="text-xs font-bold text-slate-200">
                            <span className="text-white font-black text-sm">{selectedPoIds.length}</span> Customer PO{selectedPoIds.length > 1 ? 's' : ''} Selected
                        </span>
                    </div>
                    <div className="h-4 w-px bg-slate-700" />
                    <button
                        type="button"
                        onClick={() => setIsMrpModalOpen(true)}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all transform hover:scale-[1.02] cursor-pointer"
                    >
                        <Layers size={14} /> Create Consolidated MRP ({selectedPoIds.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setSelectedPoIds([])}
                        className="text-xs text-slate-400 hover:text-white px-2 py-1 transition-colors cursor-pointer"
                    >
                        Clear
                    </button>
                </div>
            )}

            {/* Consolidated / Single MRP Modal */}
            {isMrpModalOpen && (
                <MRPModal
                    isOpen={isMrpModalOpen}
                    onClose={() => setIsMrpModalOpen(false)}
                    onSuccess={() => {
                        setSelectedPoIds([]);
                        fetchData();
                        onSuccess("MRP Plan created successfully!");
                    }}
                    token={token || ''}
                    preselectedPoIds={selectedPoIds}
                />
            )}

            {/* Linked MRP Plan Details Modal */}
            {viewingMrpPlan && (
                <MRPDetailsModal
                    isOpen={!!viewingMrpPlan}
                    onClose={() => setViewingMrpPlan(null)}
                    mrpPlan={viewingMrpPlan}
                />
            )}

        </div>
    );
}
