const fs = require('fs');

let content = fs.readFileSync('app/dashboard/hr/components/SalariesTab.tsx', 'utf8');

const replacement = `            {!loading && selectedEmployeeId && calendarData.length > 0 && (
                <div className="flex flex-col gap-6 mt-6">
                    {/* Top Row: Config & Totals */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Config Card */}
                        <div className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 p-6 rounded-xl shadow-sm">
                            <h4 className="dark:text-gray-100 flex font-bold gap-2 items-center mb-4 text-gray-800">
                                <IndianRupee size={18} className="text-blue-500" /> Salary Configuration
                            </h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block dark:text-gray-400 font-semibold mb-1 text-gray-500 text-xs uppercase">Base Salary For Calculation</label>
                                    <div className="relative">
                                        <span className="-translate-y-1/2 absolute dark:text-gray-500 left-3 text-gray-400 top-1/2">₹</span>
                                        <input
                                            type="number"
                                            value={baseSalary}
                                            onChange={(e) => setBaseSalary(Number(e.target.value))}
                                            className="border border-gray-200 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none pl-7 pr-3 py-2 rounded-lg w-full bg-gray-50 dark:bg-slate-900"
                                            disabled
                                        />
                                    </div>
                                </div>
                                {(() => {
                                    const emp = employees.find(e => e._id === selectedEmployeeId) as any;
                                    if (emp?.isOTApplicable) {
                                        return (
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-blue-50 border border-blue-100 dark:bg-blue-900/20 dark:border-blue-800/30 p-3 rounded-lg">
                                                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase">Main OT Rate</p>
                                                    <p className="text-lg font-bold text-blue-900 dark:text-blue-100">{emp?.salary?.otRate || 1.0}x</p>
                                                </div>
                                                <div className="bg-red-50 border border-red-100 dark:bg-red-900/20 dark:border-red-800/30 p-3 rounded-lg">
                                                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase">Absent OT Rate</p>
                                                    <p className="text-lg font-bold text-red-900 dark:text-red-100">{emp.absentOTRate || 1.0}x</p>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>
                        </div>

                        {/* Summary Display */}
                        <div className="lg:col-span-2 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
                            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-5 text-sm flex items-center gap-2">
                                <Calculator size={18} className="text-blue-500" />
                                Detailed Calculation Summary
                            </h3>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                {/* Days Column */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500 font-medium">Applicable Days</span>
                                        <span className="font-bold text-slate-700 dark:text-slate-300">{totals.effectiveWorkingDays}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500 font-medium">Working Days</span>
                                        <span className="font-bold text-blue-600 dark:text-blue-400">{totals.presentDays}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500 font-medium">Absent Days</span>
                                        <span className="font-bold text-red-600 dark:text-red-400">{totals.effectiveWorkingDays - totals.presentDays}</span>
                                    </div>
                                </div>

                                {/* Hours Column */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500 font-medium">Applicable Hrs</span>
                                        <span className="font-bold text-slate-700 dark:text-slate-300">
                                            {(() => {
                                                const emp = employees.find(e => e._id === selectedEmployeeId) as any;
                                                return (totals.effectiveWorkingDays * (emp?.standardWorkingHours || 9)).toFixed(1);
                                            })()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500 font-medium">Total Work Hrs</span>
                                        <span className="font-bold text-blue-600 dark:text-blue-400">{totals.totalDutyHours.toFixed(1)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500 font-medium">Total Absent Hrs</span>
                                        <span className="font-bold text-red-600 dark:text-red-400">{totals.absentHours.toFixed(1)}</span>
                                    </div>
                                </div>

                                {/* OT Column */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500 font-medium">Total OT Hrs</span>
                                        <span className="font-bold text-purple-600 dark:text-purple-400">{totals.totalOtHours.toFixed(1)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500 font-medium">OT Compensated</span>
                                        <span className="font-bold text-orange-600 dark:text-orange-400">{totals.compensatedHours.toFixed(1)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500 font-medium">Main OT Hrs</span>
                                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{totals.mainOtHours.toFixed(1)}</span>
                                    </div>
                                </div>

                                {/* Pay Column */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500 font-medium">Gross Salary</span>
                                        <span className="font-bold text-slate-700 dark:text-slate-300">₹ {Math.round(totals.grossPay).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500 font-medium">Total OT Pay</span>
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">₹ {Math.round(totals.otPay).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-base font-bold pt-2 border-t border-slate-100 dark:border-slate-700 mt-2">
                                        <span className="text-slate-700 dark:text-slate-200">Net Payable</span>
                                        <span className="text-emerald-600 dark:text-emerald-400">₹ {Math.round(totals.netPay).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 flex justify-end items-center gap-4 border-t border-slate-100 dark:border-slate-700 pt-4">
                                <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-md">
                                    <RefreshCw size={14} /> Auto-Calculation Real-time
                                </div>
                                <button
                                    onClick={saveSalary}
                                    disabled={saving}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-8 rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-2 transition-colors"
                                >
                                    {saving && <RefreshCw size={16} className="animate-spin" />}
                                    {saving ? "Saving..." : existingSalaryId ? "Update Salary Record" : "Save Salary Record"}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Main Daily Log Table */}
                    <div className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 overflow-hidden rounded-xl shadow-sm">`;

const regex = /\{\!loading && selectedEmployeeId && calendarData\.length > 0 && \(\s*<div className="gap-6 grid grid-cols-1 lg:grid-cols-3">[\s\S]*?\{[^}]*2\. Main Daily Log Table[^}]*\}[\s\S]*?<div className="bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 lg:col-span-2 overflow-hidden rounded-xl shadow-sm">/;

if (!regex.test(content)) {
    console.error("Could not find regex match!");
    process.exit(1);
}

content = content.replace(regex, replacement);

const regex2 = /<\/div>\s*<\/div>\s*\{\/\* 3\. Calculations Panel \(1 Col\) \*\/\}[\s\S]*?<\/div>\s*<\/div>\s*\)\}/;
if (!regex2.test(content)) {
    console.error("Could not find regex2 match!");
    process.exit(1);
}

content = content.replace(regex2, "                        </div>\n                    </div>\n                </div>\n            )}");

fs.writeFileSync('app/dashboard/hr/components/SalariesTab.tsx', content);
console.log("Success");
