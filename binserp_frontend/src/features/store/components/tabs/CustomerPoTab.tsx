import React, { useState, useEffect, useMemo } from 'react';
import { 
    FileCheck, Plus, Search, Calendar, User, Eye, CheckCircle2, Clock, Filter, 
    ArrowRight, X, Building2, Printer, LayoutGrid, List, Edit2, Trash2, UserCheck, 
    History, ShieldCheck, Download, ShoppingBag, ShoppingCart, Truck, IndianRupee, 
    FileText, CheckCircle, PackageCheck, Lock, Upload, Paperclip, ExternalLink, Image as ImageIcon,
    AlertTriangle
} from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/src/lib/api';
import SearchableSelect from '../SearchableSelect';
import OrderAcknowledgementModal from '../modals/OrderAcknowledgementModal';
import { generateFrontendOrderAcknowledgementPDF } from '@/src/utils/generateOrderAcknowledgementPDF';
import { getCurrencySymbol, CURRENCY_OPTIONS } from '@/src/utils/currencyHelper';

interface CustomerPoTabProps {
    token: string | null;
    onError: (msg: string) => void;
    onSuccess: (msg: string) => void;
}

export default function CustomerPoTab({ token, onError, onSuccess }: CustomerPoTabProps) {
    const [loading, setLoading] = useState(true);
    const [poList, setPoList] = useState<any[]>([]);
    const [quotations, setQuotations] = useState<any[]>([]);
    const [fgItems, setFgItems] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [companyInfo, setCompanyInfo] = useState<any>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('All');
    const [filterCustomer, setFilterCustomer] = useState<string>('All');

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

    // Live 1-second ticking timer for 24h edit/delete countdown
    const [nowTime, setNowTime] = useState(Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNowTime(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const getRemainingEditSeconds = (createdAt: string | Date | undefined) => {
        if (!createdAt) return 0;
        const created = new Date(createdAt).getTime();
        const elapsed = Math.floor((nowTime - created) / 1000);
        const limit = 24 * 3600; // 24 hours in seconds
        return Math.max(0, limit - elapsed);
    };

    const formatRemainingTime = (totalSeconds: number) => {
        if (totalSeconds <= 0) return '00:00:00';
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const handleDeletePo = async (po: any) => {
        const remainingSecs = getRemainingEditSeconds(po.createdAt || po.date);
        if (remainingSecs <= 0) {
            onError("Customer PO can only be deleted within 24 hours of creation");
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
                const rate = pEntry && pEntry.price != null ? Number(pEntry.price) : (Number(m.sellingPrice || m.unitPrice || 0));
                const priceText = rate > 0 ? ` — ₹${rate}` : '';
                const descText = m.description ? ` (${m.description})` : '';
                const codeText = m.code ? ` [${m.code}]` : '';
                return {
                    value: (m._id || m.id)?.toString(),
                    label: `${m.name || m.itemName || 'FG Item'}${codeText}${descText}${priceText}`,
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
        const remainingSecs = getRemainingEditSeconds(po.createdAt || po.date);
        if (remainingSecs <= 0) {
            onError("Customer PO can only be edited or deleted within 24 hours of creation");
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
            const hsn = it.hsnCode || pEntry?.hsnCode || matchedFg?.hsnCode || '';
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
            const autoHsn = priceEntry?.hsnCode || (selectedFg as any)?.hsnCode || (selectedFg as any)?.hsn || '';

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
                (p.poNumber && p.poNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (p.customerName && p.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (p.customer?.name && p.customer.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (p.items && p.items.some((i: any) => (i.productName || i.fgItem?.name || '').toLowerCase().includes(searchTerm.toLowerCase())));

            const matchStatus = filterStatus === 'All' || p.status === filterStatus;

            let matchCustomer = true;
            if (filterCustomer !== 'All') {
                const custId = p.customer?._id || p.customer;
                matchCustomer = custId?.toString() === filterCustomer?.toString();
            }

            return matchSearch && matchStatus && matchCustomer;
        });
    }, [poList, searchTerm, filterStatus, filterCustomer]);

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            
            {/* Search, Filter & Action Toolbar */}
            <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 min-w-0">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search PO #, Customer or Item..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-slate-50/50 dark:bg-slate-800/50"
                        />
                    </div>

                    {/* Customer Filter Dropdown */}
                    <div className="flex items-center gap-2 shrink-0">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">Customer:</label>
                        <select
                            value={filterCustomer}
                            onChange={(e) => setFilterCustomer(e.target.value)}
                            className="w-full sm:w-auto px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 outline-none cursor-pointer focus:ring-2 focus:ring-blue-500/20 max-w-[220px] truncate"
                        >
                            <option value="All">All Customers</option>
                            {(Array.isArray(customers) ? customers : []).map((c: any) => (
                                <option key={c._id || c.id} value={(c._id || c.id)?.toString()}>
                                    {c.name || c.companyName} {c.code ? `(${c.code})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Right Side: Status Filter Tabs + Log Customer PO Button */}
                <div className="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-end gap-2 shrink-0">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold overflow-x-auto no-scrollbar max-w-full shrink-0">
                        {['All', 'Received', 'Accepted', 'MRP Done', 'Partially Dispatched', 'Completed', 'Cancelled'].map(status => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${filterStatus === status ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={handleOpenCreateModal}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                        <Plus size={15} /> Log Customer PO
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            ) : filteredPoList.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    <FileCheck className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Customer Purchase Orders Found</h3>
                    <p className="text-xs text-slate-500 mt-1">Log incoming customer POs to initiate fulfillment, DCs, and invoicing.</p>
                </div>
            ) : (
                /* Table & Cards View */
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-4 py-3.5">Customer PO #</th>
                                    <th className="px-4 py-3.5">Customer Name</th>
                                    <th className="px-4 py-3.5 text-center">PO Date</th>
                                    <th className="px-4 py-3.5 text-right">Total Amount</th>
                                    <th className="px-4 py-3.5 text-center">Fulfillment Status</th>
                                    <th className="px-4 py-3.5 text-center">Created By</th>
                                    <th className="px-4 py-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {filteredPoList.map((po) => {
                                    const total = Number(po.totalAmount || po.subtotal || 0);

                                    return (
                                        <tr key={po._id || po.poNumber} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
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
                                            </td>

                                            <td className="px-4 py-3.5 font-bold text-slate-800 dark:text-slate-200 text-xs">
                                                <div className="flex items-center gap-1.5">
                                                    <Building2 size={13} className="text-blue-500 shrink-0" />
                                                    <span className="truncate max-w-[180px]">{po.customerName || po.customer?.name || 'Customer'}</span>
                                                </div>
                                            </td>

                                            <td className="px-4 py-3.5 text-center font-bold text-slate-700 dark:text-slate-300 text-xs">
                                                {po.date ? new Date(po.date).toLocaleDateString('en-GB') : 'N/A'}
                                            </td>

                                            <td className="px-4 py-3.5 text-right font-mono font-extrabold text-blue-600 dark:text-blue-400 text-sm">
                                                {getCurrencySymbol(po.currency)}{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                                                    title="Order Acknowledgement & Commitment Schedule"
                                                    className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1"
                                                >
                                                    <FileText size={13} /> OA / Accept
                                                </button>

                                                {(() => {
                                                    const remainingSecs = getRemainingEditSeconds(po.createdAt || po.date);
                                                    const isWithin24h = remainingSecs > 0;

                                                    return (
                                                        <>
                                                            {isWithin24h ? (
                                                                <>
                                                                    <span 
                                                                        title={`Editing and deletion allowed for another ${formatRemainingTime(remainingSecs)}`}
                                                                        className="px-2 py-1 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 rounded-xl font-mono text-[10px] font-bold border border-amber-200 dark:border-amber-800 inline-flex items-center gap-1 shrink-0"
                                                                    >
                                                                        <Clock size={11} className="text-amber-600 animate-pulse" />
                                                                        {formatRemainingTime(remainingSecs)}
                                                                    </span>
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
                                                                        className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400 text-xs font-bold rounded-xl transition-colors inline-flex items-center"
                                                                    >
                                                                        <Trash2 size={13} />
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <span title="Editing and deleting window expired (24h limit)" className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-400 text-[11px] font-medium rounded-xl inline-flex items-center gap-1 opacity-60">
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

                    {/* Mobile Card View */}
                    <div className="block md:hidden p-3 space-y-3 pb-28 sm:pb-20 bg-gray-50/50 dark:bg-slate-900/40">
                        {filteredPoList.map((po) => {
                            const total = Number(po.totalAmount || po.subtotal || 0);
                            const remainingSecs = getRemainingEditSeconds(po.createdAt || po.date);
                            const isWithin24h = remainingSecs > 0;

                            return (
                                <div
                                    key={po._id || po.poNumber}
                                    className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-3"
                                >
                                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-2.5">
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
                                                {isWithin24h ? (
                                                    <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 rounded-md font-mono text-[9px] font-bold border border-amber-200 dark:border-amber-800 inline-flex items-center gap-0.5">
                                                        <Clock size={9} className="text-amber-600 animate-pulse" />
                                                        {formatRemainingTime(remainingSecs)}
                                                    </span>
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
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Created By</span>
                                            <p className="text-slate-600 dark:text-slate-400">{getUserName(po.createdBy || po.receivedBy)}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Total Amount</span>
                                            <p className="font-extrabold text-sm text-blue-600 dark:text-blue-400 font-mono">
                                                {getCurrencySymbol(po.currency)}{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </p>
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
                                            className="flex-1 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center gap-1 border border-indigo-200 dark:border-indigo-800"
                                        >
                                            <FileText size={13} /> OA / Accept
                                        </button>

                                        {isWithin24h ? (
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
            )}

            {/* Create / Edit Customer PO Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-[96vw] xl:max-w-7xl 2xl:max-w-[1550px] overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
                        
                        <div className="p-5 sm:p-6 bg-slate-900 text-white flex justify-between items-center flex-shrink-0 border-b border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center border border-blue-500/30">
                                    {editingPo ? <Edit2 size={20} className="text-blue-400" /> : <FileCheck size={20} className="text-blue-400" />}
                                </div>
                                <div>
                                    <h2 className="text-xl font-extrabold tracking-tight">
                                        {editingPo ? 'Edit Customer Purchase Order' : 'Log Customer Purchase Order (Inward PO)'}
                                    </h2>
                                    <p className="text-xs text-slate-400 mt-0.5">PO #: <span className="font-mono font-bold text-blue-300">{newPo.poNumber}</span></p>
                                </div>
                            </div>
                            <button onClick={() => { setIsCreateModalOpen(false); setEditingPo(null); }} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-5 sm:p-7 overflow-y-auto flex-1 space-y-6">
                            
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
                            <div className="bg-slate-50/80 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4">
                                <h3 className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                                    1. Customer & Linked Quotation Details
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="md:col-span-2">
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

                                    <div className="md:col-span-2 space-y-1" data-has-error={!!formErrors.customer}>
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
                            <div className="bg-slate-50/80 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                                        2. Ordered Items & Line Pricing
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={handleAddItem}
                                        className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/80 bg-blue-50 dark:bg-blue-950/60 px-3.5 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 transition-colors"
                                    >
                                        + Add Item
                                    </button>
                                </div>

                                {/* Desktop Table Header */}
                                <div className="hidden lg:grid grid-cols-12 gap-3 px-3 py-1.5 text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    <div className="col-span-3">FG Item * (Price List)</div>
                                    <div className="col-span-1 text-center">HSN</div>
                                    <div className="col-span-2">Specifications</div>
                                    <div className="col-span-1 text-center">Qty</div>
                                    <div className="col-span-1 text-center">Unit</div>
                                    <div className="col-span-2 text-right">Unit Rate ({getCurrencySymbol(newPo.currency)})</div>
                                    <div className="col-span-1 text-center">GST %</div>
                                    <div className="col-span-1 text-right">Action</div>
                                </div>

                                {/* Items Rows */}
                                <div className="space-y-2.5">
                                    {newPo.items.map((item, idx) => (
                                        <div key={idx} className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                            <div className="grid grid-cols-12 gap-3 items-center">
                                                
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

                                                {/* HSN Code Column */}
                                                <div className="col-span-6 lg:col-span-1">
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

                                                {/* Specifications */}
                                                <div className="col-span-12 lg:col-span-2">
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

                                                {/* Qty */}
                                                <div className="col-span-6 lg:col-span-1" data-has-error={!!formErrors[`item_${idx}_quantity`]}>
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
                                                <div className="col-span-6 lg:col-span-1">
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
                                                <div className="col-span-6 lg:col-span-2" data-has-error={!!formErrors[`item_${idx}_rate`]}>
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
                                                <div className="col-span-5 lg:col-span-1">
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
                                                <div className="col-span-1 text-right">
                                                    {newPo.items.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveItem(idx)}
                                                            className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
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
                                            <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-2xl cursor-pointer bg-white dark:bg-slate-900 transition-all group">
                                                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                                    <Upload size={22} />
                                                </div>
                                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                                    Click to upload or drag & drop PO
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
                            <div className="bg-blue-50/70 dark:bg-blue-950/40 p-5 rounded-2xl border border-blue-200 dark:border-blue-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div className="text-xs space-y-1">
                                    <div className="font-bold text-slate-700 dark:text-slate-300">
                                        Subtotal: <span className="font-mono text-slate-900 dark:text-white">{getCurrencySymbol(newPo.currency)}{newPo.subtotal.toLocaleString()}</span>
                                    </div>
                                    <div className="font-bold text-slate-700 dark:text-slate-300">
                                        Total Tax (GST): <span className="font-mono text-slate-900 dark:text-white">{getCurrencySymbol(newPo.currency)}{newPo.taxAmount.toLocaleString()}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Grand Total PO Amount ({newPo.currency || 'INR'})</span>
                                    <span className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
                                        {getCurrencySymbol(newPo.currency)}{newPo.totalAmount.toLocaleString()}
                                    </span>
                                </div>
                            </div>

                        </div>

                        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 flex-shrink-0">
                            <button onClick={() => { setIsCreateModalOpen(false); setEditingPo(null); }} className="px-5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-100 transition-colors">
                                Cancel
                            </button>
                            <button
                                onClick={handleCreatePoSubmit}
                                disabled={submitting}
                                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center gap-2"
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
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-[96vw] xl:max-w-7xl 2xl:max-w-[1550px] overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
                        
                        <div className="p-5 sm:p-6 bg-slate-900 text-white flex justify-between items-center flex-shrink-0 border-b border-slate-800">
                            <div>
                                <h2 className="text-xl font-extrabold font-mono text-blue-300">{selectedPo.poNumber}</h2>
                                <p className="text-xs text-slate-400 mt-0.5">Customer PO Overview, User Ownership Audit & Document Timeline</p>
                            </div>
                            <button onClick={() => setSelectedPo(null)} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Tab Bar */}
                        <div className="flex bg-slate-100 dark:bg-slate-800/80 px-6 pt-2 border-b border-slate-200 dark:border-slate-800 gap-2 flex-shrink-0">
                            <button
                                onClick={() => setActiveViewTab('overview')}
                                className={`px-5 py-2.5 font-bold text-xs flex items-center gap-2 rounded-t-xl transition-all ${
                                    activeViewTab === 'overview'
                                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 border-t-2 border-x border-blue-600 dark:border-blue-500 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                }`}
                            >
                                <FileText size={15} /> Customer PO Overview & Items
                            </button>
                            <button
                                onClick={() => setActiveViewTab('dispatch')}
                                className={`px-5 py-2.5 font-bold text-xs flex items-center gap-2 rounded-t-xl transition-all ${
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
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 text-xs bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
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
                                            <span className="text-slate-400 block mb-0.5">Currency:</span>
                                            <strong className="text-blue-600 dark:text-blue-400 font-bold">
                                                {selectedPo.currency || 'INR'} ({getCurrencySymbol(selectedPo.currency)})
                                            </strong>
                                        </div>

                                        <div>
                                            <span className="text-slate-400 block mb-0.5">Total PO Value:</span>
                                            <strong className="text-blue-600 font-extrabold font-mono text-sm">
                                                {getCurrencySymbol(selectedPo.currency)}{Number(selectedPo.totalAmount || selectedPo.subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </strong>
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
                                    className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold text-xs rounded-xl transition-colors flex items-center gap-1"
                                >
                                    <Edit2 size={14} /> Edit Customer PO
                                </button>
                                <button
                                    onClick={() => handleDeletePo(selectedPo)}
                                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400 font-bold text-xs rounded-xl transition-colors flex items-center gap-1"
                                >
                                    <Trash2 size={14} /> Delete PO
                                </button>
                            </div>
                            <button onClick={() => setSelectedPo(null)} className="px-5 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl">
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

        </div>
    );
}
