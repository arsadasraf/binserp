"use client";

import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import { Camera, RefreshCw, LogOut, Search, User, Truck, Clock, Save, X } from 'lucide-react';
import { API_BASE_URL } from '@/src/utils/config';
import LoadingSpinner from '@/src/components/LoadingSpinner';

export default function GateEntryTab() {
    const [activeTab, setActiveTab] = useState<'entry' | 'list'>('entry');
    const [loading, setLoading] = useState(false);

    // --- Entry Form State ---
    const [visitorName, setVisitorName] = useState('');
    const [phone, setPhone] = useState('');
    const [purpose, setPurpose] = useState('');
    const [vehicleNumber, setVehicleNumber] = useState('');

    // Photos
    const [visitorPhoto, setVisitorPhoto] = useState<string | null>(null);
    const [vehiclePhoto, setVehiclePhoto] = useState<string | null>(null);

    // Webcam
    const webcamRef = useRef<Webcam>(null);
    const [captureMode, setCaptureMode] = useState<'visitor' | 'vehicle' | null>(null);

    // --- List State ---
    const [visitors, setVisitors] = useState<any[]>([]);
    const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

    // Capture Photo
    const capture = useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) {
            if (captureMode === 'visitor') setVisitorPhoto(imageSrc);
            if (captureMode === 'vehicle') setVehiclePhoto(imageSrc);
            setCaptureMode(null); // Close camera modal
        }
    }, [webcamRef, captureMode]);

    // Submit Entry
    const handleCheckIn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!visitorName || !phone || !visitorPhoto) {
            alert("Name, Phone and Visitor Photo are required!");
            return;
        }

        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            await axios.post(`${API_BASE_URL}/api/visitor`, {
                name: visitorName,
                phone,
                purpose,
                vehicleNumber,
                visitorPhoto,
                vehiclePhoto
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            alert("Visitor Checked In Successfully!");
            // Reset form
            setVisitorName('');
            setPhone('');
            setPurpose('');
            setVehicleNumber('');
            setVisitorPhoto(null);
            setVehiclePhoto(null);

            // If we go to list, refresh it
            loadActiveVisitors();
        } catch (error) {
            console.error("Check-in failed", error);
            alert("Failed to check in visitor.");
        } finally {
            setLoading(false);
        }
    };

    // Load Active Visitors
    const loadActiveVisitors = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE_URL}/api/visitor/active`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setVisitors(res.data.visitors);
        } catch (error) {
            console.error("Load visitors failed", error);
        } finally {
            setLoading(false);
        }
    };

    // Switch Tabs
    const switchTab = (tab: 'entry' | 'list') => {
        setActiveTab(tab);
        if (tab === 'list') {
            loadActiveVisitors();
        }
    };

    // Checkout
    const handleCheckOut = async (id: string) => {
        if (!confirm("Confirm Check Out?")) return;
        try {
            setCheckoutLoading(id);
            const token = localStorage.getItem('token');
            await axios.put(`${API_BASE_URL}/api/visitor/${id}/checkout`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Remove from local list
            setVisitors(prev => prev.filter(v => v._id !== id));
        } catch (error) {
            console.error("Checkout failed", error);
            alert("Failed to check out.");
        } finally {
            setCheckoutLoading(null);
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Gate Entry System</h2>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => switchTab('entry')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'entry' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        New Entry
                    </button>
                    <button
                        onClick={() => switchTab('list')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Active Visitors
                    </button>
                </div>
            </div>

            {activeTab === 'entry' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-w-4xl mx-auto animate-in fade-in">
                    <form onSubmit={handleCheckIn} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            {/* Personal Info */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                                    <User size={18} /> Visitor Details
                                </h3>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                                    <input required type="text" value={visitorName} onChange={e => setVisitorName(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="John Doe" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                                    <input required type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="9876543210" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Purpose/To Meet</label>
                                    <input type="text" value={purpose} onChange={e => setPurpose(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Interview / Meeting / Delivery" />
                                </div>
                            </div>

                            {/* Vehicle & Photos */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                                    <Truck size={18} /> Vehicle & Photos
                                </h3>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Number (Optional)</label>
                                    <input type="text" value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="KA-01-AB-1234" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {/* Visitor Photo */}
                                    <div className="space-y-2">
                                        <label className="block text-xs font-semibold text-gray-500 uppercase">Visitor Photo *</label>
                                        {visitorPhoto ? (
                                            <div className="relative group">
                                                <img src={visitorPhoto} alt="Visitor" className="w-full h-32 object-cover rounded-lg border" />
                                                <button type="button" onClick={() => setVisitorPhoto(null)} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button type="button" onClick={() => setCaptureMode('visitor')} className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-colors bg-gray-50">
                                                <Camera size={24} />
                                                <span className="text-xs mt-1">Take Photo</span>
                                            </button>
                                        )}
                                    </div>

                                    {/* Vehicle Photo */}
                                    <div className="space-y-2">
                                        <label className="block text-xs font-semibold text-gray-500 uppercase">Vehicle Photo</label>
                                        {vehiclePhoto ? (
                                            <div className="relative group">
                                                <img src={vehiclePhoto} alt="Vehicle" className="w-full h-32 object-cover rounded-lg border" />
                                                <button type="button" onClick={() => setVehiclePhoto(null)} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button type="button" onClick={() => setCaptureMode('vehicle')} className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-colors bg-gray-50">
                                                <Camera size={24} />
                                                <span className="text-xs mt-1">Take Photo</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-gray-100 flex justify-end">
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                            >
                                {loading ? <LoadingSpinner /> : <Save size={18} />} Check-In Visitor
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {activeTab === 'list' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in">
                    {loading ? <div className="col-span-3 text-center py-12"><LoadingSpinner /></div> : visitors.length === 0 ? (
                        <div className="col-span-3 text-center py-12 text-gray-500 bg-gray-50 rounded-xl border border-dashed">
                            No active visitors currently inside.
                        </div>
                    ) : (
                        visitors.map((v) => (
                            <div key={v._id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                                <div className="h-48 bg-gray-100 relative">
                                    <img src={v.visitorPhoto || '/placeholder-user.jpg'} alt={v.name} className="w-full h-full object-cover" />
                                    <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs px-2 py-1 rounded-bl-lg font-bold">
                                        IN: {new Date(v.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                                <div className="p-4 flex-1">
                                    <h3 className="font-bold text-lg text-gray-800">{v.name}</h3>
                                    <p className="text-sm text-gray-500 mb-2">{v.phone}</p>

                                    <div className="space-y-1 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg mb-4">
                                        {v.vehicleNumber && <div className="flex items-center gap-2"><Truck size={14} /> {v.vehicleNumber}</div>}
                                        <div className="flex items-center gap-2"><User size={14} /> Meets: {v.purpose}</div>
                                    </div>

                                    <button
                                        onClick={() => handleCheckOut(v._id)}
                                        disabled={!!checkoutLoading}
                                        className="w-full py-2 bg-red-50 text-red-600 font-bold rounded-lg hover:bg-red-100 transition-colors border border-red-100 flex justify-center items-center gap-2"
                                    >
                                        {checkoutLoading === v._id ? <LoadingSpinner /> : <LogOut size={16} />} Check Out
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Webcam Modal */}
            {captureMode && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl overflow-hidden shadow-2xl w-full max-w-lg">
                        <div className="relative bg-black h-80 flex items-center justify-center">
                            <Webcam
                                audio={false}
                                ref={webcamRef}
                                screenshotFormat="image/jpeg"
                                videoConstraints={{ facingMode: "user" }} // Or environment for guard
                                className="w-full h-full object-contain"
                            />
                        </div>
                        <div className="p-4 flex justify-between bg-white">
                            <button onClick={() => setCaptureMode(null)} className="px-4 py-2 text-gray-600 font-medium">Cancel</button>
                            <button onClick={capture} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold">Capture</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
