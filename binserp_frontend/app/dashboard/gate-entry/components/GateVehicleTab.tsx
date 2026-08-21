"use client";

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Eye, Clock, Search, ExternalLink, Calendar, LogIn, LogOut, CheckCircle2, ChevronLeft, ChevronRight, X, Truck, User, Car, Activity, Save, Building, MapPin, ArrowDown, ArrowUp, FileText, History, Download, Camera, Upload, Phone, Sparkles, RotateCcw } from 'lucide-react';
import Webcam from 'react-webcam';
import { API_BASE_URL } from '@/src/utils/config';
import ColumnFilter from '../../store/components/tables/ColumnFilter';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import AutocompleteInput, { SuggestionItem } from '@/src/components/ui/AutocompleteInput';
import { useHeader } from '@/src/context/HeaderContext';

import { useRouter } from "next/navigation";

interface GateVehicleTabProps {
    initialViewMode?: 'active' | 'history';
    initialDirectionTab?: 'Inward' | 'Outward';
}

export default function GateVehicleTab({
    initialViewMode = 'active',
    initialDirectionTab = 'Inward'
}: GateVehicleTabProps) {
    const router = useRouter();
    const { setShowBottomNav } = useHeader();
    const [visitors, setVisitors] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState<Record<string, string[]>>({});

    const handleFilterChange = (column: string, values: string[]) => {
        setFilters(prev => ({
            ...prev,
            [column]: values
        }));
    };

    // View Mode: 'active' | 'history'
    const [viewMode, setViewMode] = useState<'active' | 'history'>(initialViewMode);
    const [directionTab, setDirectionTab] = useState<'Inward' | 'Outward'>(initialDirectionTab);

    useEffect(() => {
        if (initialViewMode) {
            setViewMode(initialViewMode);
        }
    }, [initialViewMode]);

    useEffect(() => {
        if (initialDirectionTab) {
            setDirectionTab(initialDirectionTab);
        }
    }, [initialDirectionTab]);
    
    const [historyFilterType, setHistoryFilterType] = useState<'daywise' | 'monthwise'>('daywise');
    const [historyDate, setHistoryDate] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
    const [historyMonth, setHistoryMonth] = useState(() => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
    });

    // Selected Vehicle for Details Modal
    const [selectedVehicle, setSelectedVehicle] = useState<any>(null);

    // Modal State
    const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
    const [entryLoading, setEntryLoading] = useState(false);

    // Check-Out Modal State
    const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
    const [checkoutVehicle, setCheckoutVehicle] = useState<any>(null);

    // --- Entry Form State ---
    const [direction, setDirection] = useState<'Inward' | 'Outward'>('Inward');
    const [driverName, setDriverName] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [goodsType, setGoodsType] = useState('');
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [remarks, setRemarks] = useState(''); // Mapping to 'purpose'
    const [documentType, setDocumentType] = useState<string>('');
    const [documentNumber, setDocumentNumber] = useState('');
    const [documentPhotos, setDocumentPhotos] = useState<string[]>([]);
    const [vehiclePhotos, setVehiclePhotos] = useState<string[]>([]);

    // Suggestions State
    const [suggestions, setSuggestions] = useState<{
        vehicles: Array<{ vehicleNumber: string; driverName: string; phone: string; companyName: string; address: string; goodsType: string }>;
        companies: Array<{ name: string; address: string; phone: string; source?: string }>;
        drivers: Array<{ name: string; phone: string }>;
        goodsTypes: string[];
        purposes: string[];
    }>({
        vehicles: [],
        companies: [],
        drivers: [],
        goodsTypes: ['RM', 'Bought Out', 'FG', 'Machinery / Tools', 'Job Work Material', 'Consumables', 'Scrap', 'Other'],
        purposes: ['Material Inward', 'Purchase Delivery', 'Job Work Return', 'Stock Transfer', 'Machine Maintenance', 'Sample Delivery', 'Logistics']
    });

    // Load Suggestions
    const loadSuggestions = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE_URL}/api/vehicle/suggestions`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data) {
                setSuggestions(res.data);
            }
        } catch (err) {
            console.error("Failed to load vehicle suggestions", err);
        }
    }, []);

    useEffect(() => {
        loadSuggestions();
    }, [loadSuggestions]);

    // Handle suggestion selections
    const handleVehicleSelect = (item: SuggestionItem) => {
        const raw = item.raw;
        if (raw) {
            if (raw.driverName) setDriverName(raw.driverName);
            if (raw.phone) setPhone(raw.phone);
            if (raw.companyName && !companyName) setCompanyName(raw.companyName);
            if (raw.address && !address) setAddress(raw.address);
            if (raw.goodsType && !goodsType) setGoodsType(raw.goodsType);
        }
    };

    const handleCompanySelect = (item: SuggestionItem) => {
        const raw = item.raw;
        if (raw?.address) {
            setAddress(raw.address);
        }
        if (raw?.phone && !phone) {
            setPhone(raw.phone);
        }
    };

    const handleDriverSelect = (item: SuggestionItem) => {
        const raw = item.raw;
        if (raw?.phone) {
            setPhone(raw.phone);
        }
    };

    // Formatted suggestions for AutocompleteInput
    const vehicleSuggestions: SuggestionItem[] = suggestions.vehicles.map(v => ({
        label: v.vehicleNumber,
        value: v.vehicleNumber,
        sublabel: [v.driverName ? `Driver: ${v.driverName}` : '', v.companyName ? `Co: ${v.companyName}` : ''].filter(Boolean).join(' • '),
        raw: v
    }));

    const companySuggestions: SuggestionItem[] = suggestions.companies.map(c => ({
        label: c.name,
        value: c.name,
        sublabel: c.address || '',
        badge: c.source || '',
        raw: c
    }));

    const driverSuggestions: SuggestionItem[] = suggestions.drivers.map(d => ({
        label: d.name,
        value: d.name,
        sublabel: d.phone ? `Ph: ${d.phone}` : '',
        raw: d
    }));

    // Webcam
    const webcamRef = React.useRef<any>(null); // Type 'any' used to bypass strict ref typing issues with react-webcam
    const [captureMode, setCaptureMode] = useState<'document' | 'vehicle' | null>(null);
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

    // Capture Photo
    const capture = useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) {
            if (captureMode === 'document') setDocumentPhotos(prev => [...prev, imageSrc]);
            if (captureMode === 'vehicle') setVehiclePhotos(prev => [...prev, imageSrc]);
            setCaptureMode(null);
        }
    }, [webcamRef, captureMode]);


    // Submit Entry
    const handleCheckIn = async (e: React.FormEvent) => {
        e.preventDefault();
        const missingFields = [];
        if (!vehicleNumber) missingFields.push("Vehicle Number");
        if (!driverName) missingFields.push("Driver Name");
        if (!phone) missingFields.push("Phone Number");
        if (vehiclePhotos.length === 0) missingFields.push("Vehicle Photo");

        if (direction === 'Inward') {
            if (!companyName) missingFields.push("Origin Company");
            if (!goodsType) missingFields.push("Goods Type");
            // if (!documentType) missingFields.push("Document Type");
            // if (!documentNumber) missingFields.push("Document Number");
        }

        if (missingFields.length > 0) {
            alert(`Please fill the following required fields:\n- ${missingFields.join('\n- ')}`);
            return;
        }

        try {
            setEntryLoading(true);
            const token = localStorage.getItem('token');
            await axios.post(`${API_BASE_URL}/api/vehicle`, {
                driverName,
                phone,
                companyName,
                goodsType,
                address,
                vehicleNumber,
                direction,
                documentType,
                documentNumber,
                purpose: remarks || 'Logistics', // Default purpose if empty
                documentPhotos, 
                vehiclePhotos
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            alert("Vehicle Checked In Successfully!");
            // Reset form
            setDirection('Inward');
            setDriverName('');
            setCompanyName('');
            setPhone('');
            setGoodsType('');
            setAddress('');
            setVehicleNumber('');
            setRemarks('');
            setDocumentType('');
            setDocumentNumber('');
            setDocumentPhotos([]);
            setVehiclePhotos([]);
            setIsEntryModalOpen(false);

            // Refresh list
            loadVehicles();
        } catch (error) {
            console.error("Check-in failed", error);
            alert("Failed to check in vehicle.");
        } finally {
            setEntryLoading(false);
        }
    };

    // Load Vehicles (Visitors with vehicles)
    const loadVehicles = useCallback(async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            let url = `${API_BASE_URL}/api/vehicle/active`;
            let params = {};

            if (viewMode === 'history') {
                url = `${API_BASE_URL}/api/vehicle`; // Get all (filtered)
                
                if (historyFilterType === 'daywise') {
                    const start = new Date(historyDate);
                    start.setHours(0, 0, 0, 0);
                    const end = new Date(historyDate);
                    end.setHours(23, 59, 59, 999);
                    params = { start: start.toISOString(), end: end.toISOString() };
                } else {
                    const [year, month] = historyMonth.split('-');
                    const start = new Date(parseInt(year), parseInt(month) - 1, 1);
                    const end = new Date(parseInt(year), parseInt(month), 0); // Last day of month
                    end.setHours(23, 59, 59, 999);
                    params = { start: start.toISOString(), end: end.toISOString() };
                }
            }

            const res = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` },
                params
            });

            // Use vehicles array directly from response
            setVisitors(res.data.vehicles || []);
        } catch (error) {
            console.error("Load vehicles failed", error);
        } finally {
            setLoading(false);
        }
    }, [viewMode, historyDate, historyFilterType, historyMonth]);

    useEffect(() => {
        loadVehicles();
    }, [loadVehicles]);

    useEffect(() => {
        if (isEntryModalOpen || isCheckoutModalOpen || captureMode !== null || selectedVehicle !== null) {
            setShowBottomNav(false);
        } else {
            setShowBottomNav(true);
        }
        return () => setShowBottomNav(true);
    }, [isEntryModalOpen, isCheckoutModalOpen, captureMode, selectedVehicle, setShowBottomNav]);

    const handleCheckOut = async (vehicle: any) => {
        if (vehicle.direction === 'Outward') {
            setCheckoutVehicle(vehicle);
            setCompanyName('');
            setGoodsType('');
            setAddress('');
            setRemarks('');
            setDocumentType('');
            setDocumentNumber('');
            setDocumentPhotos([]);
            setVehiclePhotos([]);
            setIsCheckoutModalOpen(true);
            return;
        }

        if (!confirm("Confirm Check Out?")) return;
        executeCheckOut(vehicle._id);
    };

    const executeCheckOut = async (id: string, payload: any = {}) => {
        try {
            setCheckoutLoading(id);
            const token = localStorage.getItem('token');
            await axios.put(`${API_BASE_URL}/api/vehicle/${id}/checkout`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // If in active view, remove from list. If history, reload to update status.
            if (viewMode === 'active') {
                setVisitors(prev => prev.filter(v => v._id !== id));
            } else {
                loadVehicles();
            }
            if (isCheckoutModalOpen) setIsCheckoutModalOpen(false);
            setCheckoutVehicle(null);
        } catch (error) {
            console.error("Checkout failed", error);
            alert("Failed to check out.");
        } finally {
            setCheckoutLoading(null);
        }
    };

    const handleOutwardCheckoutSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const missingFields = [];
        if (!companyName) missingFields.push("Destination Company");
        if (!goodsType) missingFields.push("Goods Type");
        // if (!documentType) missingFields.push("Document Type");
        // if (!documentNumber) missingFields.push("Document Number");
        if (documentPhotos.length === 0) missingFields.push("Document Photo");

        if (missingFields.length > 0) {
            alert(`Please fill the following required fields:\n- ${missingFields.join('\n- ')}`);
            return;
        }

        executeCheckOut(checkoutVehicle._id, {
            companyName,
            goodsType,
            address,
            documentType,
            documentNumber,
            purpose: remarks || 'Logistics',
            documentPhotos,
            vehiclePhotos
        });
    };

    const filteredVehicles = visitors.filter(item => {
        const matchDir = (item.direction === directionTab || (!item.direction && directionTab === 'Inward'));
        
        const matchSearch = (item.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.companyName && item.companyName.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (item.documentNumber && item.documentNumber.toLowerCase().includes(searchTerm.toLowerCase())));
        
        if (!matchDir || !matchSearch) return false;

        return Object.entries(filters).every(([key, selectedValues]) => {
            if (selectedValues.length === 0) return true;
            
            let itemValue = '';
            if (key === 'company') {
                itemValue = item.companyName || '-';
            } else if (key === 'driverName') {
                itemValue = item.name || '-';
            } else if (key === 'docType') {
                itemValue = item.documentType || '-';
            } else if (key === 'docNo') {
                itemValue = item.documentNumber || '-';
            } else {
                itemValue = String(item[key] || '-');
            }
            
            return selectedValues.includes(itemValue);
        });
    });

    // Carousel state for selected vehicle
    const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
    const allPhotos = selectedVehicle ? [...(selectedVehicle.vehiclePhotos || []), ...(selectedVehicle.documentPhotos || [])] : [];

    const nextPhoto = () => {
        setCurrentPhotoIndex((prev) => (prev + 1) % allPhotos.length);
    };

    const prevPhoto = () => {
        setCurrentPhotoIndex((prev) => (prev - 1 + allPhotos.length) % allPhotos.length);
    };

    const downloadCurrentPhoto = () => {
        if (!allPhotos || allPhotos.length === 0) return;
        const currentSrc = allPhotos[currentPhotoIndex];
        const a = document.createElement('a');
        a.href = currentSrc;
        a.download = `vehicle_${selectedVehicle?.vehicleNumber}_photo_${currentPhotoIndex + 1}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const downloadPDF = (vehicle: any) => {
        import('jspdf').then(({ jsPDF }) => {
            const doc = new jsPDF();
            doc.setFontSize(20);
            doc.text(`Vehicle Entry Details: ${vehicle.vehicleNumber}`, 14, 22);

            doc.setFontSize(12);
            doc.text(`Status: ${vehicle.status}`, 14, 32);
            doc.text(`Direction: ${(vehicle.direction || 'Inward') === 'Inward' ? 'For Unloading' : 'For Loading'}`, 14, 40);

            import('jspdf-autotable').then(({ default: autoTable }) => {
                autoTable(doc, {
                    startY: 50,
                    head: [['Field', 'Value']],
                    body: [
                        ['Driver Name', vehicle.name || 'N/A'],
                        ['Phone', vehicle.phone || 'N/A'],
                        ['Company', vehicle.companyName || 'N/A'],
                        ['Goods Type', vehicle.goodsType || 'N/A'],
                        ['Document Type', vehicle.documentType || 'N/A'],
                        ['Document Number', vehicle.documentNumber || 'N/A'],
                        ['Purpose / Remarks', vehicle.purpose || 'N/A'],
                        ['Address', vehicle.address || 'N/A'],
                        ['Check-In Time', new Date(vehicle.checkInTime).toLocaleString()],
                        ['Check-Out Time', vehicle.checkOutTime ? new Date(vehicle.checkOutTime).toLocaleString() : 'N/A']
                    ],
                });
                doc.save(`${vehicle.vehicleNumber}-details.pdf`);
            });
        });
    };

    return (
        <div className="space-y-4 md:space-y-6 -mt-2 md:mt-0">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-slate-800 p-3 md:p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 gap-4">

                {/* Left: Title & Toggles */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full md:w-auto">
                    {/* Active / History Mode Toggle */}
                    <div className="flex bg-slate-100 dark:bg-slate-900/70 p-1 rounded-xl border border-gray-200/70 dark:border-slate-700/70 w-full md:w-auto">
                        <button
                            onClick={() => {
                                setViewMode('active');
                                router.push(directionTab === 'Inward' ? '/dashboard/gate-entry/vehicle/active/unloading' : '/dashboard/gate-entry/vehicle/active/loading');
                            }}
                            className={`flex-1 md:flex-none md:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold flex justify-center items-center gap-2 transition-all duration-200 ${
                                viewMode === 'active'
                                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-gray-200/50 dark:border-slate-700/80 font-bold'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/50'
                            }`}
                        >
                            <Activity size={15} /> Active
                        </button>
                        <button
                            onClick={() => {
                                setViewMode('history');
                                router.push(directionTab === 'Inward' ? '/dashboard/gate-entry/vehicle/history/unloading' : '/dashboard/gate-entry/vehicle/history/loading');
                            }}
                            className={`flex-1 md:flex-none md:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold flex justify-center items-center gap-2 transition-all duration-200 ${
                                viewMode === 'history'
                                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-gray-200/50 dark:border-slate-700/80 font-bold'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/50'
                            }`}
                        >
                            <History size={15} /> History
                        </button>
                    </div>

                    {/* Inward (Unloading) / Outward (Loading) Sub-tab Toggle */}
                    <div className="flex w-full md:w-auto bg-slate-100 dark:bg-slate-900/70 p-1 rounded-xl border border-gray-200/70 dark:border-slate-700/70">
                        <button
                            onClick={() => {
                                setDirectionTab('Inward');
                                router.push(viewMode === 'active' ? '/dashboard/gate-entry/vehicle/active/unloading' : '/dashboard/gate-entry/vehicle/history/unloading');
                            }}
                            className={`flex-1 md:flex-none md:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold flex justify-center items-center gap-2 transition-all duration-200 ${
                                directionTab === 'Inward'
                                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-gray-200/50 dark:border-slate-700/80 font-bold'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/50'
                            }`}
                        >
                            <ArrowDown size={15} /> For Unloading
                        </button>
                        <button
                            onClick={() => {
                                setDirectionTab('Outward');
                                router.push(viewMode === 'active' ? '/dashboard/gate-entry/vehicle/active/loading' : '/dashboard/gate-entry/vehicle/history/loading');
                            }}
                            className={`flex-1 md:flex-none md:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold flex justify-center items-center gap-2 transition-all duration-200 ${
                                directionTab === 'Outward'
                                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-gray-200/50 dark:border-slate-700/80 font-bold'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/50'
                            }`}
                        >
                            <ArrowUp size={15} /> For Loading
                        </button>
                    </div>
                </div>

                {/* Right: Controls & Search */}
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">

                    {viewMode === 'history' && (
                        <>
                            {/* Filter Type Toggle */}
                            <div className="bg-slate-100 dark:bg-slate-900/70 flex p-1 rounded-xl border border-gray-200/70 dark:border-slate-700/70">
                                <button
                                    onClick={() => setHistoryFilterType("monthwise")}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
                                        historyFilterType === "monthwise"
                                            ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-gray-200/50 dark:border-slate-700/80"
                                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/50"
                                    }`}
                                >
                                    Monthly
                                </button>
                                <button
                                    onClick={() => setHistoryFilterType("daywise")}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
                                        historyFilterType === "daywise"
                                            ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-gray-200/50 dark:border-slate-700/80"
                                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/50"
                                    }`}
                                >
                                    Daily
                                </button>
                            </div>

                            {/* Date/Month Picker */}
                            {historyFilterType === "monthwise" ? (
                                <input
                                    type="month"
                                    value={historyMonth}
                                    onChange={(e) => setHistoryMonth(e.target.value)}
                                    className="border border-gray-200 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 px-3 py-2 rounded-lg shadow-sm text-sm"
                                />
                            ) : (
                                <input
                                    type="date"
                                    value={historyDate}
                                    onChange={(e) => setHistoryDate(e.target.value)}
                                    className="border border-gray-200 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 px-3 py-2 rounded-lg shadow-sm text-sm"
                                />
                            )}
                        </>
                    )}

                    <div className="relative hidden md:block flex-1 md:flex-none">
                        <Search className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500" size={18} />
                        <input
                            type="text"
                            placeholder="Search vehicle..."
                            className="pl-10 pr-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none w-full md:w-64 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* New Entry Button */}
                    {viewMode === 'active' && (
                        <button
                            onClick={() => {
                                setDirection(directionTab);
                                setIsEntryModalOpen(true);
                            }}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors whitespace-nowrap shadow-sm hover:shadow-md"
                        >
                            <Truck size={18} /> New Vehicle
                        </button>
                    )}
                </div>
            </div>

            {/* Mobile View: Cards */}
            <div className="grid grid-cols-1 gap-4 animate-in fade-in md:hidden">
                {loading ? <div className="text-center py-12"><LoadingSpinner /></div> : filteredVehicles.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-dashed">
                        {searchTerm ? 'No vehicles found matching search.' : (viewMode === 'active' ? 'No active vehicles found inside.' : 'No vehicle history for this date.')}
                    </div>
                ) : (
                    filteredVehicles.map((v) => (
                        <div
                            key={v._id}
                            onClick={() => { setSelectedVehicle(v); setCurrentPhotoIndex(0); }}
                            className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border p-4 cursor-pointer hover:shadow-md transition-all group ${v.status === 'Left' ? 'border-gray-100 dark:border-slate-700 opacity-80' : 'border-blue-100 ring-1 ring-blue-50'}`}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="font-bold text-lg text-gray-900 dark:text-white font-mono tracking-tight line-clamp-1">{v.vehicleNumber}</h3>
                                    {v.companyName && (
                                        <div className="text-xs font-semibold text-blue-600 mt-0.5 flex items-center gap-1">
                                            <Building size={10} /> {v.companyName}
                                        </div>
                                    )}
                                </div>
                                <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${v.status === 'Inside' ? 'bg-green-100 text-green-700' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 '}`}>
                                    {v.status}
                                </div>
                            </div>

                            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400 ">
                                <div className="flex items-center gap-2 text-xs"><User size={12} className="text-gray-400" /> Driver: <span className="font-medium text-gray-900 dark:text-white ">{v.name}</span></div>
                                <div className="flex items-center gap-2 text-xs"><Activity size={12} className="text-gray-400" /> Type: <span className="font-medium text-gray-900 dark:text-white ">{v.goodsType || 'Logistics'}</span></div>
                                {v.documentType && v.documentNumber && (
                                    <div className="flex items-center gap-2 text-xs"><FileText size={12} className="text-gray-400" /> Doc: <span className="font-medium text-gray-900 dark:text-white uppercase">{v.documentType} - {v.documentNumber}</span></div>
                                )}
                                <div className="flex items-center justify-between text-xs text-gray-400 mt-2 pt-2 border-t border-gray-50 dark:border-slate-700">
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center gap-1.5">
                                            <History size={12} /> IN: {new Date(v.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        {v.createdBy && <div className="text-[10px] text-gray-400 ml-4">by {v.createdBy.name}</div>}
                                    </div>
                                    {v.checkOutTime && (
                                        <div className="flex flex-col gap-0.5 items-end text-orange-500">
                                            <div className="flex items-center gap-1.5">
                                                <LogOut size={12} /> OUT: {new Date(v.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                            {v.checkedOutBy && <div className="text-[10px] text-gray-400 mr-1">by {v.checkedOutBy.name}</div>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden md:block bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden animate-in fade-in">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600 dark:text-gray-400">
                        <thead className="bg-gray-50 dark:bg-slate-900/50 text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-slate-700">
                            <tr>
                                <th className="px-4 py-3 align-top">
                                    <ColumnFilter
                                        column="vehicleNumber"
                                        title="Vehicle No."
                                        data={visitors}
                                        currentFilters={filters['vehicleNumber'] || []}
                                        onFilterChange={(vals) => handleFilterChange('vehicleNumber', vals)}
                                    />
                                </th>
                                <th className="px-4 py-3 align-top">
                                    <ColumnFilter
                                        column="driverName"
                                        title="Driver Name"
                                        data={visitors}
                                        currentFilters={filters['driverName'] || []}
                                        onFilterChange={(vals) => handleFilterChange('driverName', vals)}
                                        getValue={(item) => item.name || '-'}
                                    />
                                </th>
                                <th className="px-4 py-3 align-top">
                                    <ColumnFilter
                                        column="company"
                                        title="Company"
                                        data={visitors}
                                        currentFilters={filters['company'] || []}
                                        onFilterChange={(vals) => handleFilterChange('company', vals)}
                                        getValue={(item) => item.companyName || '-'}
                                    />
                                </th>
                                <th className="px-4 py-3 align-top">
                                    <ColumnFilter
                                        column="goodsType"
                                        title="Goods Type"
                                        data={visitors}
                                        currentFilters={filters['goodsType'] || []}
                                        onFilterChange={(vals) => handleFilterChange('goodsType', vals)}
                                    />
                                </th>
                                <th className="px-4 py-3 align-top">
                                    <ColumnFilter
                                        column="docType"
                                        title="Doc Type"
                                        data={visitors}
                                        currentFilters={filters['docType'] || []}
                                        onFilterChange={(vals) => handleFilterChange('docType', vals)}
                                        getValue={(item) => item.documentType || '-'}
                                    />
                                </th>
                                <th className="px-4 py-3 align-top">
                                    <ColumnFilter
                                        column="docNo"
                                        title="Doc No"
                                        data={visitors}
                                        currentFilters={filters['docNo'] || []}
                                        onFilterChange={(vals) => handleFilterChange('docNo', vals)}
                                        getValue={(item) => item.documentNumber || '-'}
                                    />
                                </th>
                                <th className="px-4 py-3 align-top">
                                    <div className="font-bold mb-2">Check-In</div>
                                </th>
                                <th className="px-4 py-3 align-top">
                                    <div className="font-bold mb-2">Check-Out</div>
                                </th>
                                <th className="px-4 py-3 align-top">
                                    <ColumnFilter
                                        column="status"
                                        title="Status"
                                        data={visitors}
                                        currentFilters={filters['status'] || []}
                                        onFilterChange={(vals) => handleFilterChange('status', vals)}
                                    />
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-12"><LoadingSpinner /></td>
                                </tr>
                            ) : filteredVehicles.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-800/50 border-dashed">
                                        {searchTerm ? 'No vehicles found matching search.' : (viewMode === 'active' ? 'No active vehicles found inside.' : 'No vehicle history for this date.')}
                                    </td>
                                </tr>
                            ) : (
                                filteredVehicles.map((v) => (
                                    <tr 
                                        key={v._id} 
                                        onClick={() => { setSelectedVehicle(v); setCurrentPhotoIndex(0); }}
                                        className={`hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors ${v.status === 'Left' ? 'opacity-80' : ''}`}
                                    >
                                        <td className="px-4 py-3 font-bold font-mono text-gray-900 dark:text-white whitespace-nowrap">{v.vehicleNumber}</td>
                                        <td className="px-4 py-3">{v.name}</td>
                                        <td className="px-4 py-3">{v.companyName || '-'}</td>
                                        <td className="px-4 py-3">{v.goodsType || '-'}</td>
                                        <td className="px-4 py-3">
                                            {v.documentType ? (
                                                <span className="uppercase text-xs font-semibold">{v.documentType}</span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {v.documentNumber ? (
                                                <span className="uppercase text-xs font-semibold">{v.documentNumber}</span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="font-medium">{new Date(v.checkInTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</div>
                                            {v.createdBy && <div className="text-xs text-gray-500">by {v.createdBy.name}</div>}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-orange-500">
                                            {v.checkOutTime ? (
                                                <>
                                                    <div className="font-medium">{new Date(v.checkOutTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</div>
                                                    {v.checkedOutBy && <div className="text-xs text-gray-500">by {v.checkedOutBy.name}</div>}
                                                </>
                                            ) : '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${v.status === 'Inside' ? 'bg-green-100 text-green-700' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400'}`}>
                                                {v.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* New Vehicle Entry Modal */}
            {isEntryModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto border border-gray-100 dark:border-slate-700">
                        <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-slate-700 sticky top-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm z-10">
                            <div>
                                <div className="flex items-center gap-2.5">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">New Vehicle Entry</h3>
                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${direction === 'Inward' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'}`}>
                                        {direction === 'Inward' ? 'For Unloading' : 'For Loading'}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Enter consignment origin, vehicle, and driver details for gate check-in.</p>
                            </div>
                            <button onClick={() => setIsEntryModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors bg-gray-50 dark:bg-slate-700/60 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 md:p-8">
                            <form onSubmit={handleCheckIn} className="space-y-7">

                                {/* SECTION 1: ORIGIN & CONSIGNMENT DETAILS (Inward / Unloading) */}
                                {direction === 'Inward' && (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 pb-1 border-b border-gray-100 dark:border-slate-700/60">
                                            <Building size={16} className="text-indigo-600 dark:text-indigo-400" />
                                            <h4 className="text-xs font-bold text-gray-700 dark:text-gray-200 tracking-wider uppercase">
                                                1. Origin & Consignment Information
                                            </h4>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                            {/* Origin Company */}
                                            <div className="md:col-span-1 lg:col-span-1">
                                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1.5">
                                                    Origin Company <span className="text-red-500">*</span>
                                                </label>
                                                <AutocompleteInput
                                                    value={companyName}
                                                    onChange={setCompanyName}
                                                    onSelect={handleCompanySelect}
                                                    suggestions={companySuggestions}
                                                    placeholder="Search or enter vendor/company name..."
                                                    required
                                                    icon={<Building size={16} />}
                                                />
                                            </div>

                                            {/* Address */}
                                            <div className="md:col-span-1 lg:col-span-2">
                                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1.5">
                                                    Origin Address
                                                </label>
                                                <div className="relative">
                                                    <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                                    <input
                                                        type="text"
                                                        value={address}
                                                        onChange={e => setAddress(e.target.value)}
                                                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400 text-sm"
                                                        placeholder="e.g. Plot No. 12, Industrial Area, Bangalore"
                                                    />
                                                </div>
                                            </div>

                                            {/* Purpose / Remarks */}
                                            <div className="md:col-span-2 lg:col-span-3">
                                                <div className="flex justify-between items-center mb-1.5">
                                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                                                        Purpose / Movement Reason
                                                    </label>
                                                    <div className="hidden md:flex flex-wrap items-center gap-1.5">
                                                        <span className="text-[11px] text-gray-400 flex items-center gap-1">
                                                            <Sparkles size={11} className="text-amber-500" /> Quick:
                                                        </span>
                                                        {suggestions.purposes.slice(0, 5).map((p) => (
                                                            <button
                                                                key={p}
                                                                type="button"
                                                                onClick={() => setRemarks(p)}
                                                                className={`px-2 py-0.5 text-[11px] rounded-md transition-all ${remarks === p ? 'bg-indigo-600 text-white font-semibold' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'}`}
                                                            >
                                                                {p}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <input
                                                    type="text"
                                                    value={remarks}
                                                    onChange={e => setRemarks(e.target.value)}
                                                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400 text-sm"
                                                    placeholder="e.g. Delivery for Block A, RM Inward PO#8892"
                                                />
                                            </div>

                                            {/* Goods Type */}
                                            <div className="md:col-span-2 lg:col-span-3">
                                                <div className="flex justify-between items-center mb-1.5">
                                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                                                        Goods Type <span className="text-red-500">*</span>
                                                    </label>
                                                    <div className="hidden md:flex flex-wrap items-center gap-1.5">
                                                        {['RM', 'Bought Out', 'FG', 'Machinery / Tools', 'Job Work Material', 'Scrap'].map((gt) => (
                                                            <button
                                                                key={gt}
                                                                type="button"
                                                                onClick={() => setGoodsType(gt)}
                                                                className={`px-2.5 py-0.5 text-xs font-semibold rounded-md transition-all ${goodsType === gt ? 'bg-indigo-600 text-white shadow-sm' : 'bg-indigo-50 dark:bg-slate-700/70 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-slate-700'}`}
                                                            >
                                                                {gt}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <AutocompleteInput
                                                    value={goodsType}
                                                    onChange={setGoodsType}
                                                    suggestions={suggestions.goodsTypes}
                                                    placeholder="Select from suggestions or type custom goods type (e.g. RM, Bought Out, FG)..."
                                                    required
                                                    icon={<Activity size={16} />}
                                                />
                                            </div>

                                            {/* Document Type */}
                                            <div className="md:col-span-1 lg:col-span-1">
                                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1.5">
                                                    Document Type
                                                </label>
                                                <select
                                                    value={documentType}
                                                    onChange={e => setDocumentType(e.target.value)}
                                                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
                                                >
                                                    <option value="">None / Not Applicable</option>
                                                    <option value="dc">Delivery Challan (DC)</option>
                                                    <option value="invoice">Tax Invoice</option>
                                                    <option value="eway_bill">E-Way Bill</option>
                                                    <option value="bill_of_supply">Bill of Supply</option>
                                                    <option value="other">Other Document</option>
                                                </select>
                                            </div>

                                            {/* Document Number */}
                                            <div className="md:col-span-1 lg:col-span-2">
                                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1.5">
                                                    Document Number
                                                </label>
                                                <div className="relative">
                                                    <FileText size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                                    <input
                                                        type="text"
                                                        value={documentNumber}
                                                        onChange={e => setDocumentNumber(e.target.value)}
                                                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400 uppercase text-sm"
                                                        placeholder="e.g. DC-2026-0819 or INV-0921"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* SECTION 2: VEHICLE & DRIVER DETAILS */}
                                <div className="space-y-4 pt-2">
                                    <div className="flex items-center gap-2 pb-1 border-b border-gray-100 dark:border-slate-700/60">
                                        <Truck size={16} className="text-indigo-600 dark:text-indigo-400" />
                                        <h4 className="text-xs font-bold text-gray-700 dark:text-gray-200 tracking-wider uppercase">
                                            2. Vehicle & Driver Details
                                        </h4>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                        {/* Vehicle Number */}
                                        <div className="md:col-span-1">
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1.5">
                                                Vehicle Number <span className="text-red-500">*</span>
                                            </label>
                                            <AutocompleteInput
                                                value={vehicleNumber}
                                                onChange={setVehicleNumber}
                                                onSelect={handleVehicleSelect}
                                                suggestions={vehicleSuggestions}
                                                placeholder="KA-01-AB-1234"
                                                required
                                                transformValue={v => v.toUpperCase()}
                                                icon={<Truck size={16} />}
                                            />
                                        </div>

                                        {/* Driver Name */}
                                        <div className="md:col-span-1">
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1.5">
                                                Driver Name <span className="text-red-500">*</span>
                                            </label>
                                            <AutocompleteInput
                                                value={driverName}
                                                onChange={setDriverName}
                                                onSelect={handleDriverSelect}
                                                suggestions={driverSuggestions}
                                                placeholder="e.g. Ramesh Kumar"
                                                required
                                                icon={<User size={16} />}
                                            />
                                        </div>

                                        {/* Phone Number */}
                                        <div className="md:col-span-1">
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1.5">
                                                Phone Number <span className="text-red-500">*</span>
                                            </label>
                                            <div className="relative">
                                                <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                                <input
                                                    type="tel"
                                                    value={phone}
                                                    onChange={e => setPhone(e.target.value)}
                                                    required
                                                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400 text-sm"
                                                    placeholder="9876543210"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* SECTION 3: VERIFICATION PHOTOS */}
                                <div className="space-y-4 pt-2">
                                    <div className="flex items-center gap-2 pb-1 border-b border-gray-100 dark:border-slate-700/60">
                                        <Camera size={16} className="text-indigo-600 dark:text-indigo-400" />
                                        <h4 className="text-xs font-bold text-gray-700 dark:text-gray-200 tracking-wider uppercase">
                                            3. Verification Photos
                                        </h4>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Vehicle Photos */}
                                        <div className="p-4 bg-gray-50 dark:bg-slate-700/30 rounded-xl border border-gray-200 dark:border-slate-700">
                                            <div className="flex items-center justify-between mb-3">
                                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                                                    Vehicle Photo <span className="text-red-500">*</span>
                                                </label>
                                                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                                    {vehiclePhotos.length} photo(s) added
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-2.5">
                                                {vehiclePhotos.map((photo, index) => (
                                                    <div key={index} className="relative group w-20 h-20 bg-gray-100 dark:bg-slate-700 rounded-lg overflow-hidden border border-gray-300 dark:border-slate-600 shrink-0">
                                                        <img src={photo} alt={`Vehicle ${index + 1}`} className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <button type="button" onClick={() => setVehiclePhotos(prev => prev.filter((_, i) => i !== index))} className="bg-red-500 text-white p-1 rounded-md text-xs font-bold shadow hover:bg-red-600 transition-colors">
                                                                <X size={13} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                                <button
                                                    type="button"
                                                    onClick={() => setCaptureMode('vehicle')}
                                                    className="w-20 h-20 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-all shrink-0"
                                                >
                                                    <Camera size={18} className="mb-1" />
                                                    <span className="text-[10px] font-semibold">Camera</span>
                                                </button>
                                                <label className="w-20 h-20 cursor-pointer border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-700 transition-all shrink-0">
                                                    <Upload size={18} className="mb-1" />
                                                    <span className="text-[10px] font-semibold">Upload</span>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        multiple
                                                        className="hidden"
                                                        onChange={(e) => {
                                                            if (e.target.files) {
                                                                Array.from(e.target.files).forEach(file => {
                                                                    const reader = new FileReader();
                                                                    reader.onloadend = () => {
                                                                        setVehiclePhotos(prev => [...prev, reader.result as string]);
                                                                    };
                                                                    reader.readAsDataURL(file);
                                                                });
                                                            }
                                                        }}
                                                    />
                                                </label>
                                            </div>
                                        </div>

                                        {/* Document Photos */}
                                        {direction === 'Inward' && (
                                            <div className="p-4 bg-gray-50 dark:bg-slate-700/30 rounded-xl border border-gray-200 dark:border-slate-700">
                                                <div className="flex items-center justify-between mb-3">
                                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                                                        Document Photo (Optional)
                                                    </label>
                                                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                                        {documentPhotos.length} photo(s) added
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap gap-2.5">
                                                    {documentPhotos.map((photo, index) => (
                                                        <div key={index} className="relative group w-20 h-20 bg-gray-100 dark:bg-slate-700 rounded-lg overflow-hidden border border-gray-300 dark:border-slate-600 shrink-0">
                                                            <img src={photo} alt={`Document ${index + 1}`} className="w-full h-full object-cover" />
                                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                <button type="button" onClick={() => setDocumentPhotos(prev => prev.filter((_, i) => i !== index))} className="bg-red-500 text-white p-1 rounded-md text-xs font-bold shadow hover:bg-red-600 transition-colors">
                                                                    <X size={13} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <button
                                                        type="button"
                                                        onClick={() => setCaptureMode('document')}
                                                        className="w-20 h-20 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-all shrink-0"
                                                    >
                                                        <Camera size={18} className="mb-1" />
                                                        <span className="text-[10px] font-semibold">Camera</span>
                                                    </button>
                                                    <label className="w-20 h-20 cursor-pointer border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-700 transition-all shrink-0">
                                                        <Upload size={18} className="mb-1" />
                                                        <span className="text-[10px] font-semibold">Upload</span>
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            multiple
                                                            className="hidden"
                                                            onChange={(e) => {
                                                                if (e.target.files) {
                                                                    Array.from(e.target.files).forEach(file => {
                                                                        const reader = new FileReader();
                                                                        reader.onloadend = () => {
                                                                            setDocumentPhotos(prev => [...prev, reader.result as string]);
                                                                        };
                                                                        reader.readAsDataURL(file);
                                                                    });
                                                                }
                                                            }}
                                                        />
                                                    </label>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="pt-5 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-3 sticky bottom-0 bg-white dark:bg-slate-800 p-4 -mx-6 -mb-6 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] rounded-b-2xl">
                                    <button type="button" onClick={() => setIsEntryModalOpen(false)} className="px-6 py-2.5 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={entryLoading}
                                        className="px-8 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 hover:shadow-indigo-500/30 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {entryLoading ? <LoadingSpinner /> : <Truck size={18} />} Check-In Vehicle
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}


            {/* Outward Check-Out Modal */}
            {isCheckoutModalOpen && checkoutVehicle && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white dark:bg-slate-800 z-10">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white ">Outward Check-Out</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 ">Provide final details before vehicle departure.</p>
                            </div>
                            <button onClick={() => { setIsCheckoutModalOpen(false); setCheckoutVehicle(null); }} className="text-gray-400 hover:text-gray-600 dark:text-gray-400 transition-colors bg-gray-50 dark:bg-slate-800 /50 p-2 rounded-full hover:bg-gray-100 dark:bg-slate-700">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 md:p-8">
                            <form onSubmit={handleOutwardCheckoutSubmit} className="space-y-7">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 pb-1 border-b border-gray-100 dark:border-slate-700/60">
                                        <Building size={16} className="text-indigo-600 dark:text-indigo-400" />
                                        <h4 className="text-xs font-bold text-gray-700 dark:text-gray-200 tracking-wider uppercase">
                                            Departure Details & Consignment Info
                                        </h4>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                        {/* Destination Company */}
                                        <div className="md:col-span-1 lg:col-span-1">
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1.5">
                                                Destination Company <span className="text-red-500">*</span>
                                            </label>
                                            <AutocompleteInput
                                                value={companyName}
                                                onChange={setCompanyName}
                                                onSelect={handleCompanySelect}
                                                suggestions={companySuggestions}
                                                placeholder="e.g. Client / Customer Name"
                                                required
                                                icon={<Building size={16} />}
                                            />
                                        </div>

                                        {/* Destination Address */}
                                        <div className="md:col-span-1 lg:col-span-2">
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1.5">
                                                Destination Address
                                            </label>
                                            <div className="relative">
                                                <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                                <input
                                                    type="text"
                                                    value={address}
                                                    onChange={e => setAddress(e.target.value)}
                                                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400 text-sm"
                                                    placeholder="Where is the vehicle going?"
                                                />
                                            </div>
                                        </div>

                                        {/* Goods Type */}
                                        <div className="md:col-span-2 lg:col-span-3">
                                            <div className="flex justify-between items-center mb-1.5">
                                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                                                    Goods Type <span className="text-red-500">*</span>
                                                </label>
                                                <div className="hidden md:flex flex-wrap items-center gap-1.5">
                                                    {['FG', 'Job Work Material', 'Machinery / Tools', 'RM Return', 'Scrap'].map((gt) => (
                                                        <button
                                                            key={gt}
                                                            type="button"
                                                            onClick={() => setGoodsType(gt)}
                                                            className={`px-2.5 py-0.5 text-xs font-semibold rounded-md transition-all ${goodsType === gt ? 'bg-indigo-600 text-white shadow-sm' : 'bg-indigo-50 dark:bg-slate-700/70 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-slate-700'}`}
                                                        >
                                                            {gt}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <AutocompleteInput
                                                value={goodsType}
                                                onChange={setGoodsType}
                                                suggestions={suggestions.goodsTypes}
                                                placeholder="e.g. Finished Goods, Machinery..."
                                                required
                                                icon={<Activity size={16} />}
                                            />
                                        </div>

                                        {/* Document Type */}
                                        <div className="md:col-span-1 lg:col-span-1">
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1.5">
                                                Document Type
                                            </label>
                                            <select
                                                value={documentType}
                                                onChange={e => setDocumentType(e.target.value)}
                                                className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
                                            >
                                                <option value="">None / Not Applicable</option>
                                                <option value="dc">Delivery Challan (DC)</option>
                                                <option value="invoice">Tax Invoice</option>
                                                <option value="eway_bill">E-Way Bill</option>
                                                <option value="bill_of_supply">Bill of Supply</option>
                                                <option value="other">Other Document</option>
                                            </select>
                                        </div>

                                        {/* Document Number */}
                                        <div className="md:col-span-1 lg:col-span-2">
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1.5">
                                                Document Number
                                            </label>
                                            <div className="relative">
                                                <FileText size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                                <input
                                                    type="text"
                                                    value={documentNumber}
                                                    onChange={e => setDocumentNumber(e.target.value)}
                                                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400 uppercase text-sm"
                                                    placeholder="Doc #..."
                                                />
                                            </div>
                                        </div>

                                        {/* Purpose / Remarks */}
                                        <div className="md:col-span-2 lg:col-span-3">
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1.5">
                                                Remarks / Movement Reason
                                            </label>
                                            <input
                                                type="text"
                                                value={remarks}
                                                onChange={e => setRemarks(e.target.value)}
                                                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400 text-sm"
                                                placeholder="e.g. Sales Dispatch, Job Work Send..."
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Photos */}
                                <div className="space-y-4 pt-2">
                                    <div className="flex items-center gap-2 pb-1 border-b border-gray-100 dark:border-slate-700/60">
                                        <Camera size={16} className="text-indigo-600 dark:text-indigo-400" />
                                        <h4 className="text-xs font-bold text-gray-700 dark:text-gray-200 tracking-wider uppercase">
                                            Departure Document Photos
                                        </h4>
                                    </div>
                                    <div className="p-4 bg-gray-50 dark:bg-slate-700/30 rounded-xl border border-gray-200 dark:border-slate-700">
                                        <div className="flex items-center justify-between mb-3">
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                                                Document Photo <span className="text-red-500">*</span>
                                            </label>
                                            <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                                {documentPhotos.length} photo(s) added
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-2.5">
                                            {documentPhotos.map((photo, index) => (
                                                <div key={index} className="relative group w-20 h-20 bg-gray-100 dark:bg-slate-700 rounded-lg overflow-hidden border border-gray-300 dark:border-slate-600 shrink-0">
                                                    <img src={photo} alt={`Document ${index + 1}`} className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <button type="button" onClick={() => setDocumentPhotos(prev => prev.filter((_, i) => i !== index))} className="bg-red-500 text-white p-1 rounded-md text-xs font-bold shadow hover:bg-red-600 transition-colors">
                                                            <X size={13} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => setCaptureMode('document')}
                                                className="w-20 h-20 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-all shrink-0"
                                            >
                                                <Camera size={18} className="mb-1" />
                                                <span className="text-[10px] font-semibold">Camera</span>
                                            </button>
                                            <label className="w-20 h-20 cursor-pointer border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-700 transition-all shrink-0">
                                                <Upload size={18} className="mb-1" />
                                                <span className="text-[10px] font-semibold">Upload</span>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    multiple
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        if (e.target.files) {
                                                            Array.from(e.target.files).forEach(file => {
                                                                const reader = new FileReader();
                                                                reader.onloadend = () => {
                                                                    setDocumentPhotos(prev => [...prev, reader.result as string]);
                                                                };
                                                                reader.readAsDataURL(file);
                                                            });
                                                        }
                                                    }}
                                                />
                                            </label>
                                        </div>
                                    </div>
                                </div>


                                <div className="pt-6 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-3 sticky bottom-0 bg-white dark:bg-slate-800 p-4 -mx-6 -mb-6 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] rounded-b-2xl">
                                    <button type="button" onClick={() => { setIsCheckoutModalOpen(false); setCheckoutVehicle(null); }} className="px-6 py-2.5 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-100 dark:bg-slate-700 rounded-xl transition-colors">
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!!checkoutLoading}
                                        className="px-8 py-2.5 bg-red-600 text-white font-bold rounded-xl shadow-lg hover:bg-red-700 hover:shadow-red-500/30 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {!!checkoutLoading ? <LoadingSpinner /> : <LogOut size={18} />} Check-Out & Left
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Webcam Modal (Overlay on top of Entry Modal) */}
            {captureMode && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-2xl w-full max-w-lg border border-gray-800 flex flex-col">
                        
                        {/* Modal Header with Switch Button */}
                        <div className="p-4 bg-gray-900 border-b border-gray-800 flex justify-between items-center">
                            <div className="flex items-center gap-2 text-white font-bold text-sm">
                                <Camera size={18} className="text-blue-400" />
                                <span>Capture {captureMode === 'document' ? 'Document Photo' : 'Vehicle Photo'}</span>
                            </div>

                            {/* Camera Toggle Button (Front / Back) */}
                            <button
                                type="button"
                                onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
                                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-blue-400 hover:text-blue-300 rounded-xl text-xs font-bold border border-gray-700 flex items-center gap-1.5 transition-colors active:scale-95"
                                title="Switch between Front and Back camera"
                            >
                                <RotateCcw size={14} />
                                <span>{facingMode === 'user' ? 'Front (Selfie)' : 'Back (Rear)'}</span>
                            </button>
                        </div>

                        {/* Camera Stream Viewport */}
                        <div className="relative bg-black h-[400px] flex items-center justify-center overflow-hidden">
                            <Webcam
                                key={facingMode}
                                audio={false}
                                ref={webcamRef}
                                screenshotFormat="image/jpeg"
                                videoConstraints={{ facingMode: { ideal: facingMode } }}
                                onUserMediaError={(err) => alert("Could not access camera. Please check permissions.")}
                                className="absolute inset-0 w-full h-full object-cover"
                            />
                            {/* Camera Frame Overlay */}
                            <div className="absolute inset-0 border-[40px] border-black/50 pointer-events-none"></div>
                            <div className="absolute inset-10 border-2 border-white/30 rounded-lg pointer-events-none"></div>
                            
                            {/* Floating Camera Flip Icon */}
                            <div className="absolute top-4 right-4 z-10">
                                <button
                                    type="button"
                                    onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
                                    className="p-2.5 bg-black/60 hover:bg-black/80 text-white rounded-full backdrop-blur-md border border-white/30 shadow-lg active:scale-90 transition-transform flex items-center gap-1.5 text-xs font-bold"
                                    title="Flip Camera"
                                >
                                    <RotateCcw size={16} />
                                </button>
                            </div>

                            <div className="absolute bottom-4 left-0 right-0 text-center text-white/80 text-xs font-medium bg-black/50 py-1.5 backdrop-blur-xs">
                                Camera: <strong className="text-white">{facingMode === 'user' ? 'Front / Selfie' : 'Back / Rear'}</strong> • Align within frame
                            </div>
                        </div>

                        {/* Modal Footer Controls */}
                        <div className="p-4 sm:p-6 flex justify-between items-center bg-gray-900 border-t border-gray-800 gap-3">
                            <button 
                                type="button" 
                                onClick={() => setCaptureMode(null)} 
                                className="px-6 py-2.5 text-gray-300 font-bold hover:text-white transition-colors text-sm"
                            >
                                Cancel
                            </button>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
                                    className="sm:hidden p-2.5 bg-gray-800 hover:bg-gray-700 text-blue-400 rounded-xl border border-gray-700"
                                    title="Flip Camera"
                                >
                                    <RotateCcw size={18} />
                                </button>
                                <button 
                                    type="button" 
                                    onClick={capture} 
                                    className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-blue-500/30 flex items-center gap-2 text-sm"
                                >
                                    <Camera size={18} /> Capture Photo
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Vehicle Details Modal */}
            {selectedVehicle && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md md:max-w-4xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
                        {/* Photo Slider Header */}
                        <div className="relative h-64 md:h-auto md:w-1/2 bg-gray-900 border-b md:border-b-0 md:border-r border-gray-100 dark:border-slate-700 flex items-center justify-center group overflow-hidden">
                            {allPhotos.length > 0 ? (
                                <>
                                    <img src={allPhotos[currentPhotoIndex]} alt="Vehicle Preview" className="w-full h-full object-cover transition-opacity duration-300" />
                                    
                                    {allPhotos.length > 1 && (
                                        <>
                                            <button onClick={prevPhoto} className="absolute left-4 bg-black/50 hover:bg-black/80 text-white p-2 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all z-10">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                            </button>
                                            <button onClick={nextPhoto} className="absolute right-4 bg-black/50 hover:bg-black/80 text-white p-2 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all z-10">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                            </button>
                                            
                                            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-1.5 z-10">
                                                {allPhotos.map((_, idx) => (
                                                    <div key={idx} className={`w-2 h-2 rounded-full ${idx === currentPhotoIndex ? 'bg-white' : 'bg-white/40'}`}></div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </>
                            ) : (
                                <img src="/placeholder-vehicle.jpg" alt="Placeholder" className="w-full h-full object-cover" />
                            )}
                            
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none"></div>
                            <button onClick={() => setSelectedVehicle(null)} className="absolute top-4 right-4 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full backdrop-blur-sm transition-all focus:outline-none z-20">
                                <X size={20} />
                            </button>
                            
                            {allPhotos.length > 0 && (
                                <button onClick={downloadCurrentPhoto} className="absolute top-4 left-4 bg-black/50 hover:bg-black/80 text-white px-3 py-1.5 rounded-lg backdrop-blur-sm transition-all flex items-center gap-2 text-xs font-bold z-20">
                                    <Download size={14} /> Download Photo
                                </button>
                            )}

                            <div className="absolute bottom-0 left-0 right-0 p-6 text-white text-left z-20 pointer-events-none">
                                <h2 className="text-2xl font-bold font-mono uppercase tracking-tight">{selectedVehicle.vehicleNumber}</h2>
                                {selectedVehicle.companyName && <p className="text-white/80 font-medium flex items-center gap-2"><Building size={14} /> {selectedVehicle.companyName}</p>}
                                <p className="text-indigo-300 font-bold text-xs uppercase tracking-wider mt-1">{(selectedVehicle.direction || 'Inward') === 'Inward' ? 'For Unloading' : 'For Loading'}</p>
                            </div>
                        </div>

                        {/* Details Body */}
                        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-left md:w-1/2">
                            {/* Check-In Status */}
                            <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-800 /50 p-3 rounded-xl border border-gray-100 dark:border-slate-700 ">
                                <div className="text-left">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Status</p>
                                    <p className={`font-bold ${selectedVehicle.status === 'Inside' ? 'text-green-600' : 'text-gray-600 dark:text-gray-400 '}`}>{selectedVehicle.status}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Check-In Time</p>
                                    <p className="text-gray-900 dark:text-white font-mono tracking-tight">{new Date(selectedVehicle.checkInTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
                                </div>
                            </div>

                            {/* Info Grid */}
                            <div className="grid grid-cols-2 gap-y-4 text-sm">
                                <div className="text-left">
                                    <p className="text-gray-500 dark:text-gray-400 text-xs uppercase font-bold text-gray-400 mb-0.5">Driver Name</p>
                                    <p className="font-semibold text-gray-900 dark:text-white ">{selectedVehicle.name}</p>
                                </div>
                                <div className="text-left">
                                    <p className="text-gray-500 dark:text-gray-400 text-xs uppercase font-bold text-gray-400 mb-0.5">Phone</p>
                                    <p className="font-semibold text-gray-900 dark:text-white ">{selectedVehicle.phone}</p>
                                </div>
                                <div className="col-span-2 text-left">
                                    <p className="text-gray-500 dark:text-gray-400 text-xs uppercase font-bold text-gray-400 mb-0.5">Goods Type</p>
                                    <p className="font-semibold text-gray-900 dark:text-white ">{selectedVehicle.goodsType || 'N/A'}</p>
                                </div>
                                <div className="text-left">
                                    <p className="text-gray-500 dark:text-gray-400 text-xs uppercase font-bold text-gray-400 mb-0.5">Document Type</p>
                                    <p className="font-semibold text-gray-900 dark:text-white uppercase">{selectedVehicle.documentType || 'N/A'}</p>
                                </div>
                                <div className="text-left">
                                    <p className="text-gray-500 dark:text-gray-400 text-xs uppercase font-bold text-gray-400 mb-0.5">Document No.</p>
                                    <p className="font-semibold text-gray-900 dark:text-white uppercase">{selectedVehicle.documentNumber || 'N/A'}</p>
                                </div>
                                <div className="col-span-2 text-left">
                                    <p className="text-gray-500 dark:text-gray-400 text-xs uppercase font-bold text-gray-400 mb-0.5">Remarks / Purpose</p>
                                    <p className="font-semibold text-gray-900 dark:text-white ">{selectedVehicle.purpose}</p>
                                </div>
                                <div className="col-span-2 text-left">
                                    <p className="text-gray-500 dark:text-gray-400 text-xs uppercase font-bold text-gray-400 mb-0.5">Address</p>
                                    <p className="font-semibold text-gray-900 dark:text-white ">{selectedVehicle.address || 'N/A'}</p>
                                </div>
                            </div>

                            {/* Removed static Additional Photos Gallery in favor of the new Photo Carousel Slider */}

                            {/* Actions */}
                            <div className="flex gap-3 mt-2">
                                <button
                                    onClick={() => downloadPDF(selectedVehicle)}
                                    className="flex-1 py-3 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold rounded-xl hover:bg-indigo-200 dark:hover:bg-indigo-900/60 transition-all flex items-center justify-center gap-2"
                                >
                                    <FileText size={18} /> Download PDF
                                </button>
                                {selectedVehicle.status === 'Inside' ? (
                                    <button
                                        onClick={() => {
                                            handleCheckOut(selectedVehicle);
                                            setSelectedVehicle(null);
                                        }}
                                        disabled={!!checkoutLoading}
                                        className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-500/30 transition-all flex items-center justify-center gap-2"
                                    >
                                        {checkoutLoading === selectedVehicle._id ? <LoadingSpinner /> : <LogOut size={18} />} Check Out
                                    </button>
                                ) : (
                                    selectedVehicle.checkOutTime && (
                                        <div className="flex-1 text-center py-3 bg-gray-100 dark:bg-slate-700 rounded-xl text-gray-500 dark:text-gray-400 font-medium text-sm border border-gray-200 dark:border-slate-700 flex items-center justify-center">
                                            Checked Out: {new Date(selectedVehicle.checkOutTime).toLocaleString()}
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div >
    );
}
