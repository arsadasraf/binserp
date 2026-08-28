/**
 * BillingForm Component
 * 
 * Renders form fields specific to Invoice/Billing creation/editing.
 * Fields include: invoice number, customer selection, total amount, and date.
 * 
 * @param formData - Current form data state
 * @param setFormData - Function to update form data
 * @param customers - List of customers for dropdown selection
 */

import React from 'react';
import { StoreFormData, Customer } from "@/src/features/store/types/store.types";
import { CURRENCY_OPTIONS } from '@/src/utils/currencyHelper';

interface BillingFormProps {
    formData: StoreFormData;
    setFormData: (data: StoreFormData) => void;
    customers: Customer[];
}

export default function BillingForm({ formData, setFormData, customers }: BillingFormProps) {
    return (
        <>
            {/* Invoice Number - required field */}
            <input
                type="text"
                placeholder="Invoice Number *"
                required
                value={formData.invoiceNumber || ""}
                onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
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

            {/* Currency selection dropdown */}
            <select
                value={(formData as any).currency || "INR"}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value } as any)}
                className="input-field font-semibold text-indigo-600"
            >
                {CURRENCY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>
                        {c.label}
                    </option>
                ))}
            </select>

            {/* Total amount - required field */}
            <input
                type="number"
                placeholder="Total Amount *"
                required
                value={formData.totalAmount || ""}
                onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
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
