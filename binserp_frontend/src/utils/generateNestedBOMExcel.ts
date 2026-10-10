import * as XLSX from 'xlsx';

export interface NestedBOMExportOptions {
  plan: any;
  nestedMaterials?: any[];
  classifiedLists?: {
    rmList?: any[];
    boList?: any[];
    componentList?: any[];
    subAssemblyList?: any[];
    assemblyList?: any[];
  };
}

/**
 * Generates an Excel workbook containing:
 * 1. Sheet 1: All & Multi-Level BOM Tree (with level indent and full hierarchy)
 * 2. Sheet 2: Raw Materials (RM)
 * 3. Sheet 3: Bought-Out Items (BO)
 * 4. Sheet 4: Components & Sub-Assemblies
 *
 * Adheres strictly to AGENTS.md:
 * Prominently presents Item Name and Technical Description, avoiding raw codes as primary identifiers.
 */
export function generateNestedBOMExcel({
  plan,
  nestedMaterials = [],
  classifiedLists
}: NestedBOMExportOptions) {
  const wb = XLSX.utils.book_new();

  const planNumber = plan?.mrpNumber || 'MRP-Plan';
  const customerName = plan?.customerName || 'Internal Demand';
  const customerPo = plan?.customerPoNumber || plan?.customerPOs?.map((p: any) => p.customerPoNumber).filter(Boolean).join(', ') || '-';
  const planDate = plan?.planDate || plan?.createdAt || new Date();
  const formattedDate = new Date(planDate).toLocaleDateString('en-IN');

  // -------------------------------------------------------------
  // Helper: flatten all nested items from plan.fgItems if not supplied
  // -------------------------------------------------------------
  let allTreeItems: any[] = [];
  if (nestedMaterials && nestedMaterials.length > 0) {
    allTreeItems = nestedMaterials;
  } else if (Array.isArray(plan?.fgItems)) {
    plan.fgItems.forEach((fg: any) => {
      (fg.nestedMaterials || []).forEach((n: any) => {
        allTreeItems.push({
          ...n,
          parentFGName: fg.fgItemName || fg.name || 'Finished Good',
          fgCustomerPo: fg.customerPoNumber || customerPo
        });
      });
    });
  }

  // -------------------------------------------------------------
  // Sheet 1: Multi-Level BOM Tree
  // -------------------------------------------------------------
  const treeRows: any[] = [];
  allTreeItems.forEach((item: any, idx: number) => {
    const level = item.level || 1;
    const indentSymbol = level > 1 ? '↳ '.repeat(level - 1) : '';
    const itemNameWithIndent = `${indentSymbol}${item.materialName || item.name || '-'}`;
    const desc = item.description || item.descriptions || '-';
    const typeLabel = 
      item.itemType === 'SubAssembly' ? 'Sub-Assembly' :
      item.itemType === 'Component' ? 'Component' :
      item.itemType === 'BO' ? 'Bought-Out' :
      item.itemType === 'Assembly' ? 'Assembly' : 'Raw Material';

    const grossReq = Number(item.totalRequired ?? item.grossRequired ?? item.requiredQuantity ?? 0);
    const liveStock = Number(item.currentPhysicalStock ?? 0);
    const inTransit = Number(item.totalInTransitPO ?? 0);
    const shortage = Number(item.netShortage ?? Math.max(0, grossReq - liveStock - inTransit));
    const rate = Number(item.bestVendor?.rate ?? item.rate ?? 0);
    const shortageVal = Math.round(shortage * rate * 100) / 100;
    const poNum = item.poNumber || (Array.isArray(item.poNumbers) ? item.poNumbers.join(', ') : '') || '-';
    const vendorName = item.bestVendor?.vendorName || item.bestVendor?.name || '-';
    const remark = item.materialPlanningStatus || (shortage === 0 ? 'Stock Covered' : 'Not Planned');
    const status = item.status || 'Pending';

    treeRows.push({
      'S.No': idx + 1,
      'BOM Level': level,
      'Parent FG': item.parentFGName || plan?.fgItems?.[0]?.fgItemName || '-',
      'Item Name': itemNameWithIndent,
      'Technical Description': desc,
      'Classification': typeLabel,
      'Category': item.category || '-',
      'Unit': item.unit || 'PCS',
      'Req / FG Unit': Number(item.quantityPerFG ?? 1),
      'Gross Required': grossReq,
      'Live Physical Stock': liveStock,
      'In-Transit PO Qty': inTransit,
      'True Net Shortage': shortage,
      'PO Number': poNum,
      'Preferred Supplier': vendorName,
      'Unit Rate (₹)': rate > 0 ? rate : '-',
      'Est. Shortage Value (₹)': shortageVal > 0 ? shortageVal : 0,
      'Planning Remark': remark,
      'BOM Status': status
    });
  });

  const wsTree = XLSX.utils.json_to_sheet(treeRows);
  wsTree['!cols'] = [
    { wch: 6 },  // S.No
    { wch: 10 }, // Level
    { wch: 22 }, // Parent FG
    { wch: 32 }, // Item Name
    { wch: 36 }, // Description
    { wch: 16 }, // Classification
    { wch: 18 }, // Category
    { wch: 8 },  // Unit
    { wch: 13 }, // Req / FG
    { wch: 14 }, // Gross Required
    { wch: 16 }, // Live Stock
    { wch: 16 }, // In-Transit PO
    { wch: 16 }, // Net Shortage
    { wch: 20 }, // PO Number
    { wch: 24 }, // Supplier
    { wch: 12 }, // Rate
    { wch: 18 }, // Shortage Value
    { wch: 18 }, // Remark
    { wch: 14 }  // Status
  ];
  XLSX.utils.book_append_sheet(wb, wsTree, 'Multi-Level BOM Tree');

  // -------------------------------------------------------------
  // Sheet 2: Raw Materials (RM)
  // -------------------------------------------------------------
  const rmList = (classifiedLists?.rmList && classifiedLists.rmList.length > 0)
    ? classifiedLists.rmList
    : allTreeItems.filter((i: any) => (i.itemType || '').toLowerCase() === 'rm' || (i.category || '').toLowerCase().includes('raw'));

  const rmRows = rmList.map((item: any, idx: number) => {
    const grossReq = Number(item.grossRequired ?? item.totalRequired ?? item.requiredQuantity ?? 0);
    const liveStock = Number(item.currentPhysicalStock ?? 0);
    const inTransit = Number(item.totalInTransitPO ?? 0);
    const shortage = Number(item.netShortage ?? Math.max(0, grossReq - liveStock - inTransit));
    const rate = Number(item.bestVendor?.rate ?? item.rate ?? 0);
    const poNum = item.poNumber || (Array.isArray(item.poNumbers) ? item.poNumbers.join(', ') : '') || '-';
    const vendorName = item.bestVendor?.vendorName || item.bestVendor?.name || '-';

    return {
      'S.No': idx + 1,
      'Material Name': item.materialName || item.name || '-',
      'Technical Description': item.description || item.descriptions || '-',
      'Category': item.category || 'Raw Material',
      'Unit': item.unit || 'KG',
      'Gross Required': grossReq,
      'Live Physical Stock': liveStock,
      'In-Transit PO Qty': inTransit,
      'True Net Shortage': shortage,
      'PO Number': poNum,
      'Preferred Supplier': vendorName,
      'Rate (₹)': rate > 0 ? rate : '-',
      'Est. Shortage Value (₹)': Math.round(shortage * rate * 100) / 100,
      'Planning Remark': item.materialPlanningStatus || (shortage === 0 ? 'Stock Covered' : 'Not Planned'),
      'Status': item.status || 'Pending'
    };
  });

  const wsRM = XLSX.utils.json_to_sheet(rmRows);
  wsRM['!cols'] = [
    { wch: 6 },
    { wch: 32 },
    { wch: 36 },
    { wch: 18 },
    { wch: 8 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 20 },
    { wch: 24 },
    { wch: 12 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 }
  ];
  XLSX.utils.book_append_sheet(wb, wsRM, 'Raw Materials (RM)');

  // -------------------------------------------------------------
  // Sheet 3: Bought-Out Items (BO)
  // -------------------------------------------------------------
  const boList = (classifiedLists?.boList && classifiedLists.boList.length > 0)
    ? classifiedLists.boList
    : allTreeItems.filter((i: any) => (i.itemType || '').toLowerCase() === 'bo' || (i.category || '').toLowerCase().includes('bought'));

  const boRows = boList.map((item: any, idx: number) => {
    const grossReq = Number(item.grossRequired ?? item.totalRequired ?? item.requiredQuantity ?? 0);
    const liveStock = Number(item.currentPhysicalStock ?? 0);
    const inTransit = Number(item.totalInTransitPO ?? 0);
    const shortage = Number(item.netShortage ?? Math.max(0, grossReq - liveStock - inTransit));
    const rate = Number(item.bestVendor?.rate ?? item.rate ?? 0);
    const poNum = item.poNumber || (Array.isArray(item.poNumbers) ? item.poNumbers.join(', ') : '') || '-';
    const vendorName = item.bestVendor?.vendorName || item.bestVendor?.name || '-';

    return {
      'S.No': idx + 1,
      'Item Name': item.materialName || item.name || '-',
      'Technical Description': item.description || item.descriptions || '-',
      'Category': item.category || 'Bought Out',
      'Unit': item.unit || 'PCS',
      'Gross Required': grossReq,
      'Live Physical Stock': liveStock,
      'In-Transit PO Qty': inTransit,
      'True Net Shortage': shortage,
      'PO Number': poNum,
      'Preferred Supplier': vendorName,
      'Rate (₹)': rate > 0 ? rate : '-',
      'Est. Shortage Value (₹)': Math.round(shortage * rate * 100) / 100,
      'Planning Remark': item.materialPlanningStatus || (shortage === 0 ? 'Stock Covered' : 'Not Planned'),
      'Status': item.status || 'Pending'
    };
  });

  const wsBO = XLSX.utils.json_to_sheet(boRows);
  wsBO['!cols'] = wsRM['!cols'];
  XLSX.utils.book_append_sheet(wb, wsBO, 'Bought-Out (BO)');

  // -------------------------------------------------------------
  // Sheet 4: Components & Sub-Assemblies
  // -------------------------------------------------------------
  const compAndSubList = [
    ...(classifiedLists?.subAssemblyList || []),
    ...(classifiedLists?.componentList || []),
    ...(classifiedLists?.assemblyList || [])
  ];

  const finalCompList = compAndSubList.length > 0
    ? compAndSubList
    : allTreeItems.filter((i: any) => {
        const t = (i.itemType || '').toLowerCase();
        return t.includes('comp') || t.includes('sub') || t.includes('assem');
      });

  const compRows = finalCompList.map((item: any, idx: number) => {
    const grossReq = Number(item.grossRequired ?? item.totalRequired ?? item.requiredQuantity ?? 0);
    const liveStock = Number(item.currentPhysicalStock ?? 0);
    const inTransit = Number(item.totalInTransitPO ?? 0);
    const shortage = Number(item.netShortage ?? Math.max(0, grossReq - liveStock - inTransit));
    const poNum = item.poNumber || (Array.isArray(item.poNumbers) ? item.poNumbers.join(', ') : '') || '-';

    return {
      'S.No': idx + 1,
      'Component / Sub-Assembly': item.materialName || item.name || '-',
      'Technical Description': item.description || item.descriptions || '-',
      'Type': item.itemType || 'SubAssembly',
      'Category': item.category || '-',
      'Unit': item.unit || 'PCS',
      'Gross Required': grossReq,
      'Live Physical Stock': liveStock,
      'In-Transit PO Qty': inTransit,
      'Net Shortage': shortage,
      'PO Number': poNum,
      'Planning Remark': item.materialPlanningStatus || (shortage === 0 ? 'Stock Covered' : 'Not Planned'),
      'Status': item.status || 'Pending'
    };
  });

  const wsComp = XLSX.utils.json_to_sheet(compRows);
  wsComp['!cols'] = [
    { wch: 6 },
    { wch: 32 },
    { wch: 36 },
    { wch: 16 },
    { wch: 18 },
    { wch: 8 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 20 },
    { wch: 18 },
    { wch: 14 }
  ];
  XLSX.utils.book_append_sheet(wb, wsComp, 'Components & Sub-Assemblies');

  // Trigger file download in browser
  const cleanPlanNum = planNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${cleanPlanNum}_Nested_BOM_Classification.xlsx`;
  XLSX.writeFile(wb, filename);
}
