"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Plus, Trash2, Package, User, Calendar, Hash, FileText, 
  Truck, Calculator, Layers, Sparkles, Check, ArrowRight, ShieldCheck, 
  Info, Percent, Search, AlertCircle, Wrench, Clock, Link2, Unlink, Lock
} from 'lucide-react';
import SearchableSelect from '../SearchableSelect';
import { formatItemSelectLabel, getItemDescription, ItemNameAndDescription } from '@/src/utils/itemDisplayHelper';
import { apiGet, apiPost, apiPut } from '@/src/lib/api';

const COMMON_PROCESSES = [
  "CNC Machining / Milling",
  "Heat Treatment & Annealing",
  "Powder Coating & Painting",
  "Zinc / Chrome / Nickel Plating",
  "Anodizing (Hard / Natural)",
  "Surface Grinding & Lapping",
  "Laser Cutting & CNC Bending",
  "TIG / MIG Welding & Fabrication",
  "Shot Blasting & Sanding",
  "Wire EDM & Spark Erosion",
  "Assembly & Testing"
];

interface JobWorkLineItem {
  id: string;
  material?: string;
  materialName: string;
  description: string;
  processType: string;
  processNote?: string;
  sacCode: string;
  quantity: number;
  unit: string;
  hasSecondaryUnit: boolean;
  secondaryUnit: string;
  conversionFactor: number;
  secondaryQuantity: number;
  selectedUnit: string;
  rateUnit: 'primary' | 'secondary';
  rate: number;
  taxRate: number;
  amount: number;
}

interface JobWorkPOModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vendors?: any[];
  materials?: any[];
  inHouseItems?: any[];
  initialData?: any;
  isEditing?: boolean;
}

export default function JobWorkPOModal({
  isOpen,
  onClose,
  onSuccess,
  vendors = [],
  materials = [],
  inHouseItems = [],
  initialData,
  isEditing = false
}: JobWorkPOModalProps) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

  // Form States
  const [poNumber, setPoNumber] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>('');
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [selectedVendorObj, setSelectedVendorObj] = useState<any>(null);
  const [processType, setProcessType] = useState<string>(COMMON_PROCESSES[0]);
  const [sacCode, setSacCode] = useState<string>('9988');
  const [gstType, setGstType] = useState<'intra_state' | 'inter_state'>('intra_state');
  const [transportType, setTransportType] = useState<string>('Road Freight');
  const [transportCharge, setTransportCharge] = useState<number>(0);
  const [isTransportationTaxable, setIsTransportationTaxable] = useState<boolean>(true);
  const [packingType, setPackingType] = useState<string>('Standard Packaging');
  const [packingCharge, setPackingCharge] = useState<number>(0);
  const [isPackingTaxable, setIsPackingTaxable] = useState<boolean>(true);
  const [remarks, setRemarks] = useState<string>('');

  // Linked Job Work Challan States
  const [allChallans, setAllChallans] = useState<any[]>([]);
  const [loadingChallans, setLoadingChallans] = useState<boolean>(false);
  const [selectedChallanId, setSelectedChallanId] = useState<string>('');
  const [selectedChallanNumber, setSelectedChallanNumber] = useState<string>('');

  // Line Items
  const [items, setItems] = useState<JobWorkLineItem[]>([
    {
      id: 'jw-item-1',
      materialName: '',
      description: '',
      processType: COMMON_PROCESSES[0],
      processNote: '',
      sacCode: '9988',
      quantity: 1,
      unit: 'PCS',
      hasSecondaryUnit: false,
      secondaryUnit: '',
      conversionFactor: 1,
      secondaryQuantity: 0,
      selectedUnit: 'PCS',
      rateUnit: 'primary',
      rate: 0,
      taxRate: 18,
      amount: 0
    }
  ]);

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const isChallanLinked = Boolean(selectedChallanId || selectedChallanNumber);

  // Fetch all Job Work Challans when modal opens
  useEffect(() => {
    if (!isOpen || !token) return;
    let isMounted = true;
    const fetchChallans = async () => {
      setLoadingChallans(true);
      try {
        const res = await apiGet('/api/store/jobwork/all', token);
        const list = Array.isArray(res?.challans)
          ? res.challans
          : Array.isArray(res?.data)
          ? res.data
          : [];
        if (isMounted) setAllChallans(list);
      } catch (err) {
        console.warn('Failed to fetch Job Work Challans:', err);
      } finally {
        if (isMounted) setLoadingChallans(false);
      }
    };
    fetchChallans();
    return () => {
      isMounted = false;
    };
  }, [isOpen, token]);

  // Combine items for selector: Raw Materials, Bought Outs, FG items
  const allSelectableItems = useMemo(() => {
    const combined: any[] = [];
    const seen = new Set<string>();

    [...materials, ...inHouseItems].forEach(it => {
      const id = it._id || it.id;
      if (id && !seen.has(String(id))) {
        seen.add(String(id));
        combined.push(it);
      }
    });

    return combined;
  }, [materials, inHouseItems]);

  const itemOptions = useMemo(() => {
    return allSelectableItems.map(it => ({
      value: it._id || it.id,
      label: formatItemSelectLabel(it)
    }));
  }, [allSelectableItems]);

  // Vendor options
  const vendorOptions = useMemo(() => {
    return vendors.map(v => {
      const id = v._id || v.id;
      const name = v.name || v.vendorName || 'Vendor';
      const city = v.address?.city || v.city || '';
      return {
        value: id,
        label: city ? `${name} (${city})` : name
      };
    });
  }, [vendors]);

  // Filter Job Work Challans belonging to the selected vendor
  const vendorChallans = useMemo(() => {
    if (!selectedVendorId) return [];
    const selectedVendorName = (selectedVendorObj?.name || selectedVendorObj?.vendorName || '').trim().toLowerCase();
    return allChallans.filter(c => {
      const cVendorId = c.vendor?._id || c.vendor?.id || (typeof c.vendor === 'string' ? c.vendor : '');
      if (cVendorId && String(cVendorId) === String(selectedVendorId)) return true;
      const cVendorName = (c.vendor?.name || c.vendorName || '').trim().toLowerCase();
      return Boolean(selectedVendorName && cVendorName && cVendorName === selectedVendorName);
    });
  }, [allChallans, selectedVendorId, selectedVendorObj]);

  const challanOptions = useMemo(() => {
    return vendorChallans.map(c => {
      const id = String(c._id || c.id);
      const dateStr = c.date ? new Date(c.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
      const itemCount = Array.isArray(c.items) ? c.items.length : 0;
      const proc = c.processType || (c.items?.[0]?.processType) || 'Job Work';
      const existingPoTag = c.poNumber ? ` • Linked PO: ${c.poNumber}` : '';
      return {
        value: id,
        label: `${c.challanNumber}${dateStr ? ` (${dateStr})` : ''} — ${proc} • ${itemCount} item${itemCount === 1 ? '' : 's'}${existingPoTag}`
      };
    });
  }, [vendorChallans]);

  // Process type options for SearchableSelect
  const processOptions = useMemo(() => {
    return COMMON_PROCESSES.map(p => ({
      value: p,
      label: p
    }));
  }, []);

  // Populate line items from a selected Job Work Challan
  const handleSelectChallan = (challanId: string) => {
    if (!challanId) {
      handleUnlinkChallan();
      return;
    }
    const challan = allChallans.find(c => String(c._id || c.id) === String(challanId));
    if (!challan) return;

    setSelectedChallanId(String(challan._id || challan.id));
    setSelectedChallanNumber(challan.challanNumber || '');

    const headerProc = challan.processType || challan.items?.[0]?.processType || processType || COMMON_PROCESSES[0];
    if (headerProc) {
      setProcessType(headerProc);
    }
    if (challan.expectedReturnDate && !expectedDeliveryDate) {
      setExpectedDeliveryDate(new Date(challan.expectedReturnDate).toISOString().slice(0, 10));
    }

    const defaultSac = sacCode || '9988';
    const rawItems: any[] = Array.isArray(challan.items) && challan.items.length > 0
      ? challan.items
      : [];

    if (rawItems.length > 0) {
      const mappedItems: JobWorkLineItem[] = rawItems.map((cItem: any, idx: number) => {
        const itemId = cItem.item?._id || cItem.item || undefined;
        const matchedMaster = itemId
          ? allSelectableItems.find(m => String(m._id || m.id) === String(itemId))
          : allSelectableItems.find(
              m => (m.name || '').trim().toLowerCase() === (cItem.itemName || '').trim().toLowerCase()
            );

        const matName = cItem.itemName || cItem.materialName || matchedMaster?.name || 'Job Work Item';
        const desc =
          cItem.description ||
          cItem.item?.descriptions ||
          cItem.item?.description ||
          (matchedMaster ? getItemDescription(matchedMaster) : '') ||
          cItem.remarks ||
          '';
        const itemProc = cItem.processType || headerProc || COMMON_PROCESSES[0];
        const priQty = Number(cItem.quantitySent ?? cItem.quantity ?? 1) || 1;
        const priUnit = (cItem.unit || matchedMaster?.unit || 'PCS').trim();

        const hasSec = Boolean(
          cItem.hasSecondaryUnit ||
          (cItem.secondaryUnit && (Number(cItem.secondaryQuantitySent) > 0 || Number(cItem.conversionFactor) > 0)) ||
          matchedMaster?.hasSecondaryUnit ||
          (matchedMaster?.secondaryUnit && Number(matchedMaster?.conversionFactor) > 0)
        );
        const secUnit = hasSec ? String(cItem.secondaryUnit || matchedMaster?.secondaryUnit || '').trim() : '';
        const convFactor = Number(cItem.conversionFactor || matchedMaster?.conversionFactor || 1) || 1;
        const secQty = hasSec
          ? (Number(cItem.secondaryQuantitySent || 0) > 0
              ? Number(cItem.secondaryQuantitySent)
              : Number((priQty * convFactor).toFixed(3)))
          : 0;

        // Default to the exact unit selected when the DC was created
        const dcUnit = (cItem.selectedUnit || '').trim();
        const isSecSelected = Boolean(hasSec && secUnit && dcUnit.toLowerCase() === secUnit.toLowerCase());
        const selectedUnit = isSecSelected ? secUnit : priUnit;
        const rateUnit: 'primary' | 'secondary' = isSecSelected ? 'secondary' : 'primary';
        const activeQty = isSecSelected ? secQty : priQty;

        const rate = Number(cItem.processRate ?? cItem.rate ?? 0) || 0;

        return {
          id: `jw-challan-item-${idx}-${Date.now()}`,
          material: itemId ? String(itemId) : (matchedMaster?._id ? String(matchedMaster._id) : undefined),
          materialName: matName,
          description: desc,
          processType: itemProc,
          processNote: cItem.remarks || '',
          sacCode: cItem.sacCode || defaultSac,
          quantity: priQty,
          unit: priUnit,
          hasSecondaryUnit: hasSec && Boolean(secUnit),
          secondaryUnit: secUnit,
          conversionFactor: convFactor,
          secondaryQuantity: secQty,
          selectedUnit,
          rateUnit,
          rate,
          taxRate: 18,
          amount: Number((activeQty * rate).toFixed(2))
        };
      });
      setItems(mappedItems);
    }
  };

  const handleUnlinkChallan = () => {
    setSelectedChallanId('');
    setSelectedChallanNumber('');
  };

  // Initialize or Reset
  useEffect(() => {
    if (initialData && isEditing) {
      setPoNumber(initialData.poNumber || '');
      setDate(initialData.date ? new Date(initialData.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
      setExpectedDeliveryDate(initialData.expectedDeliveryDate ? new Date(initialData.expectedDeliveryDate).toISOString().slice(0, 10) : '');
      const vId = initialData.vendor?._id || initialData.vendor || '';
      setSelectedVendorId(vId);
      const vObj = vendors.find(v => (v._id || v.id) === vId) || initialData.vendor;
      setSelectedVendorObj(vObj);
      setProcessType(initialData.processType || COMMON_PROCESSES[0]);
      setSacCode(initialData.sacCode || '9988');
      setGstType(initialData.gstType || 'intra_state');
      setTransportCharge(Number(initialData.transportCharge) || 0);
      setIsTransportationTaxable(initialData.isTransportationTaxable !== undefined ? Boolean(initialData.isTransportationTaxable) : true);
      setPackingCharge(Number(initialData.packingCharge) || 0);
      setIsPackingTaxable(initialData.isPackingTaxable !== undefined ? Boolean(initialData.isPackingTaxable) : true);
      setRemarks(initialData.remarks || initialData.description || '');
      setSelectedChallanId(initialData.jobWorkChallan?._id || initialData.jobWorkChallan || '');
      setSelectedChallanNumber(initialData.challanNumber || initialData.jobWorkChallan?.challanNumber || '');

      if (Array.isArray(initialData.items) && initialData.items.length > 0) {
        setItems(initialData.items.map((it: any, idx: number) => {
          const matId = it.material?._id || it.material || undefined;
          const matchedMaster = matId
            ? allSelectableItems.find(m => String(m._id || m.id) === String(matId))
            : undefined;
          const priUnit = (it.unit || matchedMaster?.unit || 'PCS').trim();
          const priQty = Number(it.quantity) || 1;
          const hasSec = Boolean(
            it.hasSecondaryUnit ||
            (it.secondaryUnit && (Number(it.secondaryQuantity) > 0 || Number(it.conversionFactor) > 0)) ||
            matchedMaster?.hasSecondaryUnit ||
            (matchedMaster?.secondaryUnit && Number(matchedMaster?.conversionFactor) > 0)
          );
          const secUnit = hasSec ? String(it.secondaryUnit || matchedMaster?.secondaryUnit || '').trim() : '';
          const convFactor = Number(it.conversionFactor || matchedMaster?.conversionFactor || 1) || 1;
          const secQty = hasSec
            ? (Number(it.secondaryQuantity || 0) > 0 ? Number(it.secondaryQuantity) : Number((priQty * convFactor).toFixed(3)))
            : 0;
          const isSec = Boolean(
            hasSec &&
            secUnit &&
            (it.rateUnit === 'secondary' || (it.selectedUnit && String(it.selectedUnit).toLowerCase() === secUnit.toLowerCase()))
          );
          const selectedUnit = isSec ? secUnit : priUnit;
          const rateUnit: 'primary' | 'secondary' = isSec ? 'secondary' : 'primary';
          const activeQty = isSec ? secQty : priQty;
          const rate = Number(it.rate) || 0;

          return {
            id: `jw-item-${idx}-${Date.now()}`,
            material: matId,
            materialName: it.materialName || it.material?.name || '',
            description: it.description || it.descriptions || it.material?.descriptions || '',
            processType: it.processType || initialData.processType || COMMON_PROCESSES[0],
            processNote: it.processNote || '',
            sacCode: it.sacCode || it.hsnCode || initialData.sacCode || '9988',
            quantity: priQty,
            unit: priUnit,
            hasSecondaryUnit: hasSec && Boolean(secUnit),
            secondaryUnit: secUnit,
            conversionFactor: convFactor,
            secondaryQuantity: secQty,
            selectedUnit,
            rateUnit,
            rate,
            taxRate: it.taxRate != null ? Number(it.taxRate) : 18,
            amount: Number(it.amount) || Number((activeQty * rate).toFixed(2))
          };
        }));
      }
    } else {
      // Auto-generate PO number
      const now = new Date();
      const yr = now.getFullYear().toString().slice(-2);
      const mo = String(now.getMonth() + 1).padStart(2, '0');
      const rand = Math.floor(1000 + Math.random() * 9000);
      setPoNumber(`JW-PO-${yr}${mo}-${rand}`);
      setDate(new Date().toISOString().slice(0, 10));
      const exp = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
      setExpectedDeliveryDate(exp.toISOString().slice(0, 10));
      setSelectedVendorId('');
      setSelectedVendorObj(null);
      setSelectedChallanId('');
      setSelectedChallanNumber('');
      setProcessType(COMMON_PROCESSES[0]);
      setSacCode('9988');
      setGstType('intra_state');
      setTransportCharge(0);
      setIsTransportationTaxable(true);
      setPackingCharge(0);
      setIsPackingTaxable(true);
      setRemarks('');
      setItems([
        {
          id: 'jw-item-1',
          materialName: '',
          description: '',
          processType: COMMON_PROCESSES[0],
          processNote: '',
          sacCode: '9988',
          quantity: 1,
          unit: 'PCS',
          hasSecondaryUnit: false,
          secondaryUnit: '',
          conversionFactor: 1,
          secondaryQuantity: 0,
          selectedUnit: 'PCS',
          rateUnit: 'primary',
          rate: 0,
          taxRate: 18,
          amount: 0
        }
      ]);
    }
    setErrorMessage('');
  }, [initialData, isEditing, isOpen, vendors]);

  // Match challan ID if editing a PO that only had challanNumber or poNumber link
  useEffect(() => {
    if (!isOpen || !isEditing || allChallans.length === 0) return;
    if (!selectedChallanId && selectedChallanNumber) {
      const found = allChallans.find(c => c.challanNumber === selectedChallanNumber);
      if (found) setSelectedChallanId(String(found._id || found.id));
    } else if (!selectedChallanId && !selectedChallanNumber && poNumber) {
      const foundByPo = allChallans.find(c => c.poNumber === poNumber);
      if (foundByPo) {
        setSelectedChallanId(String(foundByPo._id || foundByPo.id));
        setSelectedChallanNumber(foundByPo.challanNumber || '');
      }
    }
  }, [isOpen, isEditing, allChallans, selectedChallanId, selectedChallanNumber, poNumber]);

  // Update item line
  const handleUpdateItem = (index: number, field: keyof JobWorkLineItem, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      if (field === 'quantity') {
        const priQty = Number(value) || 0;
        item.quantity = priQty;
        if (item.hasSecondaryUnit && item.conversionFactor > 0) {
          item.secondaryQuantity = Number((priQty * item.conversionFactor).toFixed(3));
        }
        const activeQty = item.rateUnit === 'secondary' && item.hasSecondaryUnit ? item.secondaryQuantity : item.quantity;
        item.amount = Number((activeQty * (Number(item.rate) || 0)).toFixed(2));
      } else if (field === 'secondaryQuantity') {
        const secQty = Number(value) || 0;
        item.secondaryQuantity = secQty;
        if (item.hasSecondaryUnit && item.conversionFactor > 0) {
          item.quantity = Number((secQty / item.conversionFactor).toFixed(3));
        }
        const activeQty = item.rateUnit === 'secondary' && item.hasSecondaryUnit ? item.secondaryQuantity : item.quantity;
        item.amount = Number((activeQty * (Number(item.rate) || 0)).toFixed(2));
      } else if (field === 'rate') {
        const rate = Number(value) || 0;
        const activeQty = item.rateUnit === 'secondary' && item.hasSecondaryUnit ? (Number(item.secondaryQuantity) || 0) : (Number(item.quantity) || 0);
        item.amount = Number((activeQty * rate).toFixed(2));
      }

      updated[index] = item;
      return updated;
    });
  };

  // Switch between Primary Unit and Secondary Unit on a line item
  const handleUnitSwitch = (index: number, newSelectedUnit: string) => {
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index] };
      const isSec = Boolean(item.hasSecondaryUnit && item.secondaryUnit && newSelectedUnit === item.secondaryUnit);
      item.selectedUnit = isSec ? item.secondaryUnit : item.unit;
      item.rateUnit = isSec ? 'secondary' : 'primary';

      const activeQty = isSec ? (Number(item.secondaryQuantity) || 0) : (Number(item.quantity) || 0);
      item.amount = Number((activeQty * (Number(item.rate) || 0)).toFixed(2));

      updated[index] = item;
      return updated;
    });
  };

  // Sync header SAC code to all items when changed
  const handleHeaderSacChange = (newSac: string) => {
    setSacCode(newSac);
    setItems(prev => prev.map(it => ({ ...it, sacCode: newSac })));
  };

  // Select Item from master
  const handleSelectItem = (index: number, itemId: string) => {
    const selected = allSelectableItems.find(it => (it._id || it.id) === itemId);
    if (!selected) return;

    const name = selected.name || selected.materialName || 'Item';
    const desc = getItemDescription(selected);
    const priUnit = (selected.unit || 'PCS').trim();
    const hasSec = Boolean(selected.hasSecondaryUnit || (selected.secondaryUnit && Number(selected.conversionFactor) > 0));
    const secUnit = hasSec ? String(selected.secondaryUnit || '').trim() : '';
    const convFactor = Number(selected.conversionFactor || 1) || 1;

    setItems(prev => {
      const updated = [...prev];
      const currentQty = Number(updated[index].quantity) || 1;
      const secQty = hasSec ? Number((currentQty * convFactor).toFixed(3)) : 0;
      const rate = Number(updated[index].rate) || 0;
      updated[index] = {
        ...updated[index],
        material: selected._id || selected.id,
        materialName: name,
        description: desc,
        unit: priUnit,
        hasSecondaryUnit: hasSec && Boolean(secUnit),
        secondaryUnit: secUnit,
        conversionFactor: convFactor,
        secondaryQuantity: secQty,
        selectedUnit: priUnit,
        rateUnit: 'primary',
        amount: Number((currentQty * rate).toFixed(2))
      };
      return updated;
    });
  };

  // Add Item Line
  const handleAddItem = () => {
    const finalProcess = processType || COMMON_PROCESSES[0];
    setItems(prev => [
      ...prev,
      {
        id: `jw-item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        materialName: '',
        description: '',
        processType: finalProcess,
        processNote: '',
        sacCode: sacCode || '9988',
        quantity: 1,
        unit: 'PCS',
        hasSecondaryUnit: false,
        secondaryUnit: '',
        conversionFactor: 1,
        secondaryQuantity: 0,
        selectedUnit: 'PCS',
        rateUnit: 'primary',
        rate: 0,
        taxRate: 18,
        amount: 0
      }
    ]);
  };

  // Insert Item Line Below specific row
  const handleInsertItemBelow = (index: number) => {
    const finalProcess = processType || COMMON_PROCESSES[0];
    const newItem: JobWorkLineItem = {
      id: `jw-item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      materialName: '',
      description: '',
      processType: finalProcess,
      processNote: '',
      sacCode: sacCode || '9988',
      quantity: 1,
      unit: 'PCS',
      hasSecondaryUnit: false,
      secondaryUnit: '',
      conversionFactor: 1,
      secondaryQuantity: 0,
      selectedUnit: 'PCS',
      rateUnit: 'primary',
      rate: 0,
      taxRate: 18,
      amount: 0
    };
    setItems(prev => {
      const copy = [...prev];
      copy.splice(index + 1, 0, newItem);
      return copy;
    });
  };

  // Bulk Apply Header Process to All Line Items
  const handleApplyProcessToAll = () => {
    const finalProcess = processType || COMMON_PROCESSES[0];
    if (!finalProcess) return;
    setItems(prev => prev.map(it => ({ ...it, processType: finalProcess })));
  };

  // Remove Item Line
  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Totals calculation
  const subtotal = useMemo(() => {
    return items.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);
  }, [items]);

  const taxAmount = useMemo(() => {
    const itemsTax = items.reduce((acc, it) => {
      const amt = Number(it.amount) || 0;
      const tRate = it.taxRate != null ? Number(it.taxRate) : 18;
      return acc + (amt * (tRate / 100));
    }, 0);
    const avgTaxRate = items.length > 0 ? (items[0].taxRate ?? 18) : 18;
    const taxableTransport = isTransportationTaxable ? Number(transportCharge || 0) * (avgTaxRate / 100) : 0;
    const taxablePacking = isPackingTaxable ? Number(packingCharge || 0) * (avgTaxRate / 100) : 0;
    return Number((itemsTax + taxableTransport + taxablePacking).toFixed(2));
  }, [items, transportCharge, packingCharge, isTransportationTaxable, isPackingTaxable]);

  const cgstAmount = gstType === 'intra_state' ? Number((taxAmount / 2).toFixed(2)) : 0;
  const sgstAmount = gstType === 'intra_state' ? Number((taxAmount / 2).toFixed(2)) : 0;
  const igstAmount = gstType === 'inter_state' ? taxAmount : 0;

  const grandTotal = useMemo(() => {
    return Number((subtotal + Number(transportCharge || 0) + Number(packingCharge || 0) + taxAmount).toFixed(2));
  }, [subtotal, transportCharge, packingCharge, taxAmount]);

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!poNumber.trim()) {
      setErrorMessage('PO Number is required');
      return;
    }

    if (!selectedVendorId) {
      setErrorMessage('Please select a subcontractor / vendor');
      return;
    }

    const validItems = items.filter(it => it.materialName.trim() && it.quantity > 0);
    if (validItems.length === 0) {
      setErrorMessage('Please add at least one valid item with name and quantity');
      return;
    }

    const finalProcess = processType || COMMON_PROCESSES[0];
    const headerTaxRate = validItems[0]?.taxRate ?? 18;

    const payload = {
      poNumber: poNumber.trim(),
      poType: 'jobwork',
      jobWorkChallan: selectedChallanId || null,
      challanNumber: selectedChallanNumber || '',
      date: date || new Date(),
      expectedDeliveryDate: expectedDeliveryDate || undefined,
      vendor: selectedVendorId,
      vendorName: selectedVendorObj?.name || selectedVendorObj?.vendorName || '',
      processType: finalProcess,
      sacCode: sacCode || '9988',
      gstType,
      taxRate: headerTaxRate,
      cgstRate: gstType === 'intra_state' ? headerTaxRate / 2 : 0,
      sgstRate: gstType === 'intra_state' ? headerTaxRate / 2 : 0,
      igstRate: gstType === 'inter_state' ? headerTaxRate : 0,
      cgstAmount,
      sgstAmount,
      igstAmount,
      transportType,
      transportCharge,
      isTransportationTaxable,
      transportationTaxRate: isTransportationTaxable ? headerTaxRate : 0,
      transportationTaxAmount: isTransportationTaxable ? Number(((Number(transportCharge || 0) * (headerTaxRate / 100))).toFixed(2)) : 0,
      packingType,
      packingCharge,
      isPackingTaxable,
      packingTaxRate: isPackingTaxable ? headerTaxRate : 0,
      packingTaxAmount: isPackingTaxable ? Number(((Number(packingCharge || 0) * (headerTaxRate / 100))).toFixed(2)) : 0,
      subtotal,
      totalTax: taxAmount,
      grandTotal,
      remarks: remarks.trim(),
      items: validItems.map(it => ({
        material: it.material,
        materialName: it.materialName,
        description: it.description,
        processType: it.processType || finalProcess,
        processNote: it.processNote,
        sacCode: it.sacCode || sacCode || '9988',
        hsnCode: it.sacCode || sacCode || '9988',
        quantity: it.quantity,
        unit: it.unit,
        hasSecondaryUnit: it.hasSecondaryUnit,
        secondaryUnit: it.secondaryUnit,
        conversionFactor: it.conversionFactor,
        secondaryQuantity: it.secondaryQuantity,
        selectedUnit: it.selectedUnit || it.unit,
        rateUnit: it.rateUnit || 'primary',
        rate: it.rate,
        taxRate: it.taxRate != null ? Number(it.taxRate) : 18,
        amount: it.amount
      }))
    };

    setLoading(true);
    try {
      if (isEditing && initialData?._id) {
        await apiPut(`/api/purchase/po/${initialData._id}`, payload, token);
      } else {
        await apiPost('/api/purchase/po', payload, token);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save Job Work PO');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 lg:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[1550px] max-h-[94vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-indigo-50/70 to-blue-50/70 dark:from-slate-800/80 dark:to-slate-800/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-500/25 shrink-0">
              <Wrench size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                <span>{isEditing ? 'Edit Job Work Outward PO' : 'New Job Work Outward PO'}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  SAC {sacCode || '9988'}
                </span>
                {selectedChallanNumber && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <Link2 size={11} />
                    <span>Linked Challan: {selectedChallanNumber}</span>
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Select a Vendor Job Work Challan to auto-fetch items, quantities, UOM & process, or create manually
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer active:scale-95"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form Body (Scrollable) */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          
          {/* Top Section: PO Number, Date, Vendor & Expected Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* PO Number */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                PO Number <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={poNumber}
                  onChange={e => setPoNumber(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>

            {/* PO Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                PO Date
              </label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Expected Delivery Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Expected Delivery Date
              </label>
              <div className="relative">
                <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={expectedDeliveryDate}
                  onChange={e => setExpectedDeliveryDate(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Subcontractor / Vendor */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Job Worker / Vendor <span className="text-rose-500">*</span>
              </label>
              <SearchableSelect
                options={vendorOptions}
                value={selectedVendorId}
                onChange={val => {
                  setSelectedVendorId(val);
                  const found = vendors.find(v => (v._id || v.id) === val);
                  setSelectedVendorObj(found);
                  if (val !== selectedVendorId) {
                    setSelectedChallanId('');
                    setSelectedChallanNumber('');
                  }
                }}
                placeholder="Select subcontractor..."
                className="text-xs"
              />
            </div>
          </div>

          {/* Job Work Challan (DC) Selector Banner — Visible when a Vendor is selected */}
          {selectedVendorId && (
            <div className={`p-4 rounded-2xl border transition-all space-y-3 ${
              isChallanLinked
                ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/70'
                : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-700/70'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${
                    isChallanLinked
                      ? 'bg-emerald-600 text-white shadow-xs shadow-emerald-500/20'
                      : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                  }`}>
                    <FileText size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">
                        Select Job Work Challan (DC) for Vendor
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        {loadingChallans ? 'Loading Challans...' : `${vendorChallans.length} Challan${vendorChallans.length === 1 ? '' : 's'} Found`}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Selecting a Challan auto-fetches all line items with quantity, UOM & process and attaches PO <strong className="text-slate-700 dark:text-slate-200">{poNumber}</strong> to that Challan.
                    </p>
                  </div>
                </div>

                {isChallanLinked && (
                  <button
                    type="button"
                    onClick={handleUnlinkChallan}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800/70 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0 active:scale-95"
                  >
                    <Unlink size={13} />
                    <span>Unlink Challan ({selectedChallanNumber})</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                <div className="lg:col-span-8">
                  <SearchableSelect
                    options={challanOptions}
                    value={selectedChallanId}
                    onChange={val => handleSelectChallan(val)}
                    placeholder={
                      vendorChallans.length > 0
                        ? 'Search or select Job Work Challan (DC) to fetch items...'
                        : 'No Job Work Challans found for this vendor (optional)...'
                    }
                    className="text-xs"
                  />
                </div>
                <div className="lg:col-span-4 flex items-center justify-end gap-2">
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Default SAC Code:</span>
                    <input
                      type="text"
                      value={sacCode}
                      onChange={e => handleHeaderSacChange(e.target.value)}
                      placeholder="9988"
                      className="w-20 px-2 py-1 text-xs font-black text-center rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Process & Operation Row (Shown only when NOT locked to a Challan) */}
          {!isChallanLinked && (
            <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-slate-800/50 border border-indigo-100 dark:border-slate-700/60 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <label className="block text-xs font-black text-indigo-950 dark:text-indigo-200">
                      Default Process / Operation Type
                    </label>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      Auto-fills New Lines
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Select common process for newly added rows or click &quot;Apply to All&quot; below
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleApplyProcessToAll}
                    className="px-3 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 rounded-xl hover:bg-indigo-50 dark:hover:bg-slate-700 transition-all shadow-2xs active:scale-95 cursor-pointer"
                    title="Apply this process type to all item rows"
                  >
                    ⚡ Apply to All Items
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">SAC Code:</span>
                    <input
                      type="text"
                      value={sacCode}
                      onChange={e => handleHeaderSacChange(e.target.value)}
                      className="w-20 px-2 py-1 text-xs font-bold text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Searchable Dropdown for Default Process */}
              <div className="max-w-md">
                <SearchableSelect
                  options={processOptions}
                  value={processType}
                  onChange={val => setProcessType(val)}
                  allowCustom={true}
                  customActionLabel={(q) => `Use "${q}" as process`}
                  placeholder="Search or select default process type (e.g. CNC, Plating, Annealing)..."
                  className="text-xs"
                />
              </div>
            </div>
          )}

          {/* Line Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Job Work Items & Rates ({items.length})
                </h3>
                {isChallanLinked && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                    <Lock size={10} />
                    <span>Items, Qty & UOM fetched from {selectedChallanNumber} — Switch Primary/Secondary UOM or enter Price, SAC & Tax</span>
                  </span>
                )}
              </div>
              {!isChallanLinked && (
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl hover:bg-indigo-100 transition-colors cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Add Item</span>
                </button>
              )}
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-2xs">
              <table className="w-full min-w-[960px] text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3 min-w-[280px] sm:min-w-[320px]">Item Name & Technical Description</th>
                    <th className="py-2.5 px-3 min-w-[170px]">Process / Operation</th>
                    <th className="py-2.5 px-3 w-44 text-center">Qty & UOM (Pri / Sec)</th>
                    <th className="py-2.5 px-3 w-24">SAC Code</th>
                    <th className="py-2.5 px-3 w-36">Price / Rate (₹) <span className="text-rose-500">*</span></th>
                    <th className="py-2.5 px-3 w-24">GST (%)</th>
                    <th className="py-2.5 px-3 w-28 text-right">Amount (₹)</th>
                    {!isChallanLinked && (
                      <th className="py-2.5 px-2 w-14 text-center">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {items.map((item, index) => {
                    const isSecSelected = Boolean(item.hasSecondaryUnit && item.secondaryUnit && item.rateUnit === 'secondary');
                    const activeQty = isSecSelected ? item.secondaryQuantity : item.quantity;
                    const activeUnit = isSecSelected ? item.secondaryUnit : item.unit;
                    const altQty = isSecSelected ? item.quantity : item.secondaryQuantity;
                    const altUnit = isSecSelected ? item.unit : item.secondaryUnit;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-bold align-top pt-3">{index + 1}</td>
                        
                        {/* Item Selector & Name */}
                        <td className="py-2.5 px-3 min-w-[280px] sm:min-w-[320px] align-top">
                          {isChallanLinked ? (
                            <div 
                              className="p-2.5 rounded-xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 min-w-0 max-w-full"
                              title={`${item.materialName}${item.description ? `\n\nTechnical Description:\n${item.description}` : ''}`}
                            >
                              <ItemNameAndDescription
                                name={item.materialName}
                                description={item.description}
                              />
                            </div>
                          ) : (
                            <div className="w-full max-w-[340px] min-w-0 space-y-1.5">
                              <SearchableSelect
                                options={itemOptions}
                                value={item.material || ''}
                                onChange={val => handleSelectItem(index, val)}
                                placeholder="Select material / component..."
                                className="text-xs w-full min-w-0"
                                innerClassName="truncate"
                              />
                              {item.materialName && (
                                <div 
                                  className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 min-w-0 max-w-full space-y-0.5"
                                  title={`${item.materialName}${item.description ? `\n\nTechnical Description:\n${item.description}` : ''}`}
                                >
                                  <div className="font-bold text-xs text-slate-900 dark:text-white truncate block min-w-0" title={item.materialName}>
                                    {item.materialName}
                                  </div>
                                  {item.description && (
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 italic line-clamp-2 break-words min-w-0" title={item.description}>
                                      {item.description}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Process / Operation Type */}
                        <td className="py-2.5 px-3 min-w-[170px] align-top">
                          {isChallanLinked ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/50 border border-indigo-200/70 dark:border-indigo-800/70 text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                              <Wrench size={12} className="shrink-0" />
                              <span>{item.processType || processType || 'Job Work'}</span>
                            </div>
                          ) : (
                            <SearchableSelect
                              options={processOptions}
                              value={item.processType || processType || COMMON_PROCESSES[0]}
                              onChange={val => handleUpdateItem(index, 'processType', val)}
                              allowCustom={true}
                              customActionLabel={(q) => `Use "${q}" as process`}
                              placeholder="Search or type process..."
                              className="text-xs w-full min-w-0"
                              innerClassName="truncate"
                            />
                          )}
                        </td>

                        {/* Quantity & UOM (DC-fetched UOM with Primary / Secondary unit switcher) */}
                        <td className="py-2.5 px-3 align-top text-center">
                          {isChallanLinked ? (
                            <div className="flex flex-col items-center gap-1">
                              <div className="flex items-center justify-center gap-1.5 w-full">
                                <span className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-black text-xs text-slate-900 dark:text-white min-w-[54px] text-center">
                                  {activeQty}
                                </span>
                                {item.hasSecondaryUnit && item.secondaryUnit ? (
                                  <select
                                    value={activeUnit}
                                    onChange={e => handleUnitSwitch(index, e.target.value)}
                                    className="px-2 py-1.5 text-xs font-bold rounded-lg border border-indigo-300 dark:border-indigo-700 bg-indigo-50/70 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                                    title="Switch between Primary and Secondary Unit from Challan"
                                  >
                                    <option value={item.unit}>{item.unit} (Pri)</option>
                                    <option value={item.secondaryUnit}>{item.secondaryUnit} (Sec)</option>
                                  </select>
                                ) : (
                                  <span className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                                    {item.unit}
                                  </span>
                                )}
                              </div>
                              {item.hasSecondaryUnit && item.secondaryUnit && (
                                <div className="text-[10px] font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                                  ↳ = {altQty} {altUnit}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0.001"
                                  step="any"
                                  value={activeQty || ''}
                                  onChange={e =>
                                    handleUpdateItem(
                                      index,
                                      isSecSelected ? 'secondaryQuantity' : 'quantity',
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-16 px-2 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-center"
                                />
                                {item.hasSecondaryUnit && item.secondaryUnit ? (
                                  <select
                                    value={activeUnit}
                                    onChange={e => handleUnitSwitch(index, e.target.value)}
                                    className="px-1.5 py-1.5 text-xs font-bold rounded-lg border border-indigo-300 dark:border-indigo-700 bg-indigo-50/70 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 cursor-pointer"
                                  >
                                    <option value={item.unit}>{item.unit} (Pri)</option>
                                    <option value={item.secondaryUnit}>{item.secondaryUnit} (Sec)</option>
                                  </select>
                                ) : (
                                  <span className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                                    {item.unit}
                                  </span>
                                )}
                              </div>
                              {item.hasSecondaryUnit && item.secondaryUnit && (
                                <div className="text-[10px] font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                                  ↳ = {altQty} {altUnit}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* SAC Code */}
                        <td className="py-2.5 px-3 align-top">
                          <input
                            type="text"
                            value={item.sacCode ?? sacCode ?? '9988'}
                            onChange={e => handleUpdateItem(index, 'sacCode', e.target.value)}
                            placeholder="9988"
                            className="w-full px-2.5 py-1.5 text-xs font-bold text-center rounded-lg border border-indigo-200 dark:border-indigo-800/80 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </td>

                        {/* Process Rate (Price) */}
                        <td className="py-2.5 px-3 align-top">
                          <div className="relative flex items-center">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0.00"
                              value={item.rate || ''}
                              onChange={e => handleUpdateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                              className="w-full pl-2.5 pr-12 py-1.5 text-xs font-bold rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <span className="absolute right-2 text-[9px] font-bold text-slate-400 pointer-events-none">
                              /{activeUnit}
                            </span>
                          </div>
                        </td>

                        {/* GST (%) */}
                        <td className="py-2.5 px-3 align-top">
                          <select
                            value={item.taxRate ?? 18}
                            onChange={e => handleUpdateItem(index, 'taxRate', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value={0}>0%</option>
                            <option value={5}>5%</option>
                            <option value={12}>12%</option>
                            <option value={18}>18%</option>
                            <option value={28}>28%</option>
                          </select>
                        </td>

                        {/* Amount */}
                        <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-white align-top pt-3">
                          ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>

                        {/* Actions: Add Line Below & Delete */}
                        {!isChallanLinked && (
                          <td className="py-2.5 px-2 text-center align-top pt-2">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleInsertItemBelow(index)}
                                title="Add line below"
                                className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-lg transition-all active:scale-90 cursor-pointer"
                              >
                                <Plus size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(index)}
                                disabled={items.length <= 1}
                                title="Delete line"
                                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-all active:scale-90 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Financial & Terms Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            
            {/* Left: Remarks & Instructions */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Technical Instructions & Remarks
                </label>
                <textarea
                  rows={4}
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="Material supplied on Returnable DC. Subcontractor must account for scrap, return all turnings and rejected parts. Tolerance ±0.02 mm."
                  className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* GST Type Selector */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">GST Classification:</span>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="gstType"
                    checked={gstType === 'intra_state'}
                    onChange={() => setGstType('intra_state')}
                    className="text-indigo-600"
                  />
                  <span>Intra-State (CGST + SGST)</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="gstType"
                    checked={gstType === 'inter_state'}
                    onChange={() => setGstType('inter_state')}
                    className="text-indigo-600"
                  />
                  <span>Inter-State (IGST)</span>
                </label>
              </div>
            </div>

            {/* Right: Summary Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>Process Subtotal:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Transport & Packing Charges */}
              <div className="flex justify-between items-center text-xs text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span>Transport Charges:</span>
                  <button
                    type="button"
                    onClick={() => setIsTransportationTaxable(prev => !prev)}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                      isTransportationTaxable
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                    }`}
                    title={isTransportationTaxable ? 'Transport is included in GST. Click to make Non-Taxable.' : 'Transport is exempt from GST. Click to include in GST.'}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isTransportationTaxable ? 'bg-blue-600 dark:bg-blue-400' : 'bg-slate-400'}`} />
                    <span>{isTransportationTaxable ? 'Taxable' : 'Exempt'}</span>
                  </button>
                </div>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={transportCharge || ''}
                  onChange={e => setTransportCharge(parseFloat(e.target.value) || 0)}
                  className="w-24 px-2 py-1 text-xs text-right font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-between items-center text-xs text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span>Packaging Charges:</span>
                  <button
                    type="button"
                    onClick={() => setIsPackingTaxable(prev => !prev)}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                      isPackingTaxable
                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                    }`}
                    title={isPackingTaxable ? 'Packaging is included in GST. Click to make Non-Taxable.' : 'Packaging is exempt from GST. Click to include in GST.'}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isPackingTaxable ? 'bg-amber-600 dark:bg-amber-400' : 'bg-slate-400'}`} />
                    <span>{isPackingTaxable ? 'Taxable' : 'Exempt'}</span>
                  </button>
                </div>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={packingCharge || ''}
                  onChange={e => setPackingCharge(parseFloat(e.target.value) || 0)}
                  className="w-24 px-2 py-1 text-xs text-right font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              {/* GST Breakdown */}
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>
                  {gstType === 'intra_state' ? 'Total GST (CGST + SGST):' : 'Total IGST:'}
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  ₹{taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <span className="text-sm font-black text-slate-900 dark:text-white">Grand Total:</span>
                <span className="text-base font-black text-indigo-600 dark:text-indigo-400">
                  ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Submit */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-500/25 transition-all cursor-pointer flex items-center gap-2 active:scale-95"
            >
              {loading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <span>{isEditing ? 'Update Job Work PO' : 'Release Job Work PO'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
