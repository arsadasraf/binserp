"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Building2,
  Sparkles,
  UserPlus,
  Phone,
  Mail,
  MapPin,
  FileText,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { useCreateStoreRecordMutation } from "@/src/store/services/storeService";
import Swal from "sweetalert2";

export interface QuickVendorMasterModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialName?: string;
  defaultVendorType?: string;
  onVendorCreated: (createdVendor: any) => void;
}

const VENDOR_TYPES = [
  "Rm Vendor",
  "BO Vendor",
  "Bought Out Vendor",
  "Consumable Vendor",
  "Manufacturing Vendor",
  "Services Vendor",
];

export default function QuickVendorMasterModal({
  isOpen,
  onClose,
  initialName = "",
  defaultVendorType = "Rm Vendor",
  onVendorCreated,
}: QuickVendorMasterModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Form Fields
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState("");
  const [vendorType, setVendorType] = useState(defaultVendorType);
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gst, setGst] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [createStoreRecord, { isLoading }] = useCreateStoreRecordMutation();

  // Reset or initialize on open
  useEffect(() => {
    if (isOpen) {
      setName(initialName || "");
      setCode("");
      setVendorType(defaultVendorType || "Rm Vendor");
      setContactPerson("");
      setPhone("");
      setEmail("");
      setGst("");
      setAddress("");
      setCity("");
      setState("");
      setPincode("");
      setFormErrors({});
    }
  }, [isOpen, initialName, defaultVendorType]);

  if (!isOpen || !mounted) return null;

  const clearError = (key: string) => {
    setFormErrors((prev) => {
      if (!prev[key]) return prev;
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: Record<string, string> = {};
    if (!name.trim()) {
      errors.name = "Vendor name is required";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      const payload: any = {
        name: name.trim(),
        vendorType,
        contactPerson: contactPerson.trim(),
        phone: phone.trim(),
        email: email.trim(),
        gst: gst.trim().toUpperCase(),
        address: address.trim(),
        billingAddress: address.trim(),
        city: city.trim(),
        billingCity: city.trim(),
        state: state.trim(),
        billingState: state.trim(),
        pincode: pincode.trim(),
        billingPincode: pincode.trim(),
      };

      if (code.trim()) {
        payload.code = code.trim().toUpperCase();
      }

      const res = await createStoreRecord({ tab: "vendor", body: payload }).unwrap();
      const createdVendor = res?.vendor || res?.data || res;

      const normalizedCreatedVendor = {
        ...createdVendor,
        _id: createdVendor?._id || res?._id || res?.data?._id,
        name: name.trim(),
        code: createdVendor?.code || code.trim(),
        vendorType: vendorType,
        city: city.trim(),
        state: state.trim(),
        address: address.trim(),
        phone: phone.trim(),
        email: email.trim(),
        gst: gst.trim().toUpperCase(),
      };

      Swal.fire({
        icon: "success",
        title: "Vendor Registered!",
        text: `"${name.trim()}" has been saved in Vendor Master and selected.`,
        timer: 1800,
        showConfirmButton: false,
      });

      onVendorCreated(normalizedCreatedVendor);
      onClose();
    } catch (err: any) {
      console.error("Failed to quick create vendor:", err);
      const errMsg = err?.data?.message || err?.message || "Failed to create vendor";
      Swal.fire({
        icon: "error",
        title: "Registration Failed",
        text: errMsg,
      });
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 bg-black/65 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-cyan-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between flex-shrink-0 border-b border-cyan-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/15 border border-cyan-400/30 rounded-2xl flex items-center justify-center text-cyan-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold tracking-tight text-white">
                  Quick Register Vendor Master
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                  Supplier Master
                </span>
              </div>
              <p className="text-xs text-cyan-300/80 font-medium">
                Add a new vendor on the fly without leaving your current form
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar text-xs">
          {/* Vendor Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <Building2 size={13} className="text-cyan-600" />
              Vendor / Supplier Company Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (e.target.value) clearError("name");
              }}
              placeholder="e.g. Tata Steel Ltd, SKF Bearings India Pvt Ltd"
              className={`w-full h-10 px-3 bg-white dark:bg-slate-800 border rounded-xl font-bold text-slate-900 dark:text-slate-100 transition-all ${
                formErrors.name
                  ? "border-rose-500 bg-rose-50/30 dark:bg-rose-950/20 ring-1 ring-rose-400"
                  : "border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-cyan-500"
              }`}
            />
            {formErrors.name && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-1 flex items-center gap-1">
                <AlertCircle size={12} />
                <span>{formErrors.name}</span>
              </p>
            )}
          </div>

          {/* Code & Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Vendor Code (Optional)
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Leave blank to auto-generate (VEN-...)"
                className="w-full h-9 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-xs uppercase"
              />
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                Auto-assigned using store settings if blank.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Vendor Classification / Type
              </label>
              <select
                value={vendorType}
                onChange={(e) => setVendorType(e.target.value)}
                className="w-full h-9 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-100"
              >
                {VENDOR_TYPES.map((vt) => (
                  <option key={vt} value={vt}>
                    {vt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Contact Person, Phone, Email */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Contact Person
              </label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                className="w-full h-9 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <Phone size={11} className="text-cyan-600" />
                Phone / Mobile
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +91 98765 43210"
                className="w-full h-9 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <Mail size={11} className="text-cyan-600" />
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vendor@example.com"
                className="w-full h-9 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>
          </div>

          {/* GSTIN */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <FileText size={11} className="text-cyan-600" />
              GSTIN / Tax Registration Number
            </label>
            <input
              type="text"
              value={gst}
              onChange={(e) => setGst(e.target.value.toUpperCase())}
              placeholder="e.g. 29ABCDE1234F1Z5"
              className="w-full h-9 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold uppercase tracking-wider"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <MapPin size={11} className="text-cyan-600" />
              Address / Location
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Plot No. 42, Industrial Area, Phase 2"
              className="w-full h-9 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
            />
          </div>

          {/* City, State, Pincode */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                City
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Mumbai"
                className="w-full h-9 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                State
              </label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g. Maharashtra"
                className="w-full h-9 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Pincode
              </label>
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="e.g. 400001"
                className="w-full h-9 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono"
              />
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Registering Vendor...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Save to Master & Select</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
