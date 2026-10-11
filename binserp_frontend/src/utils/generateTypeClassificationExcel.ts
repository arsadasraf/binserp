import * as XLSX from 'xlsx';

export interface TypeClassificationExportOptions {
  plan?: any;
  activeTypeTab: 'rm' | 'bo' | 'component' | 'subassembly' | 'assembly';
  isBucketView?: boolean;
  items?: any[];
  buckets?: any[];
  isSubsetSelected?: boolean;
}

/**
 * Exports the active Type Classification list (or Purchase Buckets) to an Excel spreadsheet.
 * Respects active column filters, search keywords, shortages toggles, and selection checkboxes.
 *
 * Adheres strictly to AGENTS.md:
 * Prominently presents Item Name and Technical Description, avoiding raw codes as primary identifiers.
 */
export function generateTypeClassificationExcel({
  plan,
  activeTypeTab,
  isBucketView = false,
  items = [],
  buckets = [],
  isSubsetSelected = false
}: TypeClassificationExportOptions) {
  const wb = XLSX.utils.book_new();

  const planNumber = plan?.mrpNumber || 'All-Plans';
  const customerName = plan?.customerName || plan?.customerPOs?.[0]?.customerName || 'Internal Demand';
  const customerPo = plan?.customerPoNumber || plan?.customerPOs?.map((p: any) => p.customerPoNumber).filter(Boolean).join(', ') || '-';
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);

  const typeLabels: Record<string, string> = {
    rm: 'Raw Materials (RM)',
    bo: 'Bought-Outs (BO)',
    component: 'Components',
    subassembly: 'Sub-Assemblies',
    assembly: 'Assemblies'
  };

  const typeTitle = typeLabels[activeTypeTab] || 'Materials';

  if (isBucketView) {
    // -------------------------------------------------------------
    // Purchase Buckets View
    // -------------------------------------------------------------
    const bucketRows = buckets.map((b: any, idx: number) => {
      const grossReq = Number(b.grossRequired ?? b.totalRequired ?? b.requiredQuantity ?? 0);
      const liveStock = Number(b.currentPhysicalStock ?? 0);
      const inTransit = Number(b.totalInTransitPO ?? 0);
      const shortage = Number(b.netShortage ?? Math.max(0, grossReq - liveStock - inTransit));
      const rate = Number(b.bestVendor?.rate ?? b.rate ?? 0);
      const shortageVal = Math.round(shortage * rate * 100) / 100;
      const poNum = b.poNumbers && Array.isArray(b.poNumbers) && b.poNumbers.length > 0 
        ? b.poNumbers.join(', ') 
        : (b.poNumber || '-');
      const vendorName = b.bestVendor?.vendorName || b.bestVendor?.name || '-';
      const status = b.status || 'Pending';

      const containedCutSizes = b.sourceCutSizes || b.mappedItems || [];
      const containedSummary = containedCutSizes
        .map((cs: any) => `${cs.sourceItemName || cs.materialName} (${cs.grossRequired || 0} ${b.unit})`)
        .join('; ');

      return {
        'S.No': idx + 1,
        'Commercial Purchase Item (Bucket)': b.targetPurchaseItemName || b.materialName || 'Commercial Item',
        'Technical Description': b.targetPurchaseItemDescription || b.description || '-',
        'Category': b.targetPurchaseItemCategory || b.category || typeTitle,
        'Unit': b.unit || 'PCS',
        'Consolidated Gross Demand': grossReq,
        'Bucket Live Stock': liveStock,
        'In-Transit PO Qty': inTransit,
        'Net Shortage (To Buy)': shortage,
        'Preferred Supplier': vendorName,
        'Unit Rate (₹)': rate > 0 ? rate : '-',
        'Est. Shortage Value (₹)': shortageVal > 0 ? shortageVal : 0,
        'Status': status,
        'PO Numbers': poNum,
        'Contained Cut Sizes Count': containedCutSizes.length,
        'Contained Cut Sizes Breakdown': containedSummary || '-'
      };
    });

    const wsBuckets = XLSX.utils.json_to_sheet(bucketRows);
    wsBuckets['!cols'] = [
      { wch: 6 },  // S.No
      { wch: 32 }, // Purchase Item
      { wch: 36 }, // Description
      { wch: 18 }, // Category
      { wch: 8 },  // Unit
      { wch: 16 }, // Gross Demand
      { wch: 16 }, // Live Stock
      { wch: 16 }, // In-Transit
      { wch: 16 }, // Shortage
      { wch: 24 }, // Supplier
      { wch: 12 }, // Rate
      { wch: 18 }, // Value
      { wch: 14 }, // Status
      { wch: 20 }, // PO
      { wch: 14 }, // Cut Sizes Count
      { wch: 45 }  // Cut Sizes Summary
    ];

    const sheetName = `${typeTitle.slice(0, 20)} Buckets`;
    XLSX.utils.book_append_sheet(wb, wsBuckets, sheetName);

    const safePlanNum = planNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeType = activeTypeTab.toUpperCase();
    const suffix = isSubsetSelected ? 'Selected' : 'Filtered';
    const filename = `${safePlanNum}_${safeType}_Buckets_${suffix}_${dateStr}.xlsx`;
    XLSX.writeFile(wb, filename);
    return;
  }

  // -------------------------------------------------------------
  // Standard Items / Cut Sizes View
  // -------------------------------------------------------------
  const itemRows = items.map((item: any, idx: number) => {
    const grossReq = Number(item.grossRequired ?? item.totalRequired ?? item.requiredQuantity ?? 0);
    const liveStock = Number(item.currentPhysicalStock ?? 0);
    const inTransit = Number(item.totalInTransitPO ?? 0);
    const shortage = Number(item.netShortage ?? Math.max(0, grossReq - liveStock - inTransit));
    const rate = Number(item.bestVendor?.rate ?? item.rate ?? 0);
    const shortageVal = Math.round(shortage * rate * 100) / 100;
    const poNum = item.poNumber || (Array.isArray(item.poNumbers) ? item.poNumbers.join(', ') : '') || '-';
    const vendorName = item.bestVendor?.vendorName || item.bestVendor?.name || '-';
    const remark = item.materialPlanningStatus || (shortage === 0 ? 'Stock Covered' : 'Not Planned');
    const status = item.status || 'Pending';

    const hasDualUnit = Boolean(item.hasSecondaryUnit && item.secondaryUnit && Number(item.conversionFactor) > 0);
    const convFactor = Number(item.conversionFactor) || 1;
    const secGross = hasDualUnit ? parseFloat((grossReq * convFactor).toFixed(2)) : '-';
    const secShortage = hasDualUnit ? parseFloat((shortage * convFactor).toFixed(2)) : '-';

    const demandedInList = Array.isArray(item.mrpSources) && item.mrpSources.length > 0
      ? item.mrpSources.map((s: any) => s.mrpNumber || s).join(', ')
      : (item.parentMRP || planNumber);

    return {
      'S.No': idx + 1,
      'Item Name': item.materialName || item.name || '-',
      'Technical Description': item.description || item.descriptions || '-',
      'Classification': typeTitle,
      'Category': item.category || '-',
      'Primary Unit': item.unit || 'PCS',
      'Gross Required': grossReq,
      'Live Physical Stock': liveStock,
      'In-Transit PO Qty': inTransit,
      'True Net Shortage': shortage,
      'Secondary Unit': hasDualUnit ? item.secondaryUnit : '-',
      'Secondary Gross': secGross,
      'Secondary Shortage': secShortage,
      'Preferred Supplier': vendorName,
      'Unit Rate (₹)': rate > 0 ? rate : '-',
      'Est. Shortage Value (₹)': shortageVal > 0 ? shortageVal : 0,
      'Planning Remark': remark,
      'PO Number': poNum,
      'BOM Status': status,
      'Demanded In (MRPs)': demandedInList
    };
  });

  const wsItems = XLSX.utils.json_to_sheet(itemRows);
  wsItems['!cols'] = [
    { wch: 6 },  // S.No
    { wch: 32 }, // Item Name
    { wch: 36 }, // Description
    { wch: 18 }, // Classification
    { wch: 18 }, // Category
    { wch: 8 },  // Unit
    { wch: 14 }, // Gross Required
    { wch: 16 }, // Live Stock
    { wch: 16 }, // In-Transit
    { wch: 16 }, // Net Shortage
    { wch: 10 }, // Sec Unit
    { wch: 14 }, // Sec Gross
    { wch: 14 }, // Sec Shortage
    { wch: 24 }, // Supplier
    { wch: 12 }, // Rate
    { wch: 18 }, // Value
    { wch: 18 }, // Remark
    { wch: 20 }, // PO Number
    { wch: 14 }, // Status
    { wch: 26 }  // Demanded In
  ];

  const sheetName = `${typeTitle.slice(0, 24)} (Filtered)`;
  XLSX.utils.book_append_sheet(wb, wsItems, sheetName);

  const safePlanNum = planNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeType = activeTypeTab.toUpperCase();
  const suffix = isSubsetSelected ? 'Selected' : 'Filtered';
  const filename = `${safePlanNum}_${safeType}_${suffix}_${dateStr}.xlsx`;
  XLSX.writeFile(wb, filename);
}
