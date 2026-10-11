import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowRightLeft, Scale, Info, Sparkles, Check, Calculator } from 'lucide-react';
import { STANDARD_UOMS } from '@/src/constants/uomConfig';
import SearchableSelect, { SearchableOption } from './SearchableSelect';
import { resolveUomRatios } from '@/src/utils/dualUomHelper';

export interface DualUomUpdate {
  hasSecondaryUnit?: boolean;
  secondaryUnit?: string;
  primaryRatio?: number | string;
  secondaryRatio?: number | string;
  conversionFactor?: number;
}

export interface DualUomRatioInputProps {
  primaryUnit?: string;
  hasSecondaryUnit: boolean;
  onHasSecondaryUnitChange?: (hasSec: boolean) => void;
  secondaryUnit?: string;
  onSecondaryUnitChange?: (unit: string) => void;
  primaryRatio?: number | string;
  onPrimaryRatioChange?: (val: number | string) => void;
  secondaryRatio?: number | string;
  onSecondaryRatioChange?: (val: number | string) => void;
  conversionFactor?: number | string;
  onConversionFactorChange?: (val: number) => void;
  onRatioChange?: (updates: DualUomUpdate) => void;
  secondaryUomOptions?: Array<{ value: string; label: string; [key: string]: any }>;
  colorScheme?: 'indigo' | 'purple' | 'emerald';
  compact?: boolean;
}

export const DualUomRatioInput: React.FC<DualUomRatioInputProps> = ({
  primaryUnit = 'NOS',
  hasSecondaryUnit,
  onHasSecondaryUnitChange,
  secondaryUnit = '',
  onSecondaryUnitChange,
  primaryRatio,
  onPrimaryRatioChange,
  secondaryRatio,
  onSecondaryRatioChange,
  conversionFactor,
  onConversionFactorChange,
  onRatioChange,
  secondaryUomOptions,
  colorScheme = 'indigo',
  compact = false,
}) => {
  const normPriUnit = (primaryUnit || 'NOS').trim().toUpperCase();

  // Standardized dropdown list for secondary units
  const options: SearchableOption[] = useMemo(() => {
    if (secondaryUomOptions && secondaryUomOptions.length > 0) {
      return secondaryUomOptions;
    }
    return STANDARD_UOMS
      .filter((u) => u.value.toUpperCase() !== normPriUnit)
      .map((u) => ({
        value: u.value,
        label: `${u.label} (${u.value})`,
      }));
  }, [secondaryUomOptions, normPriUnit]);

  // Local input string buffers so users can freely type decimals, empty string, etc. without jumping
  const [localPriRatio, setLocalPriRatio] = useState<string>(
    primaryRatio !== undefined && primaryRatio !== null && primaryRatio !== '' ? String(primaryRatio) : '1'
  );
  const [localSecRatio, setLocalSecRatio] = useState<string>(
    secondaryRatio !== undefined && secondaryRatio !== null && secondaryRatio !== '' ? String(secondaryRatio) : '1'
  );
  const [localCf, setLocalCf] = useState<string>(
    conversionFactor !== undefined && conversionFactor !== null && conversionFactor !== '' ? String(conversionFactor) : '1'
  );

  // Sync from props when parent updates them externally
  useEffect(() => {
    if (primaryRatio !== undefined && primaryRatio !== null && String(primaryRatio) !== localPriRatio) {
      setLocalPriRatio(String(primaryRatio));
    }
  }, [primaryRatio]);

  useEffect(() => {
    if (secondaryRatio !== undefined && secondaryRatio !== null && String(secondaryRatio) !== localSecRatio) {
      setLocalSecRatio(String(secondaryRatio));
    }
  }, [secondaryRatio]);

  useEffect(() => {
    if (conversionFactor !== undefined && conversionFactor !== null && String(conversionFactor) !== localCf) {
      setLocalCf(String(conversionFactor));
    }
  }, [conversionFactor]);

  // Unified dispatcher that calls both onRatioChange (atomic) and individual callbacks
  const notifyUpdates = (updates: DualUomUpdate) => {
    if (onRatioChange) {
      onRatioChange(updates);
    }
    if (updates.hasSecondaryUnit !== undefined && onHasSecondaryUnitChange) {
      onHasSecondaryUnitChange(updates.hasSecondaryUnit);
    }
    if (updates.secondaryUnit !== undefined && onSecondaryUnitChange) {
      onSecondaryUnitChange(updates.secondaryUnit);
    }
    if (updates.primaryRatio !== undefined && onPrimaryRatioChange) {
      onPrimaryRatioChange(updates.primaryRatio);
    }
    if (updates.secondaryRatio !== undefined && onSecondaryRatioChange) {
      onSecondaryRatioChange(updates.secondaryRatio);
    }
    if (updates.conversionFactor !== undefined && onConversionFactorChange) {
      const numCf = typeof updates.conversionFactor === 'number'
        ? updates.conversionFactor
        : parseFloat(String(updates.conversionFactor));
      if (!isNaN(numCf) && numCf > 0) {
        onConversionFactorChange(numCf);
      }
    }
  };

  // Initial Auto-Resolution on mount: only runs ONCE for existing items
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (hasInitializedRef.current) return;
    if (hasSecondaryUnit && secondaryUnit) {
      const pNum = Number(primaryRatio);
      const sNum = Number(secondaryRatio);
      const cfNum = Number(conversionFactor);

      if ((isNaN(pNum) || pNum <= 0 || isNaN(sNum) || sNum <= 0) && !isNaN(cfNum) && cfNum > 0) {
        hasInitializedRef.current = true;
        const resolved = resolveUomRatios({
          unit: normPriUnit,
          secondaryUnit,
          conversionFactor: cfNum,
          primaryRatio: pNum > 0 ? pNum : undefined,
          secondaryRatio: sNum > 0 ? sNum : undefined,
        });

        setLocalPriRatio(String(resolved.primaryRatio));
        setLocalSecRatio(String(resolved.secondaryRatio));
        setLocalCf(String(resolved.conversionFactor));

        notifyUpdates({
          primaryRatio: resolved.primaryRatio,
          secondaryRatio: resolved.secondaryRatio,
          conversionFactor: resolved.conversionFactor,
        });
      } else if (pNum > 0 && sNum > 0) {
        hasInitializedRef.current = true;
      }
    }
  }, [hasSecondaryUnit, secondaryUnit, conversionFactor, primaryRatio, secondaryRatio, normPriUnit]);

  // 1. User edits Primary Ratio
  const handlePrimaryRatioChange = (valStr: string) => {
    setLocalPriRatio(valStr);
    const pVal = parseFloat(valStr);
    const sVal = parseFloat(localSecRatio);

    if (!isNaN(pVal) && pVal > 0 && !isNaN(sVal) && sVal > 0) {
      const computedCf = parseFloat((sVal / pVal).toFixed(6));
      setLocalCf(String(computedCf));
      notifyUpdates({
        primaryRatio: pVal,
        secondaryRatio: sVal,
        conversionFactor: computedCf,
      });
    } else {
      notifyUpdates({
        primaryRatio: valStr,
      });
    }
  };

  // 2. User edits Secondary Ratio
  const handleSecondaryRatioChange = (valStr: string) => {
    setLocalSecRatio(valStr);
    const sVal = parseFloat(valStr);
    const pVal = parseFloat(localPriRatio);

    if (!isNaN(pVal) && pVal > 0 && !isNaN(sVal) && sVal > 0) {
      const computedCf = parseFloat((sVal / pVal).toFixed(6));
      setLocalCf(String(computedCf));
      notifyUpdates({
        primaryRatio: pVal,
        secondaryRatio: sVal,
        conversionFactor: computedCf,
      });
    } else {
      notifyUpdates({
        secondaryRatio: valStr,
      });
    }
  };

  // 3. User directly edits Conversion Factor (e.g. 0.25, 0.009, 2.5)
  const handleConversionFactorChange = (valStr: string) => {
    setLocalCf(valStr);
    const cfVal = parseFloat(valStr);

    if (!isNaN(cfVal) && cfVal > 0) {
      let derivedPRatio = 1;
      let derivedSRatio = cfVal;

      if (cfVal < 1) {
        const inv = 1 / cfVal;
        if (Math.abs(inv - Math.round(inv)) < 0.005) {
          derivedPRatio = Math.round(inv);
          derivedSRatio = 1;
        } else {
          derivedPRatio = 1;
          derivedSRatio = parseFloat(cfVal.toFixed(6));
        }
      } else {
        derivedPRatio = 1;
        derivedSRatio = parseFloat(cfVal.toFixed(6));
      }

      setLocalPriRatio(String(derivedPRatio));
      setLocalSecRatio(String(derivedSRatio));

      notifyUpdates({
        primaryRatio: derivedPRatio,
        secondaryRatio: derivedSRatio,
        conversionFactor: cfVal,
      });
    } else {
      notifyUpdates({
        conversionFactor: valStr === '' ? 1 : (parseFloat(valStr) || 1),
      });
    }
  };

  // 4. Swap Action
  const handleSwapRatios = () => {
    const nextPri = localSecRatio || '1';
    const nextSec = localPriRatio || '1';
    setLocalPriRatio(nextPri);
    setLocalSecRatio(nextSec);

    const pVal = parseFloat(nextPri);
    const sVal = parseFloat(nextSec);
    if (!isNaN(pVal) && pVal > 0 && !isNaN(sVal) && sVal > 0) {
      const computedCf = parseFloat((sVal / pVal).toFixed(6));
      setLocalCf(String(computedCf));
      notifyUpdates({
        primaryRatio: pVal,
        secondaryRatio: sVal,
        conversionFactor: computedCf,
      });
    }
  };

  // 5. Toggle Checkbox
  const handleToggle = (checked: boolean) => {
    const fallbackSec = normPriUnit === 'KG' ? 'NOS' : 'KG';
    const sec = secondaryUnit || fallbackSec;
    const pVal = parseFloat(localPriRatio) || 1;
    const sVal = parseFloat(localSecRatio) || 1;
    const cfVal = parseFloat(localCf) || (sVal / pVal);

    notifyUpdates({
      hasSecondaryUnit: checked,
      secondaryUnit: checked ? sec : '',
      primaryRatio: checked ? pVal : 1,
      secondaryRatio: checked ? sVal : 1,
      conversionFactor: checked ? cfVal : 1,
    });
  };

  // Theme tokens
  const theme = useMemo(() => {
    switch (colorScheme) {
      case 'purple':
        return {
          checkbox: 'text-purple-600 focus:ring-purple-500',
          badgeBg: 'bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300',
          focusRing: 'focus-within:ring-purple-500 focus-within:border-purple-500',
          summaryBg: 'bg-purple-50/70 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/80',
          titleText: 'text-purple-900 dark:text-purple-200',
          accentText: 'text-purple-700 dark:text-purple-300',
          btnHover: 'hover:bg-purple-100 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300',
        };
      case 'emerald':
        return {
          checkbox: 'text-emerald-600 focus:ring-emerald-500',
          badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
          focusRing: 'focus-within:ring-emerald-500 focus-within:border-emerald-500',
          summaryBg: 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80',
          titleText: 'text-emerald-900 dark:text-emerald-200',
          accentText: 'text-emerald-700 dark:text-emerald-300',
          btnHover: 'hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
        };
      case 'indigo':
      default:
        return {
          checkbox: 'text-indigo-600 focus:ring-indigo-500',
          badgeBg: 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300',
          focusRing: 'focus-within:ring-indigo-500 focus-within:border-indigo-500',
          summaryBg: 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/80',
          titleText: 'text-indigo-900 dark:text-indigo-200',
          accentText: 'text-indigo-700 dark:text-indigo-300',
          btnHover: 'hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
        };
    }
  }, [colorScheme]);

  // Derived metrics for summary
  const pRatioNum = parseFloat(localPriRatio) > 0 ? parseFloat(localPriRatio) : 1;
  const sRatioNum = parseFloat(localSecRatio) > 0 ? parseFloat(localSecRatio) : 1;
  const activeCf = parseFloat(localCf) > 0 ? parseFloat(localCf) : sRatioNum / pRatioNum;
  const invCf = activeCf > 0 ? parseFloat((1 / activeCf).toFixed(4)) : 0;
  const samplePriQty = 100;
  const sampleSecQty = parseFloat((samplePriQty * activeCf).toFixed(3));

  return (
    <div className="w-full">
      {/* Header Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hasSecondaryUnit}
            onChange={(e) => handleToggle(e.target.checked)}
            className={`w-4 h-4 rounded border-slate-300 dark:border-slate-600 ${theme.checkbox} transition-all`}
          />
          <div className="flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
              Enable Dual Unit (Secondary UOM)
            </span>
          </div>
        </label>

        {hasSecondaryUnit && secondaryUnit && (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border shadow-2xs ${theme.badgeBg} animate-in fade-in duration-200`}>
            <Sparkles className="w-3 h-3" />
            {pRatioNum} {normPriUnit} = {sRatioNum} {secondaryUnit}
          </span>
        )}
      </div>

      {/* Conversion Section */}
      {hasSecondaryUnit && (
        <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-900/60 space-y-4 animate-in fade-in duration-200">
          {/* Row 1: Equivalence Equation */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                1. Dual Unit Ratio Equation <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Info className="w-3 h-3" /> e.g. 10 NOS = 1 KG, or 1 MTR = 3.28 FT
              </span>
            </div>

            {/* Visual Bidirectional Equation Grid */}
            <div className="grid grid-cols-1 md:grid-cols-11 gap-2.5 items-center">
              {/* Left Side: Primary Ratio & Unit (5 Cols) */}
              <div className={`md:col-span-5 flex items-stretch rounded-lg shadow-2xs overflow-hidden border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 ${theme.focusRing} transition-all`}>
                <div className="relative flex-1">
                  <input
                    type="number"
                    step="any"
                    min="0.000001"
                    required={hasSecondaryUnit}
                    value={localPriRatio}
                    onChange={(e) => handlePrimaryRatioChange(e.target.value)}
                    placeholder="1"
                    className="w-full h-10 px-3 text-sm font-mono font-bold text-slate-900 dark:text-white bg-transparent outline-none"
                  />
                  <span className="absolute -top-2 left-2 px-1 text-[9px] font-bold text-slate-500 bg-white dark:bg-slate-900 uppercase">
                    Primary Qty
                  </span>
                </div>
                <div className="px-3 flex items-center justify-center bg-slate-100 dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 min-w-[70px] select-none">
                  {normPriUnit}
                </div>
              </div>

              {/* Center: Equals & Quick Swap Action (1 Col) */}
              <div className="md:col-span-1 flex items-center justify-center py-1">
                <button
                  type="button"
                  onClick={handleSwapRatios}
                  title="Swap Primary & Secondary Values"
                  className={`group p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xs transition-all ${theme.btnHover}`}
                >
                  <ArrowRightLeft className="w-4 h-4 transition-transform group-hover:rotate-180 duration-300" />
                </button>
              </div>

              {/* Right Side: Secondary Ratio & Unit Selector (5 Cols) */}
              <div className="md:col-span-5 flex flex-col sm:flex-row items-stretch gap-2">
                <div className={`flex-1 flex items-stretch rounded-lg shadow-2xs overflow-hidden border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 ${theme.focusRing} transition-all`}>
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="any"
                      min="0.000001"
                      required={hasSecondaryUnit}
                      value={localSecRatio}
                      onChange={(e) => handleSecondaryRatioChange(e.target.value)}
                      placeholder="1"
                      className="w-full h-10 px-3 text-sm font-mono font-bold text-slate-900 dark:text-white bg-transparent outline-none"
                    />
                    <span className="absolute -top-2 left-2 px-1 text-[9px] font-bold text-slate-500 bg-white dark:bg-slate-900 uppercase">
                      Secondary Qty
                    </span>
                  </div>
                </div>

                <div className="flex-1 min-w-[130px]">
                  <SearchableSelect
                    options={options}
                    value={secondaryUnit || ''}
                    onChange={(val: string) => {
                      notifyUpdates({ secondaryUnit: val });
                    }}
                    placeholder="Select 2nd unit..."
                    innerClassName="w-full h-10 px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg outline-none cursor-pointer text-slate-900 dark:text-white font-medium flex items-center justify-between shadow-2xs hover:border-slate-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Direct Editable Conversion Factor Input */}
          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  2. Conversion Factor (Multiplier) <span className="text-red-500">*</span>
                </label>
                <div className={`relative flex items-center rounded-lg shadow-2xs overflow-hidden border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 ${theme.focusRing} transition-all`}>
                  <input
                    type="number"
                    step="any"
                    min="0.000001"
                    required={hasSecondaryUnit}
                    value={localCf}
                    onChange={(e) => handleConversionFactorChange(e.target.value)}
                    placeholder="e.g. 0.1 or 0.25"
                    className="w-full h-10 pl-3 pr-20 text-sm font-mono font-bold text-slate-900 dark:text-white bg-transparent outline-none"
                  />
                  <div className="absolute right-0 top-0 bottom-0 px-2.5 flex items-center bg-slate-100 dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 pointer-events-none select-none">
                    {secondaryUnit || '2nd Unit'}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  1 {normPriUnit} = {parseFloat(activeCf.toFixed(6))} {secondaryUnit || 'Secondary Unit'}
                </p>
              </div>

              <div className="text-xs text-slate-600 dark:text-slate-400 bg-white/70 dark:bg-slate-800/70 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <Calculator className="w-3.5 h-3.5" />
                  <span>Bidirectional Editing:</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  You can edit <strong>Primary Qty</strong> & <strong>Secondary Qty</strong> above, or edit <strong>Conversion Factor</strong> directly here. Both inputs synchronize in real-time.
                </p>
              </div>
            </div>
          </div>

          {/* Row 3: Live Conversion Summary Card */}
          {secondaryUnit && (
            <div className={`p-3 rounded-lg border text-xs ${theme.summaryBg} transition-all`}>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-200/60 dark:border-slate-700/60">
                <div className="flex items-center gap-1.5">
                  <Check className={`w-3.5 h-3.5 ${theme.accentText}`} />
                  <span className={`font-bold ${theme.titleText}`}>
                    Active Conversion Ratio:
                  </span>
                </div>
                <span className="font-mono font-extrabold text-xs px-2.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white shadow-2xs">
                  {pRatioNum} {normPriUnit} = {sRatioNum} {secondaryUnit}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 text-[11px] font-mono">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-sans font-bold">1 Primary Unit:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    1 {normPriUnit} = {parseFloat(activeCf.toFixed(4))} {secondaryUnit}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-sans font-bold">1 Secondary Unit:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    1 {secondaryUnit} = {invCf} {normPriUnit}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-sans font-bold">Stock Example (100 {normPriUnit}):</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {samplePriQty} {normPriUnit} = {sampleSecQty} {secondaryUnit}
                  </span>
                </div>
              </div>

              <div className="mt-2 pt-1.5 border-t border-slate-200/40 dark:border-slate-700/40 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                <span>Underlying Factor: <code className="font-mono font-bold">{parseFloat(activeCf.toFixed(6))}</code></span>
                <span className="italic">Saved to database & synced to inventory</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DualUomRatioInput;
