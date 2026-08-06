/**
 * GRNForm Component
 * 
 * Renders form fields specific to Goods Receipt Note (GRN) creation/editing.
 * Fields include: GRN number, vendor selection, PO number, and date.
 * 
 * @param formData - Current form data state
 * @param setFormData - Function to update form data
 * @param vendors - List of vendors for dropdown selection
 */

import React from 'react';
import { StoreFormData, Vendor } from '../../types/store.types';

interface GRNFormProps {
    formData: StoreFormData;
    setFormData: (data: StoreFormData) => void;
    vendors: Vendor[];
}

export default function GRNForm({ formData, setFormData, vendors }: GRNFormProps) {
    return (
        <>
            {/* GRN Number - required field */}
            <input
                type="text"
                placeholder="GRN Number *"
                required
                value={formData.grnNumber || ""}
                onChange={(e) => setFormData({ ...formData, grnNumber: e.target.value })}
                className="input-field"
            />

            {/* Vendor selection dropdown */}
            <select
                value={formData.vendorId || ""}
                onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                className="input-field"
            >
                <option value="">Select Vendor</option>
                {vendors.map((v) => (
                    <option key={v._id} value={v._id}>
                        {v.name}
                    </option>
                ))}
            </select>

            {/* PO Number reference */}
            <input
                type="text"
                placeholder="PO Number"
                value={formData.poNumber || ""}
                onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })}
                className="input-field"
            />

            {/* Date picker */}
            <input
                type="date"
                value={formData.date || ""}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="input-field"
            />
        </>
    );
}
