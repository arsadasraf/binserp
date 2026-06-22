import React, { useState } from 'react';
import { X, Download, MapPin, Phone, Mail, Globe, Hash, Building2, CreditCard } from 'lucide-react';
import { MasterType } from '../../types/store.types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface MasterDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: any;
    type: MasterType | 'fg-items';
}

export default function MasterDetailModal({ isOpen, onClose, data, type }: MasterDetailModalProps) {
    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
    if (!isOpen || !data) return null;

    const getTitle = () => {
        switch (type) {
            case 'vendor': return 'Vendor Details';
            case 'customer': return 'Customer Details';
            case 'job-work-supplier': return 'Job-Work Supplier Details';
            case 'fg-items': return 'FG Item Details';
            default: return 'Details';
        }
    };

    const getTypeLabel = () => {
        switch (type) {
            case 'vendor': return 'Vendor';
            case 'customer': return 'Customer';
            case 'job-work-supplier': return 'Job-Work Supplier';
            case 'fg-items': return 'FG Item';
            default: return 'Record';
        }
    };

    const downloadPDF = () => {
        const doc = new jsPDF();

        // Header
        doc.setFontSize(22);
        doc.setTextColor(63, 81, 181); // Indigo color
        doc.text(getTitle(), 105, 20, { align: 'center' } as any);

        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 105, 28, { align: 'center' } as any);

        // Basic Info Table
        const basicInfo = [
            ['Code', data.code || '-'],
            ['Name', data.name || '-'],
            ['Type', type === 'customer' ? (data.customerType || '-') : '-'],
        ];

        autoTable(doc, {
            startY: 40,
            head: [[{ content: 'Basic Information', colSpan: 2, styles: { halign: 'center', fillColor: [63, 81, 181] } }]],
            body: basicInfo,
            theme: 'grid',
            headStyles: { fillColor: [63, 81, 181] },
        });

        // Contact Info
        const contactInfo = [
            ['Contact Person', data.contactPerson || '-'],
            ['Phone', data.phone || '-'],
            ['Email', data.email || '-'],
            ['Website', data.website || '-'],
            ['GST Number', data.gst || '-'],
        ];

        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 10,
            head: [[{ content: 'Contact Information', colSpan: 2, styles: { halign: 'center', fillColor: [63, 81, 181] } }]],
            body: contactInfo,
            theme: 'grid',
            headStyles: { fillColor: [63, 81, 181] },
        });

        // Address Info
        if (type === 'customer' || type === 'vendor') {
            const billingAddressInfo = [
                ['Address', data.billingAddress || '-'],
                ['City', data.billingCity || '-'],
                ['Pincode', data.billingPincode || '-'],
                ['State', data.billingState || '-'],
                ['District', data.billingDistrict || '-'],
                ['Country', data.billingCountry || '-'],
            ];

            autoTable(doc, {
                startY: (doc as any).lastAutoTable.finalY + 10,
                head: [[{ content: 'Billing Address', colSpan: 2, styles: { halign: 'center', fillColor: [63, 81, 181] } }]],
                body: billingAddressInfo,
                theme: 'grid',
                headStyles: { fillColor: [63, 81, 181] },
            });

            const shippingAddressInfo = [
                ['Address', data.shippingAddress || '-'],
                ['City', data.shippingCity || '-'],
                ['Pincode', data.shippingPincode || '-'],
                ['State', data.shippingState || '-'],
                ['District', data.shippingDistrict || '-'],
                ['Country', data.shippingCountry || '-'],
            ];

            autoTable(doc, {
                startY: (doc as any).lastAutoTable.finalY + 10,
                head: [[{ content: 'Shipping Address', colSpan: 2, styles: { halign: 'center', fillColor: [63, 81, 181] } }]],
                body: shippingAddressInfo,
                theme: 'grid',
                headStyles: { fillColor: [63, 81, 181] },
            });
        } else {
            const addressInfo = [
                ['Address', data.address || '-'],
                ['City', data.city || '-'],
                ['State', data.state || '-'],
                ['Country', data.country || '-'],
                ['Pincode', data.pincode || '-'],
            ];

            autoTable(doc, {
                startY: (doc as any).lastAutoTable.finalY + 10,
                head: [[{ content: 'Address Information', colSpan: 2, styles: { halign: 'center', fillColor: [63, 81, 181] } }]],
                body: addressInfo,
                theme: 'grid',
                headStyles: { fillColor: [63, 81, 181] },
            });
        }

        // Bank Details
        if (data.bankDetails) {
            const bankInfo = [
                ['Account Name', data.bankDetails.accountName || '-'],
                ['Account Number', data.bankDetails.accountNumber || '-'],
                ['Bank Name', data.bankDetails.bankName || '-'],
                ['Branch', data.bankDetails.branchName || data.bankDetails.branch || '-'],
                ['IFSC Code', data.bankDetails.ifscCode || '-'],
                ['Swift Code', data.bankDetails.swiftCode || '-'],
            ];

            autoTable(doc, {
                startY: (doc as any).lastAutoTable.finalY + 10,
                head: [[{ content: 'Bank Details', colSpan: 2, styles: { halign: 'center', fillColor: [63, 81, 181] } }]],
                body: bankInfo,
                theme: 'grid',
                headStyles: { fillColor: [63, 81, 181] },
            });
        }

        // Specific to Job Work
        if (type === 'job-work-supplier') {
            const processData = [
                ['Processes', data.processList?.map((p: any) => p.processName || p).join(', ') || '-']
            ];
            autoTable(doc, {
                startY: (doc as any).lastAutoTable.finalY + 10,
                head: [[{ content: 'Job Work Details', colSpan: 2, styles: { halign: 'center', fillColor: [63, 81, 181] } }]],
                body: processData,
                theme: 'grid',
                headStyles: { fillColor: [63, 81, 181] },
            });
        }

        doc.save(`${getTypeLabel()}_${data.code || 'Details'}.pdf`);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-lg">
                            <Building2 size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">{getTitle()}</h2>
                            <p className="text-sm text-gray-500 flex items-center gap-2">
                                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide">
                                    {getTypeLabel()}
                                </span>
                                <span className="text-gray-400">•</span>
                                <span>{data.code}</span>
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={downloadPDF}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium text-sm"
                        >
                            <Download size={18} />
                            Download PDF
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Left Column: Basic & Contact */}
                        <div className="space-y-6">
                            <section>
                                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Hash size={16} className="text-indigo-500" /> Basic Details
                                </h3>
                                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-gray-500 block">Name</label>
                                            <span className="text-sm font-medium text-gray-900">{data.name}</span>
                                        </div>
                                        {type !== 'fg-items' && (
                                            <div>
                                                <label className="text-xs text-gray-500 block">Code</label>
                                                <span className="text-sm font-medium text-gray-900">{data.code}</span>
                                            </div>
                                        )}
                                        {type === 'customer' && (
                                            <div>
                                                <label className="text-xs text-gray-500 block">Type</label>
                                                <span className="text-sm font-medium text-gray-900">
                                                    {data.customerType || '-'}
                                                </span>
                                            </div>
                                        )}
                                        {type === 'fg-items' && (
                                            <>
                                                <div>
                                                    <label className="text-xs text-gray-500 block">Type</label>
                                                    <span className="text-sm font-medium text-gray-900">{data.type || '-'}</span>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-500 block">Unit</label>
                                                    <span className="text-sm font-medium text-gray-900">{data.unit || '-'}</span>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-500 block">Revision Number</label>
                                                    <span className="text-sm font-medium text-gray-900">{data.revisionNumber || '-'}</span>
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="text-xs text-gray-500 block">Description</label>
                                                    <span className="text-sm font-medium text-gray-900">{data.description || '-'}</span>
                                                </div>
                                            </>
                                        )}
                                        {/* GST/PAN if available in data, assuming schema has it, or just generic fields */}
                                        {type !== 'fg-items' && data.gst && (
                                            <div>
                                                <label className="text-xs text-gray-500 block">GST No</label>
                                                <span className="text-sm font-medium text-gray-900">{data.gst}</span>
                                            </div>
                                        )}
                                        {type !== 'fg-items' && data.panNo && (
                                            <div>
                                                <label className="text-xs text-gray-500 block">PAN No</label>
                                                <span className="text-sm font-medium text-gray-900">{data.panNo}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>

                            {type !== 'fg-items' && (
                                <section>
                                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <Phone size={16} className="text-indigo-500" /> Contact Info
                                    </h3>
                                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs text-gray-500 block">Contact Person</label>
                                                <span className="text-sm font-medium text-gray-900">{data.contactPerson || '-'}</span>
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-500 block">Phone</label>
                                                <span className="text-sm font-medium text-gray-900">{data.phone || '-'}</span>
                                            </div>
                                            <div className="sm:col-span-2">
                                                <label className="text-xs text-gray-500 block">Email</label>
                                                <span className="text-sm font-medium text-gray-900 truncate block">{data.email || '-'}</span>
                                            </div>
                                            <div className="sm:col-span-2">
                                                <label className="text-xs text-gray-500 block">Website</label>
                                                <a href={data.website} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline truncate block">
                                                    {data.website || '-'}
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {type === 'fg-items' && (
                                <section>
                                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <Building2 size={16} className="text-indigo-500" /> Bill of Materials
                                    </h3>
                                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                                        <div className="flex flex-col gap-2">
                                            {data.bom && data.bom.length > 0 ? (
                                                data.bom.map((b: any, i: number) => (
                                                    <div key={i} className="flex justify-between items-center bg-white p-2 border border-gray-200 rounded text-sm">
                                                        <div>
                                                            <span className="font-semibold text-gray-800">{b.itemName || b.item?.name || 'Unknown Item'}</span>
                                                            <span className="text-xs text-gray-500 block">{b.itemType}</span>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="font-bold text-gray-900">{b.quantity}</span> <span className="text-xs text-gray-500">{b.unit || 'Nos'}</span>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <span className="text-sm text-gray-400">No BOM specified</span>
                                            )}
                                        </div>
                                    </div>
                                </section>
                            )}
                        </div>

                        {/* Right Column: Address, Bank, Specifics */}
                        <div className="space-y-6">
                            { (type === 'customer' || type === 'vendor') && (
                                <>
                                    <section>
                                        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <MapPin size={16} className="text-indigo-500" /> Billing Address
                                        </h3>
                                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                                            <div>
                                                <label className="text-xs text-gray-500 block">Address</label>
                                                <p className="text-sm font-medium text-gray-900 whitespace-pre-line">{data.billingAddress || '-'}</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 pt-2">
                                                <div>
                                                    <label className="text-xs text-gray-500 block">City</label>
                                                    <span className="text-sm font-medium text-gray-900">{data.billingCity || '-'}</span>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-500 block">Pincode</label>
                                                    <span className="text-sm font-medium text-gray-900">{data.billingPincode || '-'}</span>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-500 block">State</label>
                                                    <span className="text-sm font-medium text-gray-900">{data.billingState || '-'}</span>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-500 block">District</label>
                                                    <span className="text-sm font-medium text-gray-900">{data.billingDistrict || '-'}</span>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-500 block">Country</label>
                                                    <span className="text-sm font-medium text-gray-900">{data.billingCountry || '-'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </section>
                                    <section>
                                        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <MapPin size={16} className="text-indigo-500" /> Shipping Address
                                        </h3>
                                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                                            <div>
                                                <label className="text-xs text-gray-500 block">Address</label>
                                                <p className="text-sm font-medium text-gray-900 whitespace-pre-line">{data.shippingAddress || '-'}</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 pt-2">
                                                <div>
                                                    <label className="text-xs text-gray-500 block">City</label>
                                                    <span className="text-sm font-medium text-gray-900">{data.shippingCity || '-'}</span>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-500 block">Pincode</label>
                                                    <span className="text-sm font-medium text-gray-900">{data.shippingPincode || '-'}</span>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-500 block">State</label>
                                                    <span className="text-sm font-medium text-gray-900">{data.shippingState || '-'}</span>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-500 block">District</label>
                                                    <span className="text-sm font-medium text-gray-900">{data.shippingDistrict || '-'}</span>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-500 block">Country</label>
                                                    <span className="text-sm font-medium text-gray-900">{data.shippingCountry || '-'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </section>
                                </>
                            )}
                            {type !== 'fg-items' && type !== 'customer' && type !== 'vendor' && (
                                <section>
                                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <MapPin size={16} className="text-indigo-500" /> Address Details
                                    </h3>
                                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                                        <div>
                                            <label className="text-xs text-gray-500 block">Address</label>
                                            <p className="text-sm font-medium text-gray-900 whitespace-pre-line">{data.address || '-'}</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 pt-2">
                                            <div>
                                                <label className="text-xs text-gray-500 block">City</label>
                                                <span className="text-sm font-medium text-gray-900">{data.city || '-'}</span>
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-500 block">State</label>
                                                <span className="text-sm font-medium text-gray-900">{data.state || '-'}</span>
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-500 block">Country</label>
                                                <span className="text-sm font-medium text-gray-900">{data.country || '-'}</span>
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-500 block">Pincode</label>
                                                <span className="text-sm font-medium text-gray-900">{data.pincode || '-'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {type === 'fg-items' && (
                                <section>
                                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <MapPin size={16} className="text-indigo-500" /> Photos
                                    </h3>
                                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                                        <div className="flex flex-wrap gap-2">
                                            {data.photos && data.photos.length > 0 ? (
                                                data.photos.map((url: string, i: number) => (
                                                    <div key={i} onClick={() => setSelectedPhoto(url)} className="block w-20 h-20 rounded overflow-hidden border border-gray-200 cursor-pointer">
                                                        <img src={url} alt={`Photo ${i+1}`} className="w-full h-full object-cover hover:scale-110 transition-transform" />
                                                    </div>
                                                ))
                                            ) : (
                                                <span className="text-sm text-gray-400">No photos available</span>
                                            )}
                                        </div>
                                    </div>
                                </section>
                            )}

                            {(data.bankDetails) && (
                                <section>
                                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <CreditCard size={16} className="text-indigo-500" /> Bank Details
                                    </h3>
                                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="col-span-2">
                                                <label className="text-xs text-gray-500 block">Account Name</label>
                                                <span className="text-sm font-medium text-gray-900">{data.bankDetails.accountName || '-'}</span>
                                            </div>
                                            <div className="col-span-2">
                                                <label className="text-xs text-gray-500 block">Bank Name</label>
                                                <span className="text-sm font-medium text-gray-900">{data.bankDetails.bankName || '-'}</span>
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-500 block">Account Number</label>
                                                <span className="text-sm font-medium text-gray-900">{data.bankDetails.accountNumber || '-'}</span>
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-500 block">IFSC Code</label>
                                                <span className="text-sm font-medium text-gray-900">{data.bankDetails.ifscCode || '-'}</span>
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-500 block">Branch</label>
                                                <span className="text-sm font-medium text-gray-900">{data.bankDetails.branchName || data.bankDetails.branch || '-'}</span>
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-500 block">Swift Code</label>
                                                <span className="text-sm font-medium text-gray-900">{data.bankDetails.swiftCode || '-'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {type === 'job-work-supplier' && (
                                <section>
                                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <Building2 size={16} className="text-indigo-500" /> Job Work Specifics
                                    </h3>
                                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1">Processes</label>
                                            <div className="flex flex-wrap gap-2">
                                                {data.processList?.length > 0 ? (
                                                    data.processList.map((p: any, i: number) => (
                                                        <span key={i} className="px-2.5 py-1 bg-white border border-gray-200 rounded text-xs font-medium text-gray-700 shadow-sm">
                                                            {p.processName || p}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-sm text-gray-400">-</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Full Screen Photo Preview */}
            {selectedPhoto && (
                <div 
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200"
                    onClick={() => setSelectedPhoto(null)}
                >
                    <button 
                        onClick={() => setSelectedPhoto(null)}
                        className="absolute top-6 right-6 p-2 text-white/70 hover:text-white bg-black/50 hover:bg-black/70 rounded-full transition-colors z-[70]"
                    >
                        <X size={32} />
                    </button>
                    <img 
                        src={selectedPhoto} 
                        alt="Preview" 
                        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200" 
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
}
