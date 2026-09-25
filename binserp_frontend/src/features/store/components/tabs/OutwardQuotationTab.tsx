import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { FileText, Plus, Search, Calendar, User, Eye, CheckCircle2, Clock, Filter, ArrowRight, X, Building2, Printer, LayoutGrid, List, Edit2, Trash2, UserCheck, History, ShieldCheck, Download, ShoppingCart, AlertTriangle, IndianRupee, ChevronDown, ChevronUp, RotateCcw, Tag, Settings } from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/src/lib/api';
import SearchableSelect from '../SearchableSelect';
import SearchableMultiSelect from '../SearchableMultiSelect';
import { generateFrontendOutwardQuotationPDF } from '@/src/utils/frontendPdfHelper';
import { getCurrencySymbol, CURRENCY_OPTIONS, normalizeCurrencyCode } from '@/src/utils/currencyHelper';
import { useExchangeRates } from '@/src/hooks/useExchangeRates';

interface OutwardQuotationTabProps {
    token: string | null;
    initialRfqId?: string | null;
    onError: (msg: string) => void;
    onSuccess: (msg: string) => void;
}

export default function OutwardQuotationTab({ token, initialRfqId, onError, onSuccess }: OutwardQuotationTabProps) {
    const { exchangeRates, convertToINR } = useExchangeRates(token);
    const [loading, setLoading] = useState(true);
    const [quotations, setQuotations] = useState<any[]>([]);
    const [rfqs, setRfqs] = useState<any[]>([]);
    const [fgItems, setFgItems] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [companyInfo, setCompanyInfo] = useState<any>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('All');
    const [filterCustomers, setFilterCustomers] = useState<string[]>([]);
    const [showDashboard, setShowDashboard] = useState<boolean>(false);
    const [showFilters, setShowFilters] = useState<boolean>(false);
    const [filterDateType, setFilterDateType] = useState<'entry' | 'validity' | 'either'>('entry');
    const [filterMonth, setFilterMonth] = useState<string>('');

    const customerOptions = useMemo(() => {
        return (Array.isArray(customers) ? customers : []).map((c: any) => ({
            value: (c._id || c.id)?.toString(),
            label: c.name || c.companyName || 'Customer',
            subLabel: c.code ? `Code: ${c.code}` : undefined
        })).filter(o => o.value);
    }, [customers]);

    // Create / Edit Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingQuote, setEditingQuote] = useState<any | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [selectedRfqId, setSelectedRfqId] = useState<string>('');
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    const clearError = (field: string) => {
        setFormErrors(prev => {
            const next = { ...prev };
            delete next[field];
            delete next.server_error;
            return next;
        });
    };

    const [newQuote, setNewQuote] = useState({
        quotationNumber: '',
        rfq: '',
        rfqId: '',
        rfqNumber: '',
        customer: '',
        customerName: '',
        customerAddress: '',
        customerEmail: '',
        customerPhone: '',
        currency: 'INR',
        date: new Date().toISOString().slice(0, 10),
        validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        transportationType: 'Included',
        transportationCharges: 0,
        packagingType: 'Standard',
        packagingCharges: 0,
        otherDetails: '',
        status: 'Draft',
        items: [] as any[],
        subtotal: 0,
        taxAmount: 0,
        totalAmount: 0
    });

    const [priceLists, setPriceLists] = useState<any[]>([]);
    const hasAutoOpenedRfq = React.useRef(false);

    // View Modal State
    const [selectedQuote, setSelectedQuote] = useState<any | null>(null);

    const fetchData = async () => {
        if (!token) return;
        try {
            setLoading(true);
            const [quotRes, rfqRes, fgRes, custRes, compRes, priceRes] = await Promise.all([
                apiGet('/api/sales/quotation', token).catch(() => ({ quotations: [] })),
                apiGet('/api/sales/incoming-rfq', token).catch(() => ({ rfqs: [] })),
                apiGet('/api/store/fg-item', token).catch(() => []),
                apiGet('/api/store/customer', token).catch(() => []),
                apiGet('/api/store/company-info', token).catch(() => null),
                apiGet('/api/sales/price-list', token).catch(() => ({ priceLists: [] }))
            ]);

            const quotList = Array.isArray(quotRes?.quotations) ? quotRes.quotations : (Array.isArray(quotRes?.data) ? quotRes.data : (Array.isArray(quotRes) ? quotRes : []));
            const rfqList = Array.isArray(rfqRes?.rfqs) ? rfqRes.rfqs : (Array.isArray(rfqRes?.data) ? rfqRes.data : (Array.isArray(rfqRes) ? rfqRes : []));
            const fgList = Array.isArray(fgRes?.fgItems) ? fgRes.fgItems : (Array.isArray(fgRes) ? fgRes : []);
            const custList = Array.isArray(custRes?.customers) ? custRes.customers : (Array.isArray(custRes) ? custRes : []);
            const priceList = Array.isArray(priceRes?.priceLists) ? priceRes.priceLists : (Array.isArray(priceRes?.data) ? priceRes.data : (Array.isArray(priceRes) ? priceRes : []));

            setQuotations(quotList);
            setRfqs(rfqList);
            setFgItems(fgList);
            setCustomers(custList);
            setPriceLists(priceList);
            setCompanyInfo(compRes?.companyInfo || compRes);

            // Auto-trigger Create Modal ONLY ONCE if initialRfqId was passed in URL query
            if (initialRfqId && !hasAutoOpenedRfq.current) {
                hasAutoOpenedRfq.current = true;
                const targetRfq = rfqList.find((r: any) => r._id === initialRfqId);
                if (targetRfq) {
                    handleOpenCreateModalWithRfq(targetRfq, custList, fgList);
                }
            }
        } catch (err: any) {
            console.error("Fetch Outward Quotations error:", err);
            onError(err.message || "Failed to fetch Outward Sales Quotations");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [token]);

    const generateQuoteNo = () => {
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        return `QT-OUT-${dateStr}-${randomNum}`;
    };

    const getUserName = (userObj: any) => {
        if (!userObj) return 'Sales User';
        if (typeof userObj === 'string') return userObj;
        return userObj.name || userObj.email || 'User';
    };

    const handlePrintQuotePdf = (quote: any) => {
        try {
            const customerObj = (Array.isArray(customers) ? customers : []).find(
                (c: any) => (c._id || c.id)?.toString() === (quote.customer?._id || quote.customer)?.toString()
            ) || { name: quote.customerName, email: quote.customerEmail, phone: quote.customerPhone, address: quote.customerAddress };

            generateFrontendOutwardQuotationPDF({ quotation: quote, customer: customerObj, companyInfo });
            onSuccess(`Outward Quotation PDF generated for ${quote.customerName || 'Customer'}`);
        } catch (err: any) {
            onError(err.message || "Failed to generate PDF");
        }
    };

    const handleOpenCreateModal = () => {
        setEditingQuote(null);
        setSelectedRfqId('');
        setNewQuote({
            quotationNumber: generateQuoteNo(),
            rfq: '',
            rfqId: '',
            rfqNumber: '',
            customer: '',
            customerName: '',
            customerAddress: '',
            customerEmail: '',
            customerPhone: '',
            currency: 'INR',
            date: new Date().toISOString().slice(0, 10),
            validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            transportationType: 'Included',
            transportationCharges: 0,
            packagingType: 'Standard',
            packagingCharges: 0,
            otherDetails: '',
            status: 'Draft',
            items: [{ fgItem: '', hsnCode: '', productName: '', description: '', quantity: 1, unit: 'PCS', rate: 0, taxRate: 18, amount: 0 }],
            subtotal: 0,
            taxAmount: 0,
            totalAmount: 0
        });
        setIsCreateModalOpen(true);
    };

    const fgOptions = useMemo(() => {
        return (Array.isArray(fgItems) ? fgItems : [])
            .map(m => {
                const pEntry = (Array.isArray(priceLists) ? priceLists : []).find((p: any) => {
                    const pFgId = typeof p.fgItem === 'string' ? p.fgItem : (p.fgItem?._id || p.fgItem?.id);
                    return pFgId?.toString() === (m._id || m.id)?.toString();
                });
                const rate = pEntry && pEntry.price != null ? Number(pEntry.price) : (Number(m.sellingPrice || m.unitPrice || 0));
                const priceText = rate > 0 ? ` — ${getCurrencySymbol(newQuote.currency || 'INR')}${rate}` : '';
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
    }, [fgItems, priceLists, newQuote.currency]);

    const handleSelectCustomer = (custId: string) => {
        clearError('customer');
        const selectedCust = (Array.isArray(customers) ? customers : []).find((c: any) => (c._id || c.id)?.toString() === custId?.toString());
        if (selectedCust) {
            setNewQuote(prev => ({
                ...prev,
                customer: custId,
                customerName: selectedCust.name || selectedCust.companyName || '',
                customerAddress: selectedCust.address || selectedCust.billingAddress || '',
                customerEmail: selectedCust.email || '',
                customerPhone: selectedCust.phone || ''
            }));
        } else {
            setNewQuote(prev => ({ ...prev, customer: custId }));
        }
    };

    const handleOpenCreateModalWithRfq = (targetRfq: any, customersList: any[], fgsList: any[]) => {
        setEditingQuote(null);
        setSelectedRfqId(targetRfq._id);
        setFormErrors({});

        const custId = targetRfq.customer?._id || targetRfq.customer || '';
        const matchedCust = (Array.isArray(customersList) ? customersList : []).find(c => (c._id || c.id)?.toString() === custId?.toString());

        const autoItems = (targetRfq.items || []).map((it: any) => {
            const fgId = it.fgItem?._id || it.fgItem || '';
            const matchedFg = (Array.isArray(fgsList) ? fgsList : []).find((f: any) => (f._id || f.id)?.toString() === fgId?.toString());
            const qty = Number(it.quantity || 1);
            const pEntry = (Array.isArray(priceLists) ? priceLists : []).find((p: any) => {
                const pFgId = typeof p.fgItem === 'string' ? p.fgItem : (p.fgItem?._id || p.fgItem?.id);
                return pFgId?.toString() === fgId?.toString();
            });
            const rate = Number(it.targetPrice) > 0 ? Number(it.targetPrice) : (pEntry && pEntry.price != null ? Number(pEntry.price) : Number(matchedFg?.sellingPrice || 0));
            const taxRate = pEntry && pEntry.taxRate != null ? Number(pEntry.taxRate) : Number(matchedFg?.taxRate || 18);
            const hsn = it.hsnCode || matchedFg?.hsnCode || pEntry?.hsnCode || '';
            const prodName = matchedFg?.name || it.fgItem?.name || it.itemName || 'FG Item';
            const amount = qty * rate * (1 + taxRate / 100);

            return {
                fgItem: fgId,
                productName: prodName,
                hsnCode: hsn,
                description: it.description || matchedFg?.description || '',
                quantity: qty,
                unit: it.unit || matchedFg?.unit || 'PCS',
                rate: rate,
                taxRate: taxRate,
                amount: amount
            };
        });

        const initialItems = autoItems.length > 0 ? autoItems : [{ fgItem: '', hsnCode: '', productName: '', description: '', quantity: 1, unit: 'PCS', rate: 0, taxRate: 18, amount: 0 }];

        let sub = 0;
        let taxSum = 0;
        initialItems.forEach((it: any) => {
            const qty = Number(it.quantity) || 0;
            const rate = Number(it.rate) || 0;
            const tax = Number(it.taxRate != null ? it.taxRate : 18);
            const lineSub = qty * rate;
            const lineTax = lineSub * (tax / 100);
            sub += lineSub;
            taxSum += lineTax;
        });

        setNewQuote({
            quotationNumber: generateQuoteNo(),
            rfq: targetRfq._id,
            rfqId: targetRfq._id,
            rfqNumber: targetRfq.rfqNumber || '',
            customer: custId,
            customerName: targetRfq.customerName || matchedCust?.name || matchedCust?.companyName || '',
            customerAddress: matchedCust?.address || matchedCust?.billingAddress || '',
            customerEmail: targetRfq.customerEmail || matchedCust?.email || '',
            customerPhone: targetRfq.customerPhone || matchedCust?.phone || '',
            currency: targetRfq.currency || 'INR',
            date: new Date().toISOString().slice(0, 10),
            validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            transportationType: 'Included',
            transportationCharges: 0,
            packagingType: 'Standard',
            packagingCharges: 0,
            otherDetails: targetRfq.remarks ? `Customer RFQ Remarks: ${targetRfq.remarks}` : '',
            status: 'Draft',
            items: initialItems,
            subtotal: sub,
            taxAmount: taxSum,
            totalAmount: sub + taxSum
        });

        setIsCreateModalOpen(true);
    };

    const handleSelectRfq = (rfqId: string) => {
        setSelectedRfqId(rfqId);
        const targetRfq = (Array.isArray(rfqs) ? rfqs : []).find(r => r._id === rfqId);
        if (!targetRfq) return;

        const custId = targetRfq.customer?._id || targetRfq.customer || '';
        const matchedCust = (Array.isArray(customers) ? customers : []).find(c => (c._id || c.id)?.toString() === custId?.toString());

        const autoItems = (targetRfq.items || []).map((it: any) => {
            const fgId = it.fgItem?._id || it.fgItem || '';
            const matchedFg = (Array.isArray(fgItems) ? fgItems : []).find((f: any) => (f._id || f.id)?.toString() === fgId?.toString());
            const qty = Number(it.quantity || 1);
            const pEntry = (Array.isArray(priceLists) ? priceLists : []).find((p: any) => {
                const pFgId = typeof p.fgItem === 'string' ? p.fgItem : (p.fgItem?._id || p.fgItem?.id);
                return pFgId?.toString() === fgId?.toString();
            });
            const rate = Number(it.targetPrice) > 0 ? Number(it.targetPrice) : (pEntry && pEntry.price != null ? Number(pEntry.price) : Number(matchedFg?.sellingPrice || 0));
            const taxRate = pEntry && pEntry.taxRate != null ? Number(pEntry.taxRate) : Number(matchedFg?.taxRate || 18);
            const hsn = it.hsnCode || matchedFg?.hsnCode || pEntry?.hsnCode || '';
            const prodName = matchedFg?.name || it.fgItem?.name || it.itemName || 'FG Item';
            const amount = qty * rate * (1 + taxRate / 100);

            return {
                fgItem: fgId,
                productName: prodName,
                hsnCode: hsn,
                description: it.description || matchedFg?.description || '',
                quantity: qty,
                unit: it.unit || matchedFg?.unit || 'PCS',
                rate: rate,
                taxRate: taxRate,
                amount: amount
            };
        });

        const initialItems = autoItems.length > 0 ? autoItems : [{ fgItem: '', hsnCode: '', productName: '', description: '', quantity: 1, unit: 'PCS', rate: 0, taxRate: 18, amount: 0 }];

        let sub = 0;
        let taxSum = 0;
        initialItems.forEach((it: any) => {
            const qty = Number(it.quantity) || 0;
            const rate = Number(it.rate) || 0;
            const tax = Number(it.taxRate != null ? it.taxRate : 18);
            const lineSub = qty * rate;
            const lineTax = lineSub * (tax / 100);
            sub += lineSub;
            taxSum += lineTax;
        });

        setNewQuote(prev => ({
            ...prev,
            rfq: targetRfq._id,
            rfqId: targetRfq._id,
            rfqNumber: targetRfq.rfqNumber || '',
            customer: custId || prev.customer,
            customerName: targetRfq.customerName || matchedCust?.name || matchedCust?.companyName || prev.customerName,
            customerAddress: matchedCust?.address || matchedCust?.billingAddress || prev.customerAddress,
            customerEmail: targetRfq.customerEmail || matchedCust?.email || prev.customerEmail,
            customerPhone: targetRfq.customerPhone || matchedCust?.phone || prev.customerPhone,
            currency: targetRfq.currency || prev.currency || 'INR',
            items: initialItems,
            subtotal: sub,
            taxAmount: taxSum,
            totalAmount: sub + taxSum
        }));
    };

    const handleOpenEditModal = (quote: any) => {
        setEditingQuote(quote);
        setSelectedRfqId(quote.rfq?._id || quote.rfq || '');
        setFormErrors({});

        const mappedItems = Array.isArray(quote.items) && quote.items.length > 0
            ? quote.items.map((it: any) => ({
                fgItem: it.fgItem?._id || it.fgItem || it.material || it.component || '',
                productName: it.productName || it.fgItem?.name || it.materialName || '',
                hsnCode: it.hsnCode || '',
                description: it.description || '',
                quantity: it.quantity || 1,
                unit: it.unit || 'PCS',
                rate: it.rate || 0,
                taxRate: it.taxRate != null ? it.taxRate : 18,
                amount: it.amount || 0
            }))
            : [{ fgItem: '', hsnCode: '', productName: '', description: '', quantity: 1, unit: 'PCS', rate: 0, taxRate: 18, amount: 0 }];

        setNewQuote({
            quotationNumber: quote.quotationNumber || '',
            rfq: quote.rfq?._id || quote.rfq || '',
            rfqId: quote.rfq?._id || quote.rfq || '',
            rfqNumber: quote.rfqNumber || quote.rfq?.rfqNumber || '',
            customer: quote.customer?._id || quote.customer || '',
            customerName: quote.customerName || quote.customer?.name || '',
            customerAddress: quote.customerAddress || '',
            customerEmail: quote.customerEmail || quote.customer?.email || '',
            customerPhone: quote.customerPhone || quote.customer?.phone || '',
            currency: quote.currency || 'INR',
            date: quote.date ? new Date(quote.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
            validUntil: quote.validUntil ? new Date(quote.validUntil).toISOString().slice(0, 10) : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            transportationType: quote.transportationType || 'Included',
            transportationCharges: quote.transportationCharges || 0,
            packagingType: quote.packagingType || 'Standard',
            packagingCharges: quote.packagingCharges || 0,
            otherDetails: quote.otherDetails || '',
            status: quote.status || 'Draft',
            items: mappedItems,
            subtotal: quote.subtotal || 0,
            taxAmount: quote.taxAmount || 0,
            totalAmount: quote.totalAmount || 0
        });

        setIsCreateModalOpen(true);
    };

    const handleAddItem = () => {
        setNewQuote(prev => ({
            ...prev,
            items: [...prev.items, { fgItem: '', hsnCode: '', productName: '', description: '', quantity: 1, unit: 'PCS', rate: 0, taxRate: 18, amount: 0 }]
        }));
    };

    const handleRemoveItem = (index: number) => {
        const updated = newQuote.items.filter((_, i) => i !== index);
        recalculateTotals(updated);
    };

    const handleItemChange = (index: number, field: string, value: any) => {
        clearError(`item_${index}_${field}`);
        const updated = [...newQuote.items];
        if (field === 'fgItem') {
            const selectedFg = (Array.isArray(fgItems) ? fgItems : []).find((m: any) => (m._id || m.id)?.toString() === value?.toString());
            const autoName = selectedFg?.name || selectedFg?.itemName || '';
            const autoDesc = selectedFg?.description || selectedFg?.details || autoName;
            const autoUnit = selectedFg?.unit || selectedFg?.uom || 'PCS';

            // Auto-fetch unit rate, tax rate, and HSN code from FG Price List or FG master
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

        const grand = sub + taxSum + Number(newQuote.transportationCharges || 0) + Number(newQuote.packagingCharges || 0);

        setNewQuote(prev => ({
            ...prev,
            items: updatedItems,
            subtotal: sub,
            taxAmount: taxSum,
            totalAmount: grand
        }));
    };

    const handleStatusChange = async (quoteId: string, newStatus: string) => {
        try {
            const res = await apiPut(`/api/sales/quotation/${quoteId}`, { status: newStatus }, token);
            onSuccess(`Outward Quotation status updated to ${newStatus}`);
            const updated = res.quotation || res.data || res;
            if (selectedQuote && selectedQuote._id === quoteId) {
                setSelectedQuote(updated);
            }
            fetchData();
        } catch (err: any) {
            onError(err.message || "Failed to update quotation status");
        }
    };

    const handleDeleteQuote = async (quote: any) => {
        if (!quote || !quote._id) return;
        if (confirm(`Are you sure you want to delete Outward Quotation #${quote.quotationNumber}? This action cannot be undone.`)) {
            try {
                await apiDelete(`/api/sales/quotation/${quote._id}`, token);
                onSuccess(`Outward Quotation #${quote.quotationNumber} deleted successfully`);
                if (selectedQuote && selectedQuote._id === quote._id) {
                    setSelectedQuote(null);
                }
                fetchData();
            } catch (err: any) {
                onError(err.message || "Failed to delete quotation");
            }
        }
    };

    const handleCreateQuoteSubmit = async () => {
        const errors: Record<string, string> = {};
        if (!newQuote.customer && !newQuote.customerName.trim()) {
            errors.customer = "Please select or enter Customer";
        }
        if (!newQuote.date) {
            errors.date = "Quotation date is required";
        }
        if (!newQuote.items || newQuote.items.length === 0) {
            errors.items = "At least one item is required";
        } else {
            newQuote.items.forEach((it, idx) => {
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
            if (editingQuote && editingQuote._id) {
                await apiPut(`/api/sales/quotation/${editingQuote._id}`, newQuote, token);
                onSuccess(`Outward Quotation #${newQuote.quotationNumber} updated successfully`);
            } else {
                await apiPost('/api/sales/quotation', newQuote, token);
                onSuccess("Outward Quotation created successfully");
            }
            hasAutoOpenedRfq.current = true;
            setIsCreateModalOpen(false);
            setEditingQuote(null);
            if (typeof window !== 'undefined' && window.history.replaceState) {
                window.history.replaceState({}, '', window.location.pathname);
            }
            fetchData();
        } catch (err: any) {
            setFormErrors({ server_error: err.message || "Failed to save Outward Quotation" });
        } finally {
            setSubmitting(false);
        }
    };

    const filteredQuotations = useMemo(() => {
        return (Array.isArray(quotations) ? quotations : []).filter((q: any) => {
            const matchSearch =
                !searchTerm ||
                (q.quotationNumber && q.quotationNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (q.rfqNumber && q.rfqNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (q.customerName && q.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (q.items && q.items.some((i: any) => (i.productName || i.description || i.fgItem?.name || '').toLowerCase().includes(searchTerm.toLowerCase())));

            const matchStatus = filterStatus === 'All' || q.status === filterStatus;

            let matchCustomer = true;
            if (filterCustomers.length > 0 && !filterCustomers.includes('All') && !filterCustomers.includes('all')) {
                const custId = (q.customer?._id || q.customer)?.toString();
                matchCustomer = filterCustomers.includes(custId);
            }

            let matchMonth = true;
            if (filterMonth) {
                const entryMonth = q.date ? new Date(q.date).toISOString().slice(0, 7) : '';
                const validMonth = q.validUntil ? new Date(q.validUntil).toISOString().slice(0, 7) : '';
                if (filterDateType === 'entry') {
                    matchMonth = entryMonth === filterMonth;
                } else if (filterDateType === 'validity') {
                    matchMonth = validMonth === filterMonth;
                } else {
                    matchMonth = entryMonth === filterMonth || validMonth === filterMonth;
                }
            }

            return matchSearch && matchStatus && matchCustomer && matchMonth;
        });
    }, [quotations, searchTerm, filterStatus, filterCustomers, filterMonth, filterDateType]);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filterStatus !== 'All') count++;
        if (filterCustomers.length > 0 && !filterCustomers.includes('All') && !filterCustomers.includes('all')) count++;
        if (filterMonth) count++;
        if (searchTerm.trim()) count++;
        return count;
    }, [filterStatus, filterCustomers, filterMonth, searchTerm]);

    const isFiltered = activeFilterCount > 0;

    // Scoped quotations based on active search, customer, and date/month filters (used for live status dropdown counts)
    const scopedQuotations = useMemo(() => {
        return (Array.isArray(quotations) ? quotations : []).filter((q: any) => {
            const matchSearch =
                !searchTerm ||
                (q.quotationNumber && q.quotationNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (q.rfqNumber && q.rfqNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (q.customerName && q.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (q.items && q.items.some((i: any) => (i.productName || i.description || i.fgItem?.name || '').toLowerCase().includes(searchTerm.toLowerCase())));

            let matchCustomer = true;
            if (filterCustomers.length > 0 && !filterCustomers.includes('All') && !filterCustomers.includes('all')) {
                const custId = (q.customer?._id || q.customer)?.toString();
                matchCustomer = filterCustomers.includes(custId);
            }

            let matchMonth = true;
            if (filterMonth) {
                const entryMonth = q.date ? new Date(q.date).toISOString().slice(0, 7) : '';
                const validMonth = q.validUntil ? new Date(q.validUntil).toISOString().slice(0, 7) : '';
                if (filterDateType === 'entry') {
                    matchMonth = entryMonth === filterMonth;
                } else if (filterDateType === 'validity') {
                    matchMonth = validMonth === filterMonth;
                } else {
                    matchMonth = entryMonth === filterMonth || validMonth === filterMonth;
                }
            }

            return matchSearch && matchCustomer && matchMonth;
        });
    }, [quotations, searchTerm, filterCustomers, filterMonth, filterDateType]);

    const statusCounts = useMemo(() => {
        const counts: Record<string, number> = {
            All: scopedQuotations.length,
            Draft: 0,
            'Pending Approval': 0,
            Approved: 0,
            Sent: 0,
            Closed: 0,
            Rejected: 0
        };
        scopedQuotations.forEach((q: any) => {
            const st = q.status || 'Draft';
            if (counts[st] !== undefined) {
                counts[st] = (counts[st] || 0) + 1;
            } else {
                counts[st] = 1;
            }
        });
        return counts;
    }, [scopedQuotations]);

    // Dynamic Quotation Pipeline Financials in INR calculated on filtered quotations
    const overallQuoteFinancials = useMemo(() => {
        let totalPipelineInr = 0;
        let sentActiveInr = 0;
        let pendingApprovalInr = 0;
        let approvedInr = 0;

        let totalPipelineCount = 0;
        let sentActiveCount = 0;
        let pendingApprovalCount = 0;
        let approvedCount = 0;

        const currencyTotals: Record<string, number> = {};
        const currencyInrTotals: Record<string, number> = {};

        (Array.isArray(filteredQuotations) ? filteredQuotations : []).forEach((q: any) => {
            const amt = Number(q.totalAmount || q.grandTotal || q.subtotal || 0);
            const curr = normalizeCurrencyCode(q.currency);
            const inrVal = convertToINR(amt, curr).inrAmount;
            const status = q.status || 'Draft';

            if (status !== 'Rejected' && status !== 'Closed') {
                totalPipelineInr += inrVal;
                totalPipelineCount += 1;

                currencyTotals[curr] = (currencyTotals[curr] || 0) + amt;
                currencyInrTotals[curr] = (currencyInrTotals[curr] || 0) + inrVal;
            }

            if (status === 'Sent') {
                sentActiveInr += inrVal;
                sentActiveCount += 1;
            } else if (status === 'Pending Approval' || status === 'Draft') {
                pendingApprovalInr += inrVal;
                pendingApprovalCount += 1;
            } else if (status === 'Approved') {
                approvedInr += inrVal;
                approvedCount += 1;
            }
        });

        return {
            totalPipelineInr,
            formattedTotalPipelineInr: `₹${totalPipelineInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            totalPipelineCount,
            sentActiveInr,
            formattedSentActiveInr: `₹${sentActiveInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            sentActiveCount,
            pendingApprovalInr,
            formattedPendingApprovalInr: `₹${pendingApprovalInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            pendingApprovalCount,
            approvedInr,
            formattedApprovedInr: `₹${approvedInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            approvedCount,
            currencyTotals,
            currencyInrTotals,
            hasForeign: Object.keys(currencyTotals).some(c => c !== 'INR' && currencyTotals[c] > 0)
        };
    }, [filteredQuotations, convertToINR]);

    const handleResetFilters = () => {
        setSearchTerm('');
        setFilterStatus('All');
        setFilterCustomers([]);
        setFilterMonth('');
        setFilterDateType('entry');
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            
            {/* Executive KPI Overview (Collapsible) */}
            <div className="space-y-3">
                {!showDashboard ? (
                    /* Collapsed Compact State */
                    <div className="hidden sm:flex bg-slate-100/90 dark:bg-slate-800/80 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700/60 items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3 overflow-x-auto py-0.5">
                            <span className="font-extrabold uppercase tracking-wider text-[11px] text-slate-500 dark:text-slate-400 shrink-0 flex items-center gap-1.5">
                                <IndianRupee size={13} className="text-indigo-600" /> Quotation Summary:
                            </span>
                            <span className="font-bold text-slate-700 dark:text-slate-200 shrink-0">
                                Pipeline: <strong className="text-indigo-600 font-mono">{overallQuoteFinancials.formattedTotalPipelineInr}</strong> ({filteredQuotations.length})
                            </span>
                            {isFiltered && (
                                <span className="px-1.5 py-0.2 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 rounded text-[9px] font-bold border border-indigo-200 dark:border-indigo-800 shrink-0">
                                    Filtered
                                </span>
                            )}
                            <span className="text-slate-300 dark:text-slate-600">|</span>
                            <span className="text-slate-600 dark:text-slate-300 shrink-0">
                                Sent/Active: <strong className="text-blue-600 font-mono">{overallQuoteFinancials.formattedSentActiveInr}</strong> ({overallQuoteFinancials.sentActiveCount})
                            </span>
                            <span className="text-slate-300 dark:text-slate-600">|</span>
                            <span className="text-slate-600 dark:text-slate-300 shrink-0">
                                Pending Approval: <strong className="text-amber-600 font-mono">{overallQuoteFinancials.formattedPendingApprovalInr}</strong> ({overallQuoteFinancials.pendingApprovalCount})
                            </span>
                            <span className="text-slate-300 dark:text-slate-600">|</span>
                            <span className="text-slate-600 dark:text-slate-300 shrink-0">
                                Approved: <strong className="text-emerald-600 font-mono">{overallQuoteFinancials.formattedApprovedInr}</strong> ({overallQuoteFinancials.approvedCount})
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowDashboard(true)}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1 shrink-0 cursor-pointer px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors"
                            title="Show Executive KPI Dashboard"
                        >
                            <span>Show Dashboard</span>
                            <ChevronDown size={14} />
                        </button>
                    </div>
                ) : (
                    /* Expanded 4 KPI Cards */
                    <>
                        {/* Top Dashboard Header with Title and Accessible Hide / Collapse Button */}
                        <div className="flex items-center justify-between pb-1 px-1">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Executive Quotation Dashboard</span>
                                {isFiltered && (
                                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                                        Filtered ({filteredQuotations.length} of {quotations.length})
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

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                            {/* Card 1: Total Pipeline Value */}
                            <div className="bg-gradient-to-br from-indigo-50/90 via-white to-slate-50 dark:from-indigo-950/30 dark:via-slate-900 dark:to-slate-900 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 shadow-xs relative overflow-hidden">
                                <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 mb-2">
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Pipeline Value</span>
                                    <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                                        <IndianRupee size={16} />
                                    </div>
                                </div>
                                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight truncate">
                                    {overallQuoteFinancials.formattedTotalPipelineInr}
                                </div>
                                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                    <span>Active Proposals</span>
                                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{filteredQuotations.length} Quotes</span>
                                </div>
                            </div>

                            {/* Card 2: Sent / Active Proposals */}
                            <div 
                                onClick={() => setFilterStatus(filterStatus === 'Sent' ? 'All' : 'Sent')}
                                className="bg-gradient-to-br from-blue-50/90 via-white to-slate-50 dark:from-blue-950/30 dark:via-slate-900 dark:to-slate-900 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/40 shadow-xs relative overflow-hidden cursor-pointer group hover:border-blue-400 dark:hover:border-blue-600 transition-colors"
                                title="Click to filter Active / Sent Quotes"
                            >
                                <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-2">
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Active / Sent Quotes</span>
                                    <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center group-hover:scale-105 transition-transform">
                                        <ArrowRight size={16} />
                                    </div>
                                </div>
                                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight truncate">
                                    {overallQuoteFinancials.formattedSentActiveInr}
                                </div>
                                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                    <span>Awaiting Customer Decision</span>
                                    <span className="font-bold text-blue-600 dark:text-blue-400">{overallQuoteFinancials.sentActiveCount} Sent</span>
                                </div>
                            </div>

                            {/* Card 3: Pending Approvals */}
                            <div 
                                onClick={() => setFilterStatus(filterStatus === 'Pending Approval' ? 'All' : 'Pending Approval')}
                                className="bg-gradient-to-br from-amber-50/90 via-white to-slate-50 dark:from-amber-950/30 dark:via-slate-900 dark:to-slate-900 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/40 shadow-xs relative overflow-hidden cursor-pointer group hover:border-amber-400 dark:hover:border-amber-600 transition-colors"
                                title="Click to filter Pending Approval Quotes"
                            >
                                <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-2">
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Pending Approval</span>
                                    <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center group-hover:scale-105 transition-transform">
                                        <Clock size={16} />
                                    </div>
                                </div>
                                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight truncate">
                                    {overallQuoteFinancials.formattedPendingApprovalInr}
                                </div>
                                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                    <span>Draft / Internal Review</span>
                                    <span className="font-bold text-amber-600 dark:text-amber-400">{overallQuoteFinancials.pendingApprovalCount} Review</span>
                                </div>
                            </div>

                            {/* Card 4: Approved / Converted */}
                            <div 
                                onClick={() => setFilterStatus(filterStatus === 'Approved' ? 'All' : 'Approved')}
                                className="bg-gradient-to-br from-emerald-50/90 via-white to-slate-50 dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 shadow-xs relative overflow-hidden cursor-pointer group hover:border-emerald-400 dark:hover:border-emerald-600 transition-colors"
                                title="Click to filter Approved Quotes"
                            >
                                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-2">
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Approved / Converted</span>
                                    <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center group-hover:scale-105 transition-transform">
                                        <CheckCircle2 size={16} />
                                    </div>
                                </div>
                                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight truncate">
                                    {overallQuoteFinancials.formattedApprovedInr}
                                </div>
                                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                    <span>Ready for Customer PO</span>
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{overallQuoteFinancials.approvedCount} Won</span>
                                </div>
                            </div>
                        </div>

                        {/* Benchmark Exchange Rates & Store Prefix Setting Link */}
                        <div className="bg-slate-50 dark:bg-slate-900/60 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs flex flex-wrap items-center justify-between gap-2 text-slate-500 dark:text-slate-400">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                    <Tag size={12} className="text-indigo-500" />
                                    <span>Store Prefix Conversion Active:</span>
                                </span>
                                <span className="font-mono text-[11px]">
                                    USD: ₹{exchangeRates.USD?.toFixed(2) || '84.50'} | EUR: ₹{exchangeRates.EUR?.toFixed(2) || '92.00'} | GBP: ₹{exchangeRates.GBP?.toFixed(2) || '108.00'}
                                </span>
                            </div>

                            <Link 
                                href="/dashboard/store/masters/prefix-settings"
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 hover:underline shrink-0"
                            >
                                <Settings size={11} />
                                <span>Manage Exchange Rates</span>
                            </Link>
                        </div>

                        {/* Foreign Currency Breakdown (if quotations have foreign currencies) */}
                        {overallQuoteFinancials.hasForeign && (
                            <div className="flex flex-wrap items-center gap-1.5 text-xs bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                                <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mr-1">Foreign Breakdown:</span>
                                {Object.keys(overallQuoteFinancials.currencyTotals).map(curr => {
                                    const amt = overallQuoteFinancials.currencyTotals[curr];
                                    if (amt <= 0) return null;
                                    const sym = getCurrencySymbol(curr);
                                    const isForeign = curr !== 'INR';
                                    return (
                                        <div key={curr} className="px-2 py-0.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-medium flex items-center gap-1">
                                            <span className="font-bold text-slate-700 dark:text-slate-200">{sym}{amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {curr}</span>
                                            {isForeign && (
                                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                                                    (≈ ₹{(overallQuoteFinancials.currencyInrTotals[curr] || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })})
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>
            
            {/* Search, Filter & Action Toolbar */}
            <div className="bg-white dark:bg-slate-900 p-2.5 sm:p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5">
                {/* Main Control Row - Fits in a SINGLE line on Desktop (`lg:flex`) */}
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2 sm:gap-2.5">
                    {/* Left & Center: Search + Desktop Inline Filters */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        {/* Search Input: Compact on desktop so filters fit in the same line */}
                        <div className="relative flex-1 lg:flex-initial lg:w-48 xl:w-56 shrink-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                                type="text"
                                placeholder="Search Quote, RFQ, customer, item..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50/50 dark:bg-slate-800/50"
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

                        {/* Inline Filters on Desktop (`lg:flex`) */}
                        <div className="hidden lg:flex items-center gap-2 flex-wrap min-w-0">
                            {/* Customer Select */}
                            <SearchableMultiSelect
                                options={customerOptions}
                                selectedValues={filterCustomers}
                                onChange={setFilterCustomers}
                                placeholder="All Customers"
                                searchPlaceholder="Search customer..."
                                className="w-40 xl:w-52"
                            />

                            {/* Status Select */}
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500/20 max-w-[140px] xl:max-w-[160px]"
                                title="Filter by Status"
                            >
                                <option value="All">All Statuses ({statusCounts.All || 0})</option>
                                <option value="Draft">Draft ({statusCounts.Draft || 0})</option>
                                <option value="Pending Approval">Pending Approval ({statusCounts['Pending Approval'] || 0})</option>
                                <option value="Approved">Approved ({statusCounts.Approved || 0})</option>
                                <option value="Sent">Sent ({statusCounts.Sent || 0})</option>
                                <option value="Closed">Closed ({statusCounts.Closed || 0})</option>
                                <option value="Rejected">Rejected ({statusCounts.Rejected || 0})</option>
                            </select>

                            {/* Month Filter */}
                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                                <Calendar size={13} className="text-slate-400 shrink-0" />
                                <select
                                    value={filterDateType}
                                    onChange={(e) => setFilterDateType(e.target.value as any)}
                                    className="bg-transparent text-xs font-bold text-slate-600 dark:text-slate-300 outline-none cursor-pointer pr-1"
                                    title="Date basis"
                                >
                                    <option value="entry">Quote</option>
                                    <option value="validity">Valid</option>
                                    <option value="either">Any</option>
                                </select>
                                <input
                                    type="month"
                                    value={filterMonth}
                                    onChange={(e) => setFilterMonth(e.target.value)}
                                    className="px-1.5 py-0.5 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 rounded border border-slate-200 dark:border-slate-700 outline-none cursor-pointer text-center"
                                    title="Choose month"
                                />
                                {filterMonth && (
                                    <button
                                        type="button"
                                        onClick={() => setFilterMonth('')}
                                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                                        title="Clear month filter"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>

                            {/* Reset Button (only when filters active) */}
                            {isFiltered && (
                                <button
                                    type="button"
                                    onClick={handleResetFilters}
                                    className="p-1.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-800 transition-all flex items-center gap-1 cursor-pointer shrink-0 text-xs font-bold"
                                    title="Reset all filters"
                                >
                                    <RotateCcw size={13} />
                                    <span className="hidden xl:inline">Reset</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Right Action Group: Mobile Toggles + Dashboard Toggle + Action Button */}
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 self-end lg:self-auto">
                        {/* Mobile Only: Small Filter Toggle Icon */}
                        <button
                            type="button"
                            onClick={() => setShowFilters(prev => !prev)}
                            className={`lg:hidden p-2 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer border ${
                                showFilters || activeFilterCount > 0
                                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-300'
                                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                            }`}
                            title={showFilters ? "Hide Filters" : "Show Filters"}
                            aria-label="Toggle Filters"
                        >
                            <Filter size={15} />
                            {activeFilterCount > 0 && (
                                <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-bold">
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
                                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-300'
                                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                            }`}
                            title={showDashboard ? "Hide Executive KPI Dashboard" : "Show Executive KPI Dashboard"}
                            aria-label="Toggle Dashboard"
                        >
                            <LayoutGrid size={15} />
                            <span className="hidden sm:inline">{showDashboard ? "Hide" : "Dashboard"}</span>
                        </button>

                        {/* Primary Action Button */}
                        <button
                            type="button"
                            onClick={handleOpenCreateModal}
                            className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                            <Plus size={15} />
                            <span className="hidden sm:inline">Create Outward Quote</span>
                            <span className="sm:hidden">Create</span>
                        </button>
                    </div>
                </div>

                {/* Mobile Collapsible Filter Drawer (Hidden on desktop because filters are inline) */}
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
                                <span>Close</span>
                            </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {/* Mobile Customer Select */}
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-slate-500">Customer:</label>
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
                                <label className="text-[10px] font-bold text-slate-500">Status:</label>
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="w-full px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
                                >
                                    <option value="All">All Statuses ({statusCounts.All || 0})</option>
                                    <option value="Draft">Draft ({statusCounts.Draft || 0})</option>
                                    <option value="Pending Approval">Pending Approval ({statusCounts['Pending Approval'] || 0})</option>
                                    <option value="Approved">Approved ({statusCounts.Approved || 0})</option>
                                    <option value="Sent">Sent ({statusCounts.Sent || 0})</option>
                                    <option value="Closed">Closed ({statusCounts.Closed || 0})</option>
                                    <option value="Rejected">Rejected ({statusCounts.Rejected || 0})</option>
                                </select>
                            </div>

                            {/* Mobile Month Filter */}
                            <div className="sm:col-span-2 flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                                <Calendar size={13} className="text-slate-400 shrink-0" />
                                <select
                                    value={filterDateType}
                                    onChange={(e) => setFilterDateType(e.target.value as any)}
                                    className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
                                >
                                    <option value="entry">Quote Date</option>
                                    <option value="validity">Valid Until</option>
                                    <option value="either">Either Date</option>
                                </select>
                                <input
                                    type="month"
                                    value={filterMonth}
                                    onChange={(e) => setFilterMonth(e.target.value)}
                                    className="flex-1 px-2 py-0.5 bg-white dark:bg-slate-900 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 outline-none"
                                />
                                {filterMonth && (
                                    <button
                                        type="button"
                                        onClick={() => setFilterMonth('')}
                                        className="text-slate-400 p-0.5"
                                    >
                                        <X size={13} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {isFiltered && (
                            <button
                                type="button"
                                onClick={handleResetFilters}
                                className="w-full py-1.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center justify-center gap-1 cursor-pointer"
                            >
                                <RotateCcw size={13} />
                                <span>Reset All Filters</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {loading ? (
                <div className="flex justify-center p-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            ) : filteredQuotations.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    <FileText className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                        {isFiltered ? "No Quotations Match Your Filters" : "No Outward Sales Quotations Found"}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                        {isFiltered ? "Try adjusting or clearing your search, status, customer, or month filter." : "Create an Outward Quotation to send formal pricing proposals to customers."}
                    </p>
                    {isFiltered && (
                        <button
                            type="button"
                            onClick={handleResetFilters}
                            className="mt-3.5 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold text-xs rounded-xl border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                        >
                            <RotateCcw size={13} />
                            <span>Reset All Filters</span>
                        </button>
                    )}
                </div>
            ) : (
                /* Table & Cards View */
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    {/* Desktop Table View - Scrollable with Sticky Header */}
                    <div className="hidden md:block overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] min-h-[350px]">
                        <table className="w-full text-sm text-left">
                            <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 shadow-2xs">
                                <tr>
                                    <th className="px-4 py-3.5">Quotation #</th>
                                    <th className="px-4 py-3.5">Linked RFQ #</th>
                                    <th className="px-4 py-3.5">Customer Name</th>
                                    <th className="px-4 py-3.5 text-center">Quote Date</th>
                                    <th className="px-4 py-3.5 text-right">Grand Total</th>
                                    <th className="px-4 py-3.5 text-center">Status</th>
                                    <th className="px-4 py-3.5 text-center">Prepared By</th>
                                    <th className="px-4 py-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {filteredQuotations.map((quote) => {
                                    const total = Number(quote.totalAmount || quote.grandTotal || quote.subtotal || 0);

                                    return (
                                        <tr key={quote._id || quote.quotationNumber} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="px-4 py-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                                {quote.quotationNumber}
                                                <span className="block text-[10px] text-slate-400 font-sans font-normal">{new Date(quote.date || quote.createdAt || Date.now()).toLocaleDateString('en-GB')}</span>
                                            </td>

                                            <td className="px-4 py-3.5 font-mono font-bold text-slate-700 dark:text-slate-300 text-xs">
                                                {quote.rfqNumber || quote.rfq?.rfqNumber ? (
                                                    <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-md border border-indigo-200 dark:border-indigo-800">
                                                        {quote.rfqNumber || quote.rfq?.rfqNumber}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 font-normal">Direct</span>
                                                )}
                                            </td>

                                            <td className="px-4 py-3.5 font-bold text-slate-800 dark:text-slate-200 text-xs">
                                                <div className="flex items-center gap-1.5">
                                                    <Building2 size={13} className="text-indigo-500 shrink-0" />
                                                    <span className="truncate max-w-[180px]">{quote.customerName || quote.customer?.name || 'Customer'}</span>
                                                </div>
                                            </td>

                                            <td className="px-4 py-3.5 text-center font-bold text-slate-700 dark:text-slate-300 text-xs">
                                                {quote.date ? new Date(quote.date).toLocaleDateString('en-GB') : 'N/A'}
                                            </td>

                                            <td className="px-4 py-3.5 text-right font-mono text-sm">
                                                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                                    <span className="font-extrabold text-indigo-600 dark:text-indigo-400">
                                                        {getCurrencySymbol(quote.currency)}{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                        {normalizeCurrencyCode(quote.currency)}
                                                    </span>
                                                </div>
                                                {(() => {
                                                    const inr = convertToINR(total, quote.currency);
                                                    if (inr.isForeign) {
                                                        return (
                                                            <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5" title={`Rate: 1 ${quote.currency} = ₹${inr.rate.toFixed(2)}`}>
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
                                                    value={quote.status || 'Draft'}
                                                    onChange={(e) => handleStatusChange(quote._id, e.target.value)}
                                                    className={`px-2.5 py-1 rounded-full text-xs font-bold border-none outline-none cursor-pointer ${
                                                        quote.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                                                        quote.status === 'Sent' ? 'bg-blue-100 text-blue-800' :
                                                        quote.status === 'Closed' ? 'bg-slate-100 text-slate-600' :
                                                        quote.status === 'Rejected' ? 'bg-rose-100 text-rose-800' :
                                                        'bg-amber-100 text-amber-800'
                                                    }`}
                                                >
                                                    <option value="Draft">Draft</option>
                                                    <option value="Pending Approval">Pending Approval</option>
                                                    <option value="Approved">Approved</option>
                                                    <option value="Sent">Sent</option>
                                                    <option value="Rejected">Rejected</option>
                                                    <option value="Closed">Closed</option>
                                                </select>
                                            </td>

                                            <td className="px-4 py-3.5 text-center text-xs font-medium text-slate-600 dark:text-slate-400">
                                                <div className="flex items-center justify-center gap-1 font-bold text-slate-700 dark:text-slate-300">
                                                    <User size={13} className="text-indigo-500" />
                                                    {getUserName(quote.preparedBy || quote.createdBy)}
                                                </div>
                                                {quote.createdAt && <div className="text-[10px] text-slate-400">{new Date(quote.createdAt).toLocaleDateString('en-GB')}</div>}
                                            </td>

                                            <td className="px-4 py-3.5 text-right space-x-1.5">
                                                <button
                                                    onClick={() => setSelectedQuote(quote)}
                                                    title="View Details"
                                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1"
                                                >
                                                    <Eye size={13} /> View
                                                </button>

                                                <button
                                                    onClick={() => handleOpenEditModal(quote)}
                                                    title="Edit Quotation"
                                                    className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1"
                                                >
                                                    <Edit2 size={13} /> Edit
                                                </button>

                                                <button
                                                    onClick={() => handlePrintQuotePdf(quote)}
                                                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1 shadow-sm"
                                                >
                                                    <Printer size={13} /> PDF
                                                </button>

                                                <button
                                                    onClick={() => handleDeleteQuote(quote)}
                                                    title="Delete Quotation"
                                                    className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400 text-xs font-bold rounded-xl transition-colors inline-flex items-center"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View - Scrollable */}
                    <div className="block md:hidden p-3 space-y-3 pb-28 sm:pb-20 bg-gray-50/50 dark:bg-slate-900/40 max-h-[calc(100vh-270px)] overflow-y-auto">
                        {filteredQuotations.map((quote) => {
                            const total = Number(quote.totalAmount || quote.grandTotal || quote.subtotal || 0);

                            return (
                                <div
                                    key={quote._id || quote.quotationNumber}
                                    className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-3"
                                >
                                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-2.5">
                                        <div>
                                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm block">{quote.quotationNumber}</span>
                                            <span className="text-[10px] text-slate-400">{new Date(quote.date || quote.createdAt || Date.now()).toLocaleDateString('en-GB')}</span>
                                        </div>
                                        <select
                                            value={quote.status || 'Draft'}
                                            onChange={(e) => handleStatusChange(quote._id, e.target.value)}
                                            className={`px-2.5 py-1 rounded-full text-xs font-bold border-none outline-none cursor-pointer ${
                                                quote.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                                                quote.status === 'Sent' ? 'bg-blue-100 text-blue-800' :
                                                quote.status === 'Closed' ? 'bg-slate-100 text-slate-600' :
                                                quote.status === 'Rejected' ? 'bg-rose-100 text-rose-800' :
                                                'bg-amber-100 text-amber-800'
                                            }`}
                                        >
                                            <option value="Draft">Draft</option>
                                            <option value="Pending Approval">Pending Approval</option>
                                            <option value="Approved">Approved</option>
                                            <option value="Sent">Sent</option>
                                            <option value="Rejected">Rejected</option>
                                            <option value="Closed">Closed</option>
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Customer</span>
                                            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{quote.customerName || quote.customer?.name || 'Customer'}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Linked RFQ</span>
                                            <p className="font-mono text-slate-700 dark:text-slate-300 font-semibold">{quote.rfqNumber || quote.rfq?.rfqNumber || "Direct Quote"}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Prepared By</span>
                                            <p className="text-slate-600 dark:text-slate-400">{getUserName(quote.preparedBy || quote.createdBy)}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Grand Total</span>
                                            <p className="font-extrabold text-sm text-indigo-600 dark:text-indigo-400 font-mono flex items-center gap-1.5 flex-wrap">
                                                <span>{getCurrencySymbol(quote.currency)}{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                    {normalizeCurrencyCode(quote.currency)}
                                                </span>
                                            </p>
                                            {(() => {
                                                const inr = convertToINR(total, quote.currency);
                                                if (inr.isForeign) {
                                                    return (
                                                        <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
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
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-700">
                                        <button
                                            onClick={() => setSelectedQuote(quote)}
                                            className="flex-1 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center gap-1"
                                        >
                                            <Eye size={13} /> View
                                        </button>
                                        <button
                                            onClick={() => handlePrintQuotePdf(quote)}
                                            className="flex-1 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg flex items-center justify-center gap-1 shadow-sm"
                                        >
                                            <Printer size={13} /> PDF
                                        </button>
                                        <button
                                            onClick={() => handleOpenEditModal(quote)}
                                            className="py-1.5 px-2.5 text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border border-indigo-200 dark:border-indigo-800"
                                        >
                                            <Edit2 size={13} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteQuote(quote)}
                                            className="py-1.5 px-2.5 text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-900/30 rounded-lg border border-rose-200 dark:border-rose-800"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Create / Edit Outward Quotation Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-[98vw] xl:max-w-7xl 2xl:max-w-[1550px] overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
                        
                        <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white flex justify-between items-center flex-shrink-0 border-b border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                                    {editingQuote ? <Edit2 size={20} /> : <FileText size={20} />}
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-base sm:text-lg font-black tracking-tight truncate">
                                        {editingQuote ? 'Edit Outward Sales Quotation' : 'Create Outward Sales Quotation'}
                                    </h2>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">Quotation #: <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{newQuote.quotationNumber}</span></p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setIsCreateModalOpen(false); setEditingQuote(null); }}
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

                            {/* Step 1: Linked RFQ & Customer Logistics */}
                            <div className="bg-slate-50/80 dark:bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3 sm:space-y-4">
                                <h3 className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                                    1. Linked Inward RFQ & Customer Details
                                </h3>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Linked Inward RFQ <span className="text-slate-400 font-normal">(Optional - Direct Quotation if empty)</span>
                                        </label>
                                        <SearchableSelect
                                            options={[
                                                { value: '', label: '-- None (Direct Customer Quotation) --' },
                                                ...(Array.isArray(rfqs) ? rfqs : []).map(r => ({
                                                    value: r._id,
                                                    label: `${r.rfqNumber} - ${r.customerName || 'Customer'} (${r.items?.length || 0} Items)`
                                                }))
                                            ]}
                                            value={selectedRfqId}
                                            onChange={(val: any) => {
                                                if (!val) {
                                                    setSelectedRfqId('');
                                                    setNewQuote(prev => ({
                                                        ...prev,
                                                        rfq: '',
                                                        rfqId: '',
                                                        rfqNumber: ''
                                                    }));
                                                } else {
                                                    handleSelectRfq(val);
                                                }
                                            }}
                                            placeholder="Select Linked Inward RFQ (Optional)..."
                                        />
                                    </div>

                                    <div className="sm:col-span-2 space-y-1" data-has-error={!!formErrors.customer}>
                                        <label className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            <span>Customer / Client <span className="text-rose-500">*</span></span>
                                            {formErrors.customer && <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">{formErrors.customer}</span>}
                                        </label>
                                        <SearchableSelect
                                            options={(Array.isArray(customers) ? customers : []).map(c => ({
                                                value: (c._id || c.id)?.toString(),
                                                label: `${c.name || c.companyName} ${c.code ? `(${c.code})` : ''} ${c.city ? `- ${c.city}` : ''}`.trim()
                                            }))}
                                            value={newQuote.customer}
                                            hasError={!!formErrors.customer}
                                            onChange={(val: any) => handleSelectCustomer(val)}
                                            placeholder="Select Customer..."
                                        />
                                        {!newQuote.customer && (
                                            <input
                                                type="text"
                                                value={newQuote.customerName}
                                                onChange={(e) => {
                                                    setNewQuote({ ...newQuote, customerName: e.target.value });
                                                    if (e.target.value) clearError('customer');
                                                }}
                                                placeholder="Or type customer name directly..."
                                                className={`w-full mt-2 px-3.5 py-2 rounded-xl text-sm font-semibold outline-none transition-all ${
                                                    formErrors.customer
                                                        ? 'bg-rose-50/50 dark:bg-rose-950/40 border border-rose-500 text-rose-900 dark:text-rose-100 ring-1 ring-rose-400'
                                                        : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20'
                                                }`}
                                            />
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1.5">
                                            Currency *
                                        </label>
                                        <select
                                            value={newQuote.currency || 'INR'}
                                            onChange={(e) => setNewQuote({ ...newQuote, currency: e.target.value })}
                                            className="w-full px-3.5 py-2 bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl text-sm font-bold text-indigo-700 dark:text-indigo-300 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        >
                                            {CURRENCY_OPTIONS.map((c) => (
                                                <option key={c.code} value={c.code}>
                                                    {c.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-1" data-has-error={!!formErrors.date}>
                                        <label className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            <span>Quotation Date <span className="text-rose-500">*</span></span>
                                            {formErrors.date && <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">{formErrors.date}</span>}
                                        </label>
                                        <input
                                            type="date"
                                            value={newQuote.date}
                                            onChange={(e) => {
                                                setNewQuote({ ...newQuote, date: e.target.value });
                                                if (e.target.value) clearError('date');
                                            }}
                                            className={`w-full px-3.5 py-2 rounded-xl text-sm font-semibold outline-none transition-all ${
                                                formErrors.date
                                                    ? 'bg-rose-50/50 dark:bg-rose-950/40 border border-rose-500 text-rose-900 dark:text-rose-100 ring-1 ring-rose-400'
                                                    : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20'
                                            }`}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Quotation Valid Until
                                        </label>
                                        <input
                                            type="date"
                                            value={newQuote.validUntil}
                                            onChange={(e) => setNewQuote({ ...newQuote, validUntil: e.target.value })}
                                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Transportation / Freight Mode
                                        </label>
                                        <select
                                            value={newQuote.transportationType}
                                            onChange={(e) => setNewQuote({ ...newQuote, transportationType: e.target.value })}
                                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none"
                                        >
                                            <option value="Road Freight">Road Freight (By Truck)</option>
                                            <option value="Air Freight">Air Freight (Express)</option>
                                            <option value="Sea Freight">Sea Freight (Cargo)</option>
                                            <option value="Courier Service">Courier Service</option>
                                            <option value="Included">Freight Included in Price</option>
                                            <option value="Ex-Works">Ex-Works (Customer Pickup)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Freight Charges ({getCurrencySymbol(newQuote.currency)})
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={newQuote.transportationCharges}
                                            onChange={(e) => {
                                                const val = Number(e.target.value) || 0;
                                                setNewQuote(prev => ({ ...prev, transportationCharges: val }));
                                                recalculateTotals(newQuote.items);
                                            }}
                                            placeholder="0"
                                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Packaging Type
                                        </label>
                                        <select
                                            value={newQuote.packagingType}
                                            onChange={(e) => setNewQuote({ ...newQuote, packagingType: e.target.value })}
                                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none"
                                        >
                                            <option value="Standard">Standard Box Packing</option>
                                            <option value="Wooden Crate">Wooden Crate Packing</option>
                                            <option value="Palletized">Palletized Stretch Wrap</option>
                                            <option value="Bubble Wrap">Bubble Wrap & Heavy Box</option>
                                            <option value="Custom Export">Custom Export Packing</option>
                                            <option value="None">No Special Packing</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Packaging Charges ({getCurrencySymbol(newQuote.currency)})
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={newQuote.packagingCharges}
                                            onChange={(e) => {
                                                const val = Number(e.target.value) || 0;
                                                setNewQuote(prev => ({ ...prev, packagingCharges: val }));
                                                recalculateTotals(newQuote.items);
                                            }}
                                            placeholder="0"
                                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Step 2: Quoted Product Items - All in 1 Line on Desktop */}
                            <div className="bg-slate-50/80 dark:bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                                        2. Quoted Product Items & Rates
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={handleAddItem}
                                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-950/80 bg-indigo-50 dark:bg-indigo-950/60 px-3.5 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
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
                                    <div className="col-span-2 text-right">Unit Rate ({getCurrencySymbol(newQuote.currency)})</div>
                                    <div className="col-span-1 text-center">GST %</div>
                                    <div className="col-span-1 text-right">Action</div>
                                </div>

                                {/* Items Rows */}
                                <div className="space-y-2.5">
                                    {newQuote.items.map((item, idx) => (
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
                                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500"
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
                                                        className="w-full px-2 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-slate-200 text-center outline-none focus:ring-1 focus:ring-indigo-500"
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
                                                        placeholder={`Rate ${getCurrencySymbol(newQuote.currency)}`}
                                                        className={`w-full px-3 py-2 border rounded-xl text-xs font-extrabold text-right font-mono outline-none transition-all ${
                                                            formErrors[`item_${idx}_rate`]
                                                                ? 'bg-rose-50/50 dark:bg-rose-950/40 border-rose-500 text-rose-900 dark:text-rose-100 ring-1 ring-rose-400'
                                                                : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-indigo-600 dark:text-indigo-400'
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
                                                    {idx === newQuote.items.length - 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={handleAddItem}
                                                            className="p-2 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 rounded-xl transition-colors cursor-pointer shadow-2xs"
                                                            title="Add Next Line Item"
                                                        >
                                                            <Plus size={18} />
                                                        </button>
                                                    )}
                                                    {newQuote.items.length > 1 && (
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
                                        className="w-full py-3 px-4 border-2 border-dashed border-indigo-200 hover:border-indigo-500 dark:border-indigo-800/80 dark:hover:border-indigo-500 bg-indigo-50/40 hover:bg-indigo-50 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-2xs cursor-pointer active:scale-[0.99] group"
                                    >
                                        <Plus size={16} className="text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
                                        <span>+ Add New Line Item</span>
                                    </button>
                                </div>
                            </div>

                            {/* Summary Card */}
                            <div className="bg-indigo-50/70 dark:bg-indigo-950/40 p-4 sm:p-5 rounded-2xl border border-indigo-200 dark:border-indigo-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
                                <div className="text-xs space-y-1">
                                    <div className="font-bold text-slate-700 dark:text-slate-300">
                                        Subtotal: <span className="font-mono text-slate-900 dark:text-white">{getCurrencySymbol(newQuote.currency)}{newQuote.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="font-bold text-slate-700 dark:text-slate-300">
                                        Total Tax (GST): <span className="font-mono text-slate-900 dark:text-white">{getCurrencySymbol(newQuote.currency)}{newQuote.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                                <div className="text-left sm:text-right">
                                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Grand Total ({newQuote.currency || 'INR'})</span>
                                    <span className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                                        {getCurrencySymbol(newQuote.currency)}{newQuote.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>

                        </div>

                        <div className="p-3.5 sm:p-5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 flex-shrink-0">
                            <button onClick={() => { setIsCreateModalOpen(false); setEditingQuote(null); }} className="w-full sm:w-auto px-5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateQuoteSubmit}
                                disabled={submitting}
                                className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <FileText size={16} />
                                {submitting ? 'Saving...' : (editingQuote ? 'Update Outward Quote' : 'Save Outward Quote')}
                            </button>
                        </div>

                    </div>
                </div>
            )}

            {/* View Quotation & User Audit Details Modal */}
            {selectedQuote && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-[98vw] xl:max-w-7xl 2xl:max-w-[1550px] overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
                        
                        <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white flex justify-between items-center flex-shrink-0 border-b border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                                    <FileText size={20} />
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-base sm:text-lg font-black font-mono tracking-tight text-indigo-600 dark:text-indigo-400 truncate">{selectedQuote.quotationNumber}</h2>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">Outward Sales Quotation & User Audit Details</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedQuote(null)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-2"
                                title="Close"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-3.5 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5">
                            
                            {/* General Status & Interactive Control */}
                            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 text-xs bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                                <div>
                                    <span className="text-slate-400 block mb-0.5">Linked RFQ Number:</span>
                                    <strong className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                                        {selectedQuote.rfqNumber || selectedQuote.rfq?.rfqNumber || 'Direct'}
                                    </strong>
                                </div>

                                <div>
                                    <span className="text-slate-400 block mb-0.5">Quotation Date:</span>
                                    <strong className="text-slate-800 dark:text-slate-200 font-bold">
                                        {selectedQuote.date ? new Date(selectedQuote.date).toLocaleDateString('en-GB') : 'N/A'}
                                    </strong>
                                </div>

                                <div>
                                    <span className="text-slate-400 block mb-0.5">Valid Until:</span>
                                    <strong className="text-rose-600 font-bold">
                                        {selectedQuote.validUntil ? new Date(selectedQuote.validUntil).toLocaleDateString('en-GB') : 'N/A'}
                                    </strong>
                                </div>

                                <div>
                                    <span className="text-slate-400 block mb-0.5">Currency:</span>
                                    <strong className="text-indigo-600 dark:text-indigo-400 font-bold">
                                        {selectedQuote.currency || 'INR'} ({getCurrencySymbol(selectedQuote.currency)})
                                    </strong>
                                </div>

                                <div>
                                    <span className="text-slate-400 block mb-0.5">Current Status:</span>
                                    <select
                                        value={selectedQuote.status || 'Draft'}
                                        onChange={(e) => handleStatusChange(selectedQuote._id, e.target.value)}
                                        className="px-3 py-1 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700 outline-none cursor-pointer"
                                    >
                                        <option value="Draft">Draft</option>
                                        <option value="Pending Approval">Pending Approval</option>
                                        <option value="Approved">Approved</option>
                                        <option value="Sent">Sent</option>
                                        <option value="Rejected">Rejected</option>
                                        <option value="Closed">Closed</option>
                                    </select>
                                </div>
                            </div>

                            {/* User Audit Information Box */}
                            <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-800 space-y-3">
                                <h4 className="text-xs font-extrabold text-indigo-900 dark:text-indigo-200 uppercase tracking-wider flex items-center gap-1.5">
                                    <ShieldCheck size={16} className="text-indigo-600 dark:text-indigo-400" />
                                    User Audit Tracking & Ownership
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                    <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900">
                                        <User size={16} className="text-indigo-600 shrink-0" />
                                        <div className="truncate">
                                            <span className="text-[10px] text-slate-400 block">Prepared / Created By User</span>
                                            <strong className="text-slate-800 dark:text-slate-200 font-bold truncate block">{getUserName(selectedQuote.preparedBy || selectedQuote.createdBy)}</strong>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900">
                                        <UserCheck size={16} className="text-emerald-600 shrink-0" />
                                        <div className="truncate">
                                            <span className="text-[10px] text-slate-400 block">Last Updated By User</span>
                                            <strong className="text-slate-800 dark:text-slate-200 font-bold truncate block">{getUserName(selectedQuote.updatedBy || selectedQuote.preparedBy || selectedQuote.createdBy)}</strong>
                                        </div>
                                    </div>
                                </div>

                                {/* Status Audit History Log */}
                                {Array.isArray(selectedQuote.statusHistory) && selectedQuote.statusHistory.length > 0 && (
                                    <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900 space-y-2">
                                        <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                                            <History size={13} /> Status Audit History Log
                                        </span>
                                        <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                                            {selectedQuote.statusHistory.map((h: any, idx: number) => (
                                                <div key={idx} className="flex justify-between items-center text-[11px] bg-white/80 dark:bg-slate-900/80 px-3 py-1.5 rounded-lg border border-indigo-100/60 dark:border-indigo-900/60">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold px-2 py-0.5 bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 rounded text-[10px]">
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
                                    <Building2 size={14} className="text-indigo-500" /> Customer Information
                                </h4>
                                <div className="font-extrabold text-slate-900 dark:text-white text-sm">
                                    {selectedQuote.customerName || selectedQuote.customer?.name || 'Customer'}
                                </div>
                                <div className="text-slate-500 font-medium space-x-3">
                                    {selectedQuote.customerEmail && <span>Email: {selectedQuote.customerEmail}</span>}
                                    {selectedQuote.customerPhone && <span>Phone: {selectedQuote.customerPhone}</span>}
                                </div>
                            </div>

                            {/* Requested Items Section */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Quoted Items & Pricing Breakdown</h4>
                                <div className="border rounded-xl overflow-hidden">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-600">
                                            <tr>
                                                <th className="p-3">FG Item Name</th>
                                                <th className="p-3 text-center">HSN</th>
                                                <th className="p-3 text-center">Quantity</th>
                                                <th className="p-3 text-right">Unit Rate ({selectedQuote.currency || 'INR'})</th>
                                                <th className="p-3 text-center">GST %</th>
                                                <th className="p-3 text-right">Line Total ({selectedQuote.currency || 'INR'})</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {(selectedQuote.items || []).map((item: any, idx: number) => {
                                                const qty = Number(item.quantity) || 1;
                                                const rate = Number(item.rate || item.unitPrice) || 0;
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
                                                        <td className="p-3 text-center font-bold text-indigo-600">{qty} {item.unit || 'PCS'}</td>
                                                        <td className="p-3 text-right font-bold font-mono">{getCurrencySymbol(selectedQuote.currency)}{rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                        <td className="p-3 text-center font-bold text-slate-600">{tax}%</td>
                                                        <td className="p-3 text-right font-extrabold font-mono text-indigo-600">{getCurrencySymbol(selectedQuote.currency)}{lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800 flex flex-wrap gap-2.5 justify-between items-center border-t border-slate-200 dark:border-slate-700">
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => handlePrintQuotePdf(selectedQuote)}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                                >
                                    <Printer size={14} /> Print PDF
                                </button>
                                <button
                                    onClick={() => {
                                        const quoteToEdit = selectedQuote;
                                        setSelectedQuote(null);
                                        handleOpenEditModal(quoteToEdit);
                                    }}
                                    className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-bold text-xs rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                    <Edit2 size={14} /> Edit Quotation
                                </button>
                                <button
                                    onClick={() => handleDeleteQuote(selectedQuote)}
                                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400 font-bold text-xs rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                    <Trash2 size={14} /> Delete
                                </button>
                            </div>
                            <button onClick={() => setSelectedQuote(null)} className="px-5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white font-bold text-xs rounded-xl transition-colors cursor-pointer">
                                Close
                            </button>
                        </div>

                    </div>
                </div>
            )}

        </div>
    );
}
