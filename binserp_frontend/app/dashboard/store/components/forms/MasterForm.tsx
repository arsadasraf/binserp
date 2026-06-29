/**
 * MasterForm Component
 * 
 * Renders form fields for master data (Vendor, Customer, Location, Category, Material).
 * Fields are conditionally displayed based on the master type:
 * - Vendor/Customer: name, code, contact person, phone, email, GST, address
 * - Location: name, code, description
 * - Category: name, code, unit
 * - Material: name, code, category (dropdown), unit (auto-filled from category)
 * 
 * @param formData - Current form data state
 * @param setFormData - Function to update form data
 * @param masterTab - Current master tab type
 * @param categories - List of categories for material form
 */

import React from 'react';
import { StoreFormData, MasterType, Category, Location, Process } from '../../types/store.types';
import { X } from 'lucide-react'; // Import X for tags

const COUNTRIES = ["India", "Other"];
const STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", 
    "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", 
    "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", 
    "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", 
    "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

const DISTRICTS = [
    "Bengaluru Urban", "Bengaluru Rural", "Mysuru", "Hubballi", "Mangaluru", "Belagavi", "Tumakuru",
    "Mumbai City", "Mumbai Suburban", "Pune", "Nagpur", "Thane", "Nashik", "Aurangabad",
    "Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tirunelveli",
    "Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar",
    "New Delhi", "North Delhi", "South Delhi", "East Delhi", "West Delhi",
    "Hyderabad", "Kolkata", "Jaipur", "Lucknow", "Bhopal", "Chandigarh", "Patna", "Ranchi", "Dehradun", "Shimla",
    "Other"
].sort();


interface MasterFormProps {
    formData: StoreFormData;
    setFormData: (data: StoreFormData) => void;
    masterTab: MasterType;
    categories?: Category[];
    locations?: Location[];

    processes?: Process[]; // Added
}

export default function MasterForm({ formData, setFormData, masterTab, categories = [], locations = [], processes = [] }: MasterFormProps) {
    /**
     * Handles category selection for material
     * Auto-fills unit from selected category
     */
    const handleCategoryChange = (categoryId: string) => {
        const selectedCategory = categories.find(cat => cat._id === categoryId);
        setFormData({
            ...formData,
            categoryId,
            unit: selectedCategory?.unit || '',
        });
    };

    const [sameAsBilling, setSameAsBilling] = React.useState(false);

    React.useEffect(() => {
        if (sameAsBilling) {
            setFormData({
                ...formData,
                shippingAddress: formData.billingAddress || "",
                shippingCity: formData.billingCity || "",
                shippingPincode: formData.billingPincode || "",
                shippingState: formData.billingState || "",
                shippingDistrict: formData.billingDistrict || "",
                shippingCountry: formData.billingCountry || "",
            });
        }
    }, [
        sameAsBilling,
        formData.billingAddress,
        formData.billingCity,
        formData.billingPincode,
        formData.billingState,
        formData.billingDistrict,
        formData.billingCountry,
    ]);

    const renderSectionHeader = (title: string, colorClass: string = "bg-indigo-600") => (
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <div className={`w-1 h-5 ${colorClass} rounded`}></div>
            {title}
        </h3>
    );

    return (
        <div className="space-y-6">
            {/* Basic Details Section */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                {renderSectionHeader("Basic Details")}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Type Selection for InHouse Items */}
                    {masterTab === "inhouse-items" && (
                        <div className="md:col-span-2 lg:col-span-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                            <select
                                value={formData.type || "Component"}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                            >
                                <option value="Component">Component</option>
                                <option value="SubAssembly">Sub-Assembly</option>
                                <option value="Assembly">Assembly</option>
                            </select>
                        </div>
                    )}



                    {/* Vendor Type Selection */}
                    {masterTab === "vendor" && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Type</label>
                            <select
                                value={formData.vendorType || "Rm Vendor"}
                                onChange={(e) => setFormData({ ...formData, vendorType: e.target.value as any })}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                            >
                                <option value="Rm Vendor">Rm Vendor</option>
                                <option value="Consumable Vendor">Consumable Vendor</option>
                                <option value="Manufacturing Vendor">Manufacturing Vendor</option>
                            </select>
                        </div>
                    )}

                    {/* Customer Type Selection */}
                    {masterTab === "customer" && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Type</label>
                            <select
                                value={formData.customerType || "Manufacturing Sales"}
                                onChange={(e) => setFormData({ ...formData, customerType: e.target.value as any })}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                            >
                                <option value="Manufacturing Sales">Manufacturing Sales</option>
                                <option value="Labor-Job Sales">Labor-Job Sales</option>
                            </select>
                        </div>
                    )}

                    {/* Common Name Field */}
                    <div className={(masterTab === "vendor" || masterTab === "customer") ? "md:col-span-1" : ""}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            required
                            value={formData.name || ""}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Enter Name"
                        />
                    </div>

                    {/* Code Field (Hidden for Inhouse, Customer, Vendor, & RM/BO Items) */}
                    {masterTab !== "inhouse-items" && masterTab !== "customer" && masterTab !== "vendor" && masterTab !== "rm-bo-item" && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Code <span className="text-red-500"> *</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.code || ""}
                                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="Enter Code"
                            />
                        </div>
                    )}

                    {/* Description Field for RM/BO Item */}
                    {masterTab === "rm-bo-item" && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Description
                            </label>
                            <input
                                type="text"
                                value={formData.descriptions || ""}
                                onChange={(e) => setFormData({ ...formData, descriptions: e.target.value })}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="Enter Description"
                            />
                        </div>
                    )}

                    {/* GST Number Field for Customer & Vendor */}
                    {(masterTab === "customer" || masterTab === "vendor") && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">GST Number</label>
                            <input
                                type="text"
                                value={formData.gst || ""}
                                onChange={(e) => setFormData({ ...formData, gst: e.target.value })}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="e.g. 29AAAAA0000A1Z5"
                            />
                        </div>
                    )}

                    {/* Category Specific: HSN Code & Unit */}
                    {masterTab === "category" && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">HSN Code</label>
                                <input
                                    type="text"
                                    value={formData.hsnCode || ""}
                                    onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="Enter HSN Code"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                                <input
                                    type="text"
                                    value={formData.unit || ""}
                                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="e.g. KG, PCS"
                                />
                            </div>
                        </>
                    )}

                    {/* Location/Inhouse Specific: Description */}
                    {(masterTab === "location" || masterTab === "inhouse-items") && (
                            <div className="md:col-span-2 lg:col-span-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea
                                    value={formData.description || ""}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="Enter Description"
                                    rows={3}
                                />
                            </div>
                    )}

                    {/* Material/Inhouse Specific: Category & Loction */}
                    {(masterTab === "rm-bo-item" || masterTab === "inhouse-items") && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                <select

                                    value={formData.categoryId || ""}
                                    onChange={(e) => handleCategoryChange(e.target.value)}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                                >
                                    <option value="">Select Category</option>
                                    {categories.map((category) => (
                                        <option key={category._id} value={category._id}>
                                            {category.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                                <select
                                    value={formData.locationId || ""}
                                    onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                                >
                                    <option value="">Select Location</option>
                                    {locations.map((location) => (
                                        <option key={location._id} value={location._id}>
                                            {location.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                                <input
                                    type="text"
                                    value={formData.unit || ""}
                                    readOnly
                                    className="w-full px-4 py-2.5 bg-gray-100 border border-gray-300 rounded-lg text-gray-500 cursor-not-allowed"
                                    placeholder="Auto-filled"
                                />
                            </div>
                        </>
                    )}

                    {/* RM/BO Item Specific Fields */}
                    {masterTab === "rm-bo-item" && (
                        <>
                            <div className="md:col-span-2 lg:col-span-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Descriptions</label>
                                <textarea
                                    value={formData.descriptions || ""}
                                    onChange={(e) => setFormData({ ...formData, descriptions: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="Enter Descriptions"
                                    rows={2}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Stock</label>
                                <input
                                    type="number"
                                    value={formData.minimumStock || ""}
                                    onChange={(e) => setFormData({ ...formData, minimumStock: parseFloat(e.target.value) })}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="Enter Minimum Stock"
                                />
                            </div>
                            <div className="md:col-span-2 lg:col-span-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Photos (Max 2)</label>
                                <input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files.length > 2) {
                                            alert("You can only upload up to 2 photos.");
                                            e.target.value = "";
                                            return;
                                        }
                                        const filesArray = Array.from(e.target.files || []);
                                        setFormData({ ...formData, photos: filesArray });
                                    }}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                                {formData.photos && typeof formData.photos[0] === 'string' && (
                                    <div className="flex gap-2 mt-2">
                                        {(formData.photos as any[]).map((photo, i) => (
                                            typeof photo === 'string' ? (
                                                <img key={i} src={photo} alt={`Photo ${i+1}`} className="w-20 h-20 object-cover rounded border" />
                                            ) : null
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>



            {/* Vendor/Customer Specific Sections */}
            {(masterTab === "vendor" || masterTab === "customer") && (
                <>
                    {/* Contact Information */}
                    <div className="bg-white rounded-xl p-5 border-2 border-indigo-50">
                        {renderSectionHeader("Contact Information", "bg-pink-500")}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                                <input
                                    type="text"
                                    value={formData.contactPerson || ""}
                                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="e.g. John Doe"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                <input
                                    type="text"
                                    value={formData.phone || ""}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="e.g. +91 9876543210"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <input
                                    type="email"
                                    value={formData.email || ""}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="e.g. contact@example.com"
                                />
                            </div>

                            {masterTab === "customer" && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Customer Website</label>
                                    <input
                                        type="text"
                                        value={formData.website || ""}
                                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="e.g. www.example.com"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Address Section */}
                    <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                        {renderSectionHeader("Address", "bg-green-500")}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {(masterTab === "customer" || masterTab === "vendor") && (
                                <>
                                    <div className="md:col-span-2 lg:col-span-4 border-t border-gray-200 mt-4 pt-4">
                                        <h4 className="text-md font-semibold text-gray-800 mb-4">Billing Address</h4>
                                    </div>
                                    <div className="md:col-span-2 lg:col-span-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                                        <textarea
                                            value={formData.billingAddress || ""}
                                            onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                            placeholder="Enter Billing Address"
                                            rows={2}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                                        <input
                                            type="text"
                                            value={formData.billingCity || ""}
                                            onChange={(e) => setFormData({ ...formData, billingCity: e.target.value })}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                            placeholder="Enter City"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                                        <input
                                            type="text"
                                            value={formData.billingPincode || ""}
                                            onChange={(e) => setFormData({ ...formData, billingPincode: e.target.value })}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                            placeholder="Enter Pincode"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                                        <select
                                            value={formData.billingState || ""}
                                            onChange={(e) => setFormData({ ...formData, billingState: e.target.value })}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                                        >
                                            <option value="">Select State</option>
                                            {STATES.map(state => (
                                                <option key={state} value={state}>{state}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
                                        <select
                                            value={formData.billingDistrict || ""}
                                            onChange={(e) => setFormData({ ...formData, billingDistrict: e.target.value })}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                                        >
                                            <option value="">Select District</option>
                                            {DISTRICTS.map(dist => (
                                                <option key={dist} value={dist}>{dist}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                                        <select
                                            value={formData.billingCountry || ""}
                                            onChange={(e) => setFormData({ ...formData, billingCountry: e.target.value })}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                                        >
                                            <option value="">Select Country</option>
                                            {COUNTRIES.map(country => (
                                                <option key={country} value={country}>{country}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="md:col-span-2 lg:col-span-4 border-t border-gray-200 mt-4 pt-4 flex items-center justify-between">
                                        <h4 className="text-md font-semibold text-gray-800">Shipping Address</h4>
                                        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={sameAsBilling}
                                                onChange={(e) => setSameAsBilling(e.target.checked)}
                                                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                            />
                                            Same as Billing Address
                                        </label>
                                    </div>
                                    {!sameAsBilling && (
                                        <>
                                    <div className="md:col-span-2 lg:col-span-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                                        <textarea
                                            value={formData.shippingAddress || ""}
                                            onChange={(e) => setFormData({ ...formData, shippingAddress: e.target.value })}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                            placeholder="Enter Shipping Address"
                                            rows={2}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                                        <input
                                            type="text"
                                            value={formData.shippingCity || ""}
                                            onChange={(e) => setFormData({ ...formData, shippingCity: e.target.value })}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                            placeholder="Enter City"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                                        <input
                                            type="text"
                                            value={formData.shippingPincode || ""}
                                            onChange={(e) => setFormData({ ...formData, shippingPincode: e.target.value })}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                            placeholder="Enter Pincode"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                                        <select
                                            value={formData.shippingState || ""}
                                            onChange={(e) => setFormData({ ...formData, shippingState: e.target.value })}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                                        >
                                            <option value="">Select State</option>
                                            {STATES.map(state => (
                                                <option key={state} value={state}>{state}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
                                        <select
                                            value={formData.shippingDistrict || ""}
                                            onChange={(e) => setFormData({ ...formData, shippingDistrict: e.target.value })}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                                        >
                                            <option value="">Select District</option>
                                            {DISTRICTS.map(dist => (
                                                <option key={dist} value={dist}>{dist}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                                        <select
                                            value={formData.shippingCountry || ""}
                                            onChange={(e) => setFormData({ ...formData, shippingCountry: e.target.value })}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                                        >
                                            <option value="">Select Country</option>
                                            {COUNTRIES.map(country => (
                                                <option key={country} value={country}>{country}</option>
                                            ))}
                                        </select>
                                    </div>
                                    </>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Bank Details Section */}
                    <div className="bg-white rounded-xl p-5 border-2 border-indigo-50">
                        {renderSectionHeader("Bank Details", "bg-purple-600")}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                                <input
                                    type="text"
                                    value={formData.bankDetails?.accountName || ""}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        bankDetails: { ...formData.bankDetails, accountName: e.target.value }
                                    })}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="Enter Account Name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                                <input
                                    type="text"
                                    value={formData.bankDetails?.accountNumber || ""}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        bankDetails: { ...formData.bankDetails, accountNumber: e.target.value }
                                    })}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="Enter Account Number"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
                                <input
                                    type="text"
                                    value={formData.bankDetails?.ifscCode || ""}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        bankDetails: { ...formData.bankDetails, ifscCode: e.target.value }
                                    })}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="Enter IFSC Code"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                                <input
                                    type="text"
                                    value={formData.bankDetails?.bankName || ""}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        bankDetails: { ...formData.bankDetails, bankName: e.target.value }
                                    })}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="Enter Bank Name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Branch Name</label>
                                <input
                                    type="text"
                                    value={formData.bankDetails?.branchName || ""}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        bankDetails: { ...formData.bankDetails, branchName: e.target.value }
                                    })}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="Enter Branch Name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Swift Code</label>
                                <input
                                    type="text"
                                    value={formData.bankDetails?.swiftCode || ""}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        bankDetails: { ...formData.bankDetails, swiftCode: e.target.value }
                                    })}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="Enter Swift Code"
                                />
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
