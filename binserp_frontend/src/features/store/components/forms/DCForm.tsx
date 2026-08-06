/**
 * DCForm Component
 * 
 * Renders form fields specific to Delivery Challan (DC) creation/editing.
 * Fields include: DC number, customer selection, and date.
 * 
 * @param formData - Current form data state
 * @param setFormData - Function to update form data
 * @param customers - List of customers for dropdown selection
 */

import React from 'react';
import { StoreFormData, Customer } from '../../types/store.types';

interface DCFormProps {
    formData: StoreFormData;
    setFormData: (data: StoreFormData) => void;
    customers: Customer[];
}

export default function DCForm({ formData, setFormData, customers }: DCFormProps) {
    return (
        <>
            {/* DC Number - required field */}
            <input
                type="text"
                placeholder="DC Number *"
                required
                value={formData.dcNumber || ""}
                onChange={(e) => setFormData({ ...formData, dcNumber: e.target.value })}
                className="input-field"
            />

            {/* Customer selection dropdown */}
            <select
                value={formData.customerId || ""}
                onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                className="input-field"
            >
                <option value="">Select Customer</option>
                {customers.map((c) => (
                    <option key={c._id} value={c._id}>
                        {c.name}
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
