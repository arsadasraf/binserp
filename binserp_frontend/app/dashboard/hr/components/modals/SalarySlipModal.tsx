import React, { useRef } from 'react';
import { X, Printer, Download } from 'lucide-react';
import { Salary, Employee } from '../../types/hr.types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface SalarySlipModalProps {
    isOpen: boolean;
    onClose: () => void;
    salary: Salary | null;
}

export default function SalarySlipModal({ isOpen, onClose, salary }: SalarySlipModalProps) {
    const slipRef = useRef<HTMLDivElement>(null);

    if (!isOpen || !salary) return null;

    const employee = salary.employee as Employee;
    const monthName = salary.month;
    const year = salary.year;

    const handlePrint = () => {
        const printContent = slipRef.current;
        if (printContent) {
            const originalContents = document.body.innerHTML;
            document.body.innerHTML = printContent.outerHTML;
            window.print();
            document.body.innerHTML = originalContents;
            window.location.reload(); // Reload to restore event listeners
        }
    };

    const handleDownloadPDF = async () => {
        const element = slipRef.current;
        if (!element) return;

        const canvas = await html2canvas(element, { scale: 2 });
        const dataData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        pdf.addImage(dataData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Salary_Slip_${employee.name}_${monthName}_${year}.pdf`);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl my-8">
                {/* Header Actions */}
                <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50 rounded-t-xl">
                    <h3 className="text-lg font-semibold text-gray-900">Salary Slip Preview</h3>
                    <div className="flex items-center gap-2">
                        <button onClick={handleDownloadPDF} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors" title="Download PDF">
                            <Download size={20} />
                        </button>
                        <button onClick={handlePrint} className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors" title="Print">
                            <Printer size={20} />
                        </button>
                        <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div ref={slipRef}>
                    <div className="p-6">
                        <div className="flex justify-between border-b border-gray-200 pb-1">
                            <span className="font-semibold text-gray-600">Employee Name:</span>
                            <span className="font-bold">{employee.name}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-200 pb-1">
                            <span className="font-semibold text-gray-600">Employee ID:</span>
                            <span className="font-bold">{employee.employeeId}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-200 pb-1">
                            <span className="font-semibold text-gray-600">Designation:</span>
                            <span>{employee.designation}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-200 pb-1">
                            <span className="font-semibold text-gray-600">Department:</span>
                            <span>{employee.department}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-200 pb-1">
                            <span className="font-semibold text-gray-600">Days Worked:</span>
                            <span>{salary.presentDays} / {salary.workingDays}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-200 pb-1">
                            <span className="font-semibold text-gray-600">Bank Account:</span>
                            <span>{employee.paymentDetails?.accountNumber || "N/A"}</span>
                        </div>

                        {/* Salary Details Table */}
                        <div className="grid grid-cols-2 border-2 border-gray-800 mb-6 mt-4">
                            {/* Earnings */}
                            <div className="border-r-2 border-gray-800">
                                <div className="bg-gray-100 font-bold p-2 text-center border-b-2 border-gray-800 uppercase text-sm">Earnings</div>
                                <div className="p-4 space-y-2 text-sm">
                                    <div className="flex justify-between"><span>Basic Salary</span> <span>₹{salary.salaryComponents.basic.toLocaleString()}</span></div>
                                    <div className="flex justify-between"><span>HRA</span> <span>₹{salary.salaryComponents.hra.toLocaleString()}</span></div>
                                    <div className="flex justify-between"><span>Conveyance</span> <span>₹{salary.salaryComponents.conveyance.toLocaleString()}</span></div>
                                    <div className="flex justify-between"><span>Medical</span> <span>₹{salary.salaryComponents.medical.toLocaleString()}</span></div>
                                    <div className="flex justify-between"><span>Special Allowance</span> <span>₹{salary.salaryComponents.specialAllowance.toLocaleString()}</span></div>
                                    <div className="flex justify-between"><span>Overtime ({salary.overtime.hours} hrs)</span> <span>₹{salary.overtime.amount.toLocaleString()}</span></div>
                                    <div className="flex justify-between"><span>Incentives</span> <span>₹{(salary.incentives || 0).toLocaleString()}</span></div>
                                </div>
                            </div>

                            {/* Deductions */}
                            <div>
                                <div className="bg-gray-100 font-bold p-2 text-center border-b-2 border-gray-800 uppercase text-sm">Deductions</div>
                                <div className="p-4 space-y-2 text-sm">
                                    <div className="flex justify-between"><span>PF</span> <span>₹{salary.salaryComponents.pf.toLocaleString()}</span></div>
                                    <div className="flex justify-between"><span>Professional Tax</span> <span>₹{salary.salaryComponents.professionalTax.toLocaleString()}</span></div>
                                    <div className="flex justify-between"><span>Other Deductions</span> <span>₹{salary.deductions.toLocaleString()}</span></div>
                                </div>
                            </div>
                        </div>

                        {/* Totals */}
                        <div className="border-2 border-gray-800 mb-8">
                            <div className="grid grid-cols-2">
                                <div className="border-r-2 border-gray-800 p-2 flex justify-between font-bold bg-gray-50">
                                    <span>Total Earnings</span>
                                    <span>₹{salary.grossSalary.toLocaleString()}</span>
                                </div>
                                <div className="p-2 flex justify-between font-bold bg-gray-50">
                                    <span>Total Deductions</span>
                                    <span>₹{((salary.deductions || 0) + (salary.salaryComponents.pf || 0) + (salary.salaryComponents.professionalTax || 0)).toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="border-t-2 border-gray-800 p-3 flex justify-between items-center bg-gray-100">
                                <span className="font-bold uppercase">Net Salary Payable</span>
                                <span className="text-xl font-bold">₹{salary.netSalary.toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex justify-between items-end mt-16 text-sm">
                            <div className="text-center">
                                <div className="border-t border-gray-400 w-40 pt-1">Employee Signature</div>
                            </div>
                            <div className="text-center">
                                <div className="border-t border-gray-400 w-40 pt-1">Director Signature</div>
                            </div>
                        </div>
                        <p className="text-center text-xs text-gray-500 mt-8">This is a system-generated salary slip.</p>
                    </div>
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-200 text-center rounded-b-xl">
                    <button onClick={onClose} className="text-blue-600 hover:underline text-sm">Close Preview</button>
                </div>
            </div>
        </div>
    );
}
