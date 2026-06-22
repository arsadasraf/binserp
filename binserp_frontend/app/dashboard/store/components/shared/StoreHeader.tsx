/**
 * StoreHeader Component
 * 
 * Displays the page header with title and description for the Store Management dashboard.
 * This is a presentational component with no state or business logic.
 */

import React from 'react';

export default function StoreHeader() {
    return (
        <div className="mb-2">
            {/* Main page title */}
            <h1 className="text-3xl font-bold text-gray-900">Store Management</h1>

            {/* Page description */}
            <p className="text-gray-600 mt-1">
                Manage inventory, vendors, customers, and deliveries
            </p>
        </div>
    );
}
