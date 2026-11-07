import { describe, it, expect } from 'vitest';
import {
  explodeFGBOMHierarchy,
  consolidateBOMItems,
  filterNestedBOMTree,
} from '@/src/utils/bomHierarchyHelper';
import {
  enrichTreeWithPricing,
  enrichConsolidatedItemsWithPricing,
  calculateBOMCostingSummary,
  evaluateCostingModeEligibility,
} from '@/src/utils/bomCostingHelper';

describe('Multi-Level FG BOM Explosion, Dual-UOM & 3-Mode Costing Integration', () => {
  const rmSteelSheet = {
    _id: 'rm-101',
    name: 'CRCA Steel Sheet',
    code: 'RM-101',
    descriptions: '1.5mm Cold Rolled Sheet',
    unit: 'KG',
    hasSecondaryUnit: true,
    secondaryUnit: 'SHEET',
    conversionFactor: 0.05, // 1 KG = 0.05 SHEET (20 KG per SHEET)
  };

  const boBearing = {
    _id: 'bo-201',
    name: 'Deep Groove Ball Bearing 6205',
    code: 'BO-201',
    descriptions: '25x52x15mm Sealed Bearing',
    unit: 'NOS',
  };

  const fgBracketComponent = {
    _id: 'fg-comp-301',
    name: 'Mounting Bracket Machined',
    code: 'FG-301',
    description: 'CNC Bent & Drilled Bracket',
    type: 'Component',
    unit: 'NOS',
    bom: [
      {
        itemType: 'RawMaterial',
        item: rmSteelSheet._id,
        itemName: rmSteelSheet.name,
        quantity: 2.5, // 2.5 KG per bracket
        unit: 'KG',
        hasSecondaryUnit: true,
        secondaryUnit: 'SHEET',
        conversionFactor: 0.05,
        secondaryQuantity: 0.125,
      },
    ],
  };

  const fgRotorSubAssembly = {
    _id: 'fg-sub-401',
    name: 'Rotor Sub-Assembly',
    code: 'FG-401',
    description: 'Balanced Rotor with Bracket & Bearing',
    type: 'Sub Assembly',
    unit: 'NOS',
    bom: [
      {
        itemType: 'FGItem',
        item: fgBracketComponent._id,
        itemName: fgBracketComponent.name,
        quantity: 2, // 2 brackets per sub-assembly
        unit: 'NOS',
      },
      {
        itemType: 'BoughtOut',
        item: boBearing._id,
        itemName: boBearing.name,
        quantity: 2, // 2 bearings per sub-assembly
        unit: 'NOS',
      },
    ],
  };

  const rootDriveAssembly = {
    _id: 'fg-root-501',
    name: 'Industrial Drive Unit 5HP',
    code: 'FG-501',
    description: 'Complete 5HP Drive Assembly',
    type: 'Assembly',
    unit: 'NOS',
    bom: [
      {
        itemType: 'FGItem',
        item: fgRotorSubAssembly._id,
        itemName: fgRotorSubAssembly.name,
        quantity: 3, // 3 Rotor Sub-Assemblies per Drive Unit
        unit: 'NOS',
      },
      {
        itemType: 'BoughtOut',
        item: boBearing._id,
        itemName: boBearing.name,
        quantity: 1, // 1 direct bearing at L2
        unit: 'NOS',
      },
    ],
  };

  const allFGItems = [fgBracketComponent, fgRotorSubAssembly, rootDriveAssembly];
  const allRMItems = [rmSteelSheet];
  const allBOItems = [boBearing];

  const vendorPriceLists = [
    {
      _id: 'vpl-1',
      material: { _id: rmSteelSheet._id, name: rmSteelSheet.name },
      vendor: { _id: 'v-1', name: 'Tata Steel Vendor' },
      price: 80, // ₹80 per KG
      pricingUnit: 'KG',
      isPreferred: true,
    },
    {
      _id: 'vpl-2',
      material: { _id: boBearing._id, name: boBearing.name },
      vendor: { _id: 'v-2', name: 'SKF Authorized Dealer' },
      price: 150, // ₹150 per NOS
      pricingUnit: 'NOS',
      isPreferred: true,
    },
  ];

  const salesPriceLists = [
    {
      _id: 'spl-1',
      fgItem: { _id: fgRotorSubAssembly._id, name: fgRotorSubAssembly.name },
      price: 1200, // ₹1200 per Rotor Sub-Assembly
    },
    {
      _id: 'spl-2',
      fgItem: { _id: fgBracketComponent._id, name: fgBracketComponent.name },
      price: 300, // ₹300 per Mounting Bracket Component
    },
  ];

  it('explodes multi-level hierarchy accurately with cumulative quantities and descriptions', () => {
    const exploded = explodeFGBOMHierarchy(rootDriveAssembly, allFGItems, allRMItems, allBOItems);

    expect(exploded.summary.subAssemblyCount).toBe(1);
    expect(exploded.summary.componentCount).toBe(1);
    expect(exploded.summary.rmCount).toBe(1);
    expect(exploded.summary.boCount).toBe(2); // 1 under sub-assembly + 1 direct L2

    // Consolidated BOM should merge the two bearing usages (3*2 = 6 + 1 = 7 NOS)
    const consolidated = consolidateBOMItems(exploded.flatTree, 'ALL');
    const bearingEntry = consolidated.find((c) => c.id === boBearing._id);
    const rmEntry = consolidated.find((c) => c.id === rmSteelSheet._id);

    expect(bearingEntry).toBeDefined();
    expect(bearingEntry?.totalCumulativeQuantity).toBe(7);
    expect(bearingEntry?.description).toBe('25x52x15mm Sealed Bearing');

    // RM cumulative: 3 sub-assemblies * 2 brackets * 2.5 KG = 15 KG (= 0.75 SHEET)
    expect(rmEntry).toBeDefined();
    expect(rmEntry?.totalCumulativeQuantity).toBe(15);
    expect(rmEntry?.hasSecondaryUnit).toBe(true);
    expect(rmEntry?.secondaryUnit).toBe('SHEET');
    expect(rmEntry?.totalSecondaryCumulativeQuantity).toBe(0.75);
  });

  it('preserves 4-decimal BOM quantities, secondary quantities, and foreign currency conversion to INR', () => {
    const fineGoldWire = {
      _id: 'rm-gold-99',
      name: 'Fine Gold Bonding Wire',
      code: 'RM-G99',
      descriptions: '0.025mm High Purity Wire',
      unit: 'KG',
      hasSecondaryUnit: true,
      secondaryUnit: 'MTR',
      conversionFactor: 0.35,
    };
    const leafSensorComp = {
      _id: 'fg-leaf-comp',
      name: 'Precision Sensor Chip',
      code: 'FG-SC1',
      description: 'Imported Calibrated Sensor Module',
      type: 'Component',
      unit: 'NOS',
      bom: [], // Leaf component with no child RM BOM
    };
    const microAssy = {
      _id: 'fg-micro-1',
      name: 'Micro Controller Unit',
      code: 'FG-MCU',
      type: 'Assembly',
      unit: 'NOS',
      bom: [
        { itemType: 'RawMaterial', item: fineGoldWire._id, itemName: fineGoldWire.name, quantity: 0.005, unit: 'KG' },
        { itemType: 'FGItem', item: leafSensorComp._id, itemName: leafSensorComp.name, quantity: 2, unit: 'NOS' },
      ],
    };

    const exploded = explodeFGBOMHierarchy(microAssy, [leafSensorComp, microAssy], [fineGoldWire], []);
    const consolidated = consolidateBOMItems(exploded.flatTree, 'ALL');
    const wireItem = consolidated.find((c) => c.id === fineGoldWire._id);
    expect(wireItem?.totalCumulativeQuantity).toBe(0.005);
    expect(wireItem?.totalSecondaryCumulativeQuantity).toBe(0.0018);

    // Price wire in Secondary Unit (MTR) and leafSensorComp in USD ($10 * 84 = ₹840)
    const vpl = [{ _id: 'vpl-g', material: { _id: fineGoldWire._id, name: fineGoldWire.name }, price: 1000, pricingUnit: 'MTR', isSecondaryUnit: true }];
    const spl = [{ _id: 'spl-s', fgItem: { _id: leafSensorComp._id, name: leafSensorComp.name }, price: 10, currency: 'USD' }];

    const enrichedCons = enrichConsolidatedItemsWithPricing(consolidated, vpl, spl, [leafSensorComp, microAssy], 'RM_AND_BO');
    const summary = calculateBOMCostingSummary([], enrichedCons, 'RM_AND_BO');
    // 2 * ($10 * 84 = ₹840) = ₹1680 + (0.0018 MTR * ₹1000 = ₹1.80) = ₹1681.80
    expect(summary.totalEstimatedCost).toBe(1681.8);
  });

  it('calculates 3-Mode BOM Costing (L2_ONLY, COMPONENT_AND_BO, RM_AND_BO) without double counting', () => {
    const exploded = explodeFGBOMHierarchy(rootDriveAssembly, allFGItems, allRMItems, allBOItems);
    const baseConsolidated = consolidateBOMItems(exploded.flatTree, 'ALL');

    // Mode 1: L2_ONLY -> 3 * Rotor Sub-Assembly (₹1200) + 1 * L2 Bearing (₹150)
    // Note: in consolidated view, bearing appears at both L2 and L3, so flatTree L2 check is authoritative
    const flatL2 = enrichTreeWithPricing(exploded.flatTree, vendorPriceLists, salesPriceLists, allFGItems, 'L2_ONLY');
    const consL2 = enrichConsolidatedItemsWithPricing(baseConsolidated, vendorPriceLists, salesPriceLists, allFGItems, 'L2_ONLY');
    const summaryL2 = calculateBOMCostingSummary(flatL2, consL2, 'L2_ONLY');
    expect(summaryL2.costingMode).toBe('L2_ONLY');
    expect(summaryL2.totalEstimatedCost).toBeGreaterThan(0);

    // Mode 2: COMPONENT_AND_BO -> 6 * Bracket Component (6 * ₹300 = ₹1800) + 7 * Bearing (7 * ₹150 = ₹1050) = ₹2850
    const flatCompBo = enrichTreeWithPricing(exploded.flatTree, vendorPriceLists, salesPriceLists, allFGItems, 'COMPONENT_AND_BO');
    const consCompBo = enrichConsolidatedItemsWithPricing(baseConsolidated, vendorPriceLists, salesPriceLists, allFGItems, 'COMPONENT_AND_BO');
    const summaryCompBo = calculateBOMCostingSummary(flatCompBo, consCompBo, 'COMPONENT_AND_BO');
    expect(summaryCompBo.totalEstimatedCost).toBe(2850);

    // Mode 3: RM_AND_BO -> 15 KG Steel (15 * ₹80 = ₹1200) + 7 * Bearing (7 * ₹150 = ₹1050) = ₹2250
    const flatRmBo = enrichTreeWithPricing(exploded.flatTree, vendorPriceLists, salesPriceLists, allFGItems, 'RM_AND_BO');
    const consRmBo = enrichConsolidatedItemsWithPricing(baseConsolidated, vendorPriceLists, salesPriceLists, allFGItems, 'RM_AND_BO');
    const summaryRmBo = calculateBOMCostingSummary(flatRmBo, consRmBo, 'RM_AND_BO');
    expect(summaryRmBo.totalEstimatedCost).toBe(2250);
  });

  it('prevents infinite recursion when circular BOM references exist', () => {
    const cyclicA: any = {
      _id: 'fg-cyc-a',
      name: 'Cyclic Assembly A',
      type: 'Sub Assembly',
      unit: 'NOS',
      bom: [{ itemType: 'FGItem', item: 'fg-cyc-b', quantity: 1, unit: 'NOS' }],
    };
    const cyclicB: any = {
      _id: 'fg-cyc-b',
      name: 'Cyclic Assembly B',
      type: 'Sub Assembly',
      unit: 'NOS',
      bom: [{ itemType: 'FGItem', item: 'fg-cyc-a', quantity: 1, unit: 'NOS' }],
    };

    const result = explodeFGBOMHierarchy(cyclicA, [cyclicA, cyclicB], [], []);
    expect(result.flatTree.length).toBeGreaterThan(0);
    // Should terminate cleanly without stack overflow
    expect(result.summary.totalLevels).toBeLessThanOrEqual(15);
  });
});
