/**
 * MaterialIssueForm Component
 * 
 * Renders form fields specific to Material Issue creation/editing.
 * Fields include: issue number and date.
 * 
 * @param formData - Current form data state
 * @param setFormData - Function to update form data
 */

import React from 'react';
import { StoreFormData } from '../../types/store.types';

interface MaterialIssueFormProps {
    formData: StoreFormData;
    setFormData: (data: StoreFormData) => void;
}

export default function MaterialIssueForm({ formData, setFormData }: MaterialIssueFormProps) {
    return (
        <>
            {/* Issue Number - required field */}
            <input
                type="text"
                placeholder="Issue Number *"
                required
                value={formData.issueNumber || ""}
                onChange={(e) => setFormData({ ...formData, issueNumber: e.target.value })}
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
