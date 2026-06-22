"use client";

import { useState } from "react";
import Modal from "@/src/components/Modal";
import LoadingSpinner from "@/src/components/LoadingSpinner";
import { Edit2, Trash2, Plus, Clock } from "lucide-react";
import {
  useGetShiftsQuery,
  useCreateShiftMutation,
  useUpdateShiftMutation,
  useDeleteShiftMutation,
} from "@/src/store/services/ppcService";

export default function PPCShiftTab() {
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [editingShift, setEditingShift] = useState<any | null>(null);
  const [shiftFormData, setShiftFormData] = useState({ name: "", startTime: "", endTime: "", description: "" });
  const [saving, setSaving] = useState(false);

  const { data: shifts = [], isLoading: loadingShifts } = useGetShiftsQuery();
  const [createShift] = useCreateShiftMutation();
  const [updateShift] = useUpdateShiftMutation();
  const [deleteShift] = useDeleteShiftMutation();

  const openShiftForm = (shift?: any) => {
    if (shift) {
      setEditingShift(shift);
      setShiftFormData({ name: shift.name, startTime: shift.startTime, endTime: shift.endTime, description: shift.description || "" });
    } else {
      setEditingShift(null);
      setShiftFormData({ name: "", startTime: "", endTime: "", description: "" });
    }
    setShowShiftForm(true);
  };

  const handleShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingShift) {
        const res = await updateShift({ id: editingShift._id, body: shiftFormData });
        if ("error" in res) { alert("Failed to update shift"); return; }
      } else {
        const res = await createShift(shiftFormData);
        if ("error" in res) { alert("Failed to create shift"); return; }
      }
      setShowShiftForm(false);
      setEditingShift(null);
      setShiftFormData({ name: "", startTime: "", endTime: "", description: "" });
      alert("Shift saved successfully");
    } catch (e) {
      console.error(e);
      alert("Error saving shift");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteShift = async (id: string) => {
    if (!confirm("Delete this shift?")) return;
    const res = await deleteShift(id);
    if ("error" in res) alert("Failed to delete shift");
  };

  if (loadingShifts && shifts.length === 0) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <Clock className="text-indigo-600" />
          Shift Management
        </h2>
        <button
          onClick={() => openShiftForm()}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2 font-medium"
        >
          <Plus size={18} />
          Add Shift
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Shift Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Start Time</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">End Time</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {shifts.map((shift) => (
              <tr key={shift._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{shift.name}</td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 font-mono">{shift.startTime}</td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 font-mono">{shift.endTime}</td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{shift.description || "-"}</td>
                <td className="px-6 py-4 text-right flex justify-end gap-2">
                  <button onClick={() => openShiftForm(shift)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDeleteShift(shift._id)} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {shifts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  <Clock size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No shifts defined yet.</p>
                  <p className="text-xs mt-1 text-gray-400">Add shifts to standardize timings across your plant.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={showShiftForm} onClose={() => setShowShiftForm(false)} title={editingShift ? "Edit Shift" : "Add New Shift"}>
        <form onSubmit={handleShiftSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Shift Name</label>
            <input
              type="text"
              required
              value={shiftFormData.name}
              onChange={(e) => setShiftFormData({ ...shiftFormData, name: e.target.value })}
              className="block w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5"
              placeholder="e.g. First Shift, General Shift"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Time</label>
              <input
                type="time"
                required
                value={shiftFormData.startTime}
                onChange={(e) => setShiftFormData({ ...shiftFormData, startTime: e.target.value })}
                className="block w-full rounded-lg border border-gray-300 bg-white text-gray-900 [color-scheme:light] shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Time</label>
              <input
                type="time"
                required
                value={shiftFormData.endTime}
                onChange={(e) => setShiftFormData({ ...shiftFormData, endTime: e.target.value })}
                className="block w-full rounded-lg border border-gray-300 bg-white text-gray-900 [color-scheme:light] shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (Optional)</label>
            <textarea
              value={shiftFormData.description}
              onChange={(e) => setShiftFormData({ ...shiftFormData, description: e.target.value })}
              className="block w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5"
              rows={3}
              placeholder="Additional details about this shift..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700 mt-4">
            <button type="button" onClick={() => setShowShiftForm(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm">
              {saving ? "Saving..." : "Save Shift"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
