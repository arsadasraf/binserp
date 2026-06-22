/**
 * POForm Component
 * 
 * Renders form fields specific to Purchase Order (PO) creation/editing.
 * Fields include: PO number, vendor selection, and date.
 * 
 * @param formData - Current form data state
 * @param setFormData - Function to update form data
 * @param vendors - List of vendors for dropdown selection
 */

import React from 'react';
import { StoreFormData, Vendor } from '../../types/store.types';

interface POFormProps {
    formData: StoreFormData;
    setFormData: (data: StoreFormData) => void;
    vendors: Vendor[];
}

export default function POForm({ formData, setFormData, vendors }: POFormProps) {
    return (
        <>
            {/* PO Number - required field */}
            <input
                type="text"
                placeholder="PO Number *"
                required
                value={formData.poNumber || ""}
                onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })}
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
