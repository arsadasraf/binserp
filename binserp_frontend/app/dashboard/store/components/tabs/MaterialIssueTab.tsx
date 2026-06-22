import React, { useState } from 'react';
import { Plus, CheckSquare, History, Calendar, Filter, XCircle } from 'lucide-react';
import MaterialRequestTable from '../tables/MaterialRequestTable';
import MaterialIssueHistoryTable from '../tables/MaterialIssueHistoryTable';
import MaterialRequestModal from '../modals/MaterialRequestModal';
import MaterialRequestDetailsModal from '../modals/MaterialRequestDetailsModal';
import MaterialIssueDetailsModal from '../modals/MaterialIssueDetailsModal';

interface MaterialIssueTabProps {
    storeData: any; // Return value of useStoreData
    token: string | null;
}

export default function MaterialIssueTab({ storeData, token }: MaterialIssueTabProps) {
    const [subTab, setSubTab] = useState<'requests' | 'history'>('requests');
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [viewRequest, setViewRequest] = useState<any>(null); // State for request details view
    const [viewIssue, setViewIssue] = useState<any>(null); // State for issue details view

    // Filter States
    const [filterType, setFilterType] = useState<'monthly' | 'yearly'>('monthly');
    const [filterDate, setFilterDate] = useState<string>('');

    // Destructure needed data and handlers
    const {
        materialRequests, // Pending Requests
        data: issueHistory, // Material Issues
        createMaterialRequest,
        updateMaterialRequest, // For Reject
        createMaterialIssue, // For Issue
        materials,
        inventoryList, // Current Inventory for stock display
        inHouseComponents, // Added
        loading
    } = storeData;

    // Filter pending requests
    const pendingRequests = materialRequests.filter((r: any) => r.status === 'Pending' || r.status === 'Approved');

    // Filter History
    const filteredHistory = issueHistory?.filter((issue: any) => {
        if (!filterDate) return true;

        const issueDate = new Date(issue.date);

        if (filterType === 'monthly') {
            // Match Month (YYYY-MM)
            const filterMonth = filterDate; // Expecting YYYY-MM
            const issueMonth = issueDate.toISOString().slice(0, 7);
            return issueMonth === filterMonth;
        } else if (filterType === 'yearly') {
            // Match Year (YYYY)
            const filterYear = filterDate; // Expecting YYYY
            const issueYear = issueDate.getFullYear().toString();
            return issueYear === filterYear;
        }
        return true;
    }) || [];

    const handleCreateRequest = async (formData: any) => {
        try {
            await createMaterialRequest(formData);
            setIsRequestModalOpen(false);
        } catch (error) {
            console.error("Create request failed", error);
        }
    };

    const handleRejectRequest = async (request: any) => {
        if (!confirm("Are you sure you want to reject this request?")) return;
        try {
            await updateMaterialRequest(request._id, { status: 'Rejected' });
        } catch (error) {
            console.error("Reject failed", error);
        }
    };

    const handleIssueRequest = async (request: any) => {
        if (!confirm(`Confirm issue of materials for Request ${request.requestNumber}? Inventory will be deducted.`)) return;

        try {
            // Transform request to issue
            const issueData = {
                issueNumber: request.requestNumber.replace('REQ', 'ISS'),
                department: request.department || 'General',
                type: request.type || 'bo', // Pass type
                issuedTo: request.requestedBy?._id,
                items: request.items.map((item: any) => ({
                    material: item.material || (request.type === 'inhouse' ? undefined : item._id),
                    // Support component for Inhouse
                    component: item.component || (request.type === 'inhouse' ? (item.material || item._id) : undefined),
                    materialName: item.materialName,
                    materialCode: item.materialCode,
                    quantity: item.quantity,
                    unit: item.unit,
                    purpose: item.purpose
                })),
                date: new Date().toISOString(),
                status: 'Issued',
            };

            await createMaterialIssue(issueData);
            await updateMaterialRequest(request._id, { status: 'Issued', skipInventoryUpdate: true });

        } catch (error) {
            console.error("Issue failed", error);
            alert("Failed to issue material. Check stock or try again.");
        }
    };

    // Helper to render filter input based on type
    const renderFilterInput = () => {
        // Shared dropdown style
        const inputClass = "w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none cursor-pointer";
        const currentYear = new Date().getFullYear();
        const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

        // Months for dropdown
        const months = [
            { val: '01', label: 'January' }, { val: '02', label: 'February' },
            { val: '03', label: 'March' }, { val: '04', label: 'April' },
            { val: '05', label: 'May' }, { val: '06', label: 'June' },
            { val: '07', label: 'July' }, { val: '08', label: 'August' },
            { val: '09', label: 'September' }, { val: '10', label: 'October' },
            { val: '11', label: 'November' }, { val: '12', label: 'December' }
        ];

        switch (filterType) {
            case 'monthly':
                // Two dropdowns: Month | Year
                const [selYear, selMonth] = filterDate ? filterDate.split('-') : ['', ''];

                const updateMonth = (newMonth: string) => {
                    const y = selYear || currentYear.toString();
                    setFilterDate(`${y}-${newMonth}`);
                };

                const updateYear = (newYear: string) => {
                    const m = selMonth || '01'; // Default to Jan if only year selected previously
                    setFilterDate(`${newYear}-${m}`);
                };

                return (
                    <div className="flex gap-2 w-full">
                        <div className="relative flex-1">
                            <select
                                value={selMonth}
                                onChange={(e) => updateMonth(e.target.value)}
                                className={inputClass}
                            >
                                <option value="" disabled>Month</option>
                                {months.map(m => (
                                    <option key={m.val} value={m.val}>{m.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="relative w-28">
                            <select
                                value={selYear}
                                onChange={(e) => updateYear(e.target.value)}
                                className={inputClass}
                            >
                                {years.map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                );

            case 'yearly':
                return (
                    <div className="relative w-full">
                        <select
                            value={filterDate}
                            onChange={(e) => setFilterDate(e.target.value)}
                            className={inputClass}
                        >
                            <option value="">Select Year</option>
                            {years.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header / Sub-tabs */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex bg-gray-100/80 p-1.5 rounded-xl backdrop-blur-sm self-start sm:self-auto">
                    <button
                        onClick={() => setSubTab('requests')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${subTab === 'requests'
                            ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                            }`}
                    >
                        <CheckSquare size={16} />
                        New Requests
                        {pendingRequests.length > 0 && (
                            <span className="ml-1.5 bg-red-100 text-red-600 text-xs font-bold px-1.5 py-0.5 rounded-full">
                                {pendingRequests.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setSubTab('history')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${subTab === 'history'
                            ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                            }`}
                    >
                        <History size={16} />
                        Issued History
                    </button>
                </div>

                {subTab === 'requests' && (
                    <button
                        onClick={() => setIsRequestModalOpen(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg hover:shadow-blue-200 transition-all font-medium text-sm active:scale-95"
                    >
                        <Plus size={18} />
                        New Request
                    </button>
                )}
            </div>

            {/* Content Container */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm min-h-[400px] overflow-hidden">
                {subTab === 'requests' ? (
                    <div className="p-1">
                        <MaterialRequestTable
                            requests={pendingRequests}
                            onIssue={handleIssueRequest}
                            onReject={handleRejectRequest}
                            onView={(req) => setViewRequest(req)}
                        />
                    </div>
                ) : (
                    <div className="flex flex-col h-full">
                        {/* Modern Filter Bar */}
                        <div className="p-4 border-b border-gray-100 bg-gray-50/30">
                            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                                {/* Type Selector */}
                                <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0 no-scrollbar">
                                    <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-xl">
                                        {[
                                            { id: 'monthly', label: 'Monthly' },
                                            { id: 'yearly', label: 'Yearly' }
                                        ].map((type) => (
                                            <button
                                                key={type.id}
                                                onClick={() => { setFilterType(type.id as any); setFilterDate(''); }}
                                                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${filterType === type.id
                                                    ? 'bg-white text-blue-700 shadow-sm ring-1 ring-black/5'
                                                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                                                    }`}
                                            >
                                                {type.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="h-6 w-px bg-gray-200 hidden lg:block" />
                                    <div className="text-xs font-medium text-gray-500 bg-blue-50/50 px-3 py-1.5 rounded-lg border border-blue-100 whitespace-nowrap">
                                        Total: <span className="text-blue-700 font-bold ml-1">{filteredHistory.length}</span>
                                    </div>
                                </div>

                                {/* Date Input */}
                                <div className="relative w-full lg:max-w-md group flex items-center gap-2">
                                    <div className="hidden sm:flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-500">
                                        <Calendar size={16} />
                                    </div>
                                    {renderFilterInput()}

                                    {filterDate && (
                                        <button
                                            onClick={() => setFilterDate('')}
                                            className="ml-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                            title="Clear filter"
                                        >
                                            <XCircle size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Table Area */}
                        <MaterialIssueHistoryTable
                            issues={filteredHistory}
                            onView={(issue) => setViewIssue(issue)}
                        />
                    </div>
                )}
            </div>

            {/* Modals */}
            <MaterialRequestModal
                isOpen={isRequestModalOpen}
                onClose={() => setIsRequestModalOpen(false)}
                onSubmit={handleCreateRequest}
                materials={materials}
                inventoryList={inventoryList}
                loading={loading}
                inHouseComponents={inHouseComponents}
            />

            <MaterialRequestDetailsModal
                isOpen={!!viewRequest}
                onClose={() => setViewRequest(null)}
                request={viewRequest}
            />

            <MaterialIssueDetailsModal
                isOpen={!!viewIssue}
                onClose={() => setViewIssue(null)}
                issue={viewIssue}
            />
        </div>
    );
}
