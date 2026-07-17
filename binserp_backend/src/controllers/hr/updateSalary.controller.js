import { salarySchema, employeeSchema, attendanceSchema } from "../../models/hr/index.js";

// Same helper as hr.controller.js - resolves company _id from JWT user context
const getCompanyId = (req) => {
    if (!req.user) throw new Error("User context missing in request");
    if (req.userType === "company") return req.user.id;
    if (req.userType === "user" || req.userType === "saasadmin" || req.userType === "employee") {
        if (req.user.company && req.user.company._id) return req.user.company._id;
        if (req.user.company) return req.user.company;
    }
    throw new Error("Could not resolve company ID from request context");
};

// Create Salary Slip (Save from frontend with manual logs)

export const updateSalary = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = getCompanyId(req);
        const Salary = req.getModel('Salary', salarySchema);
        const Employee = req.getModel('Employee', employeeSchema);

        const existingSalary = await Salary.findOne({ _id: id, company: companyId });
        if (!existingSalary) return res.status(404).json({ message: "Salary record not found" });

        const updates = { ...req.body };

        if (req.body.totalOtHours !== undefined) {
            updates.overtime = {
                hours: req.body.totalOtHours || 0,
                rate: req.body.otRatePH || 0,
                amount: req.body.otPay || 0
            };
        }
        if (req.body.grossPay !== undefined) updates.grossSalary = req.body.grossPay;
        if (req.body.netPay !== undefined) updates.netSalary = req.body.netPay;

        if (updates.status === 'Paid' && !updates.paymentDate) {
            updates.paymentDate = new Date();
        }

        const salary = await Salary.findOneAndUpdate(
            { _id: id, company: companyId },
            updates,
            { new: true }
        );

        if (!salary) return res.status(404).json({ message: "Salary record not found" });

        // Handle leaves tracking
        if (req.body.leavesConsumed !== undefined) {
            const employee = await Employee.findOne({ _id: existingSalary.employee, company: companyId });
            if (employee && employee.leaves) {
                const oldCL = existingSalary.leavesConsumed?.casualLeave || 0;
                const oldSL = existingSalary.leavesConsumed?.sickLeave || 0;
                const newCL = req.body.leavesConsumed?.casualLeave || 0;
                const newSL = req.body.leavesConsumed?.sickLeave || 0;
                
                const diffCL = newCL - oldCL;
                const diffSL = newSL - oldSL;

                employee.leaves.casualLeave = Math.max(0, employee.leaves.casualLeave - diffCL);
                employee.leaves.sickLeave = Math.max(0, employee.leaves.sickLeave - diffSL);
                
                // Clear out history for this specific month/year
                if (employee.leaveHistory && Array.isArray(employee.leaveHistory)) {
                    employee.leaveHistory = employee.leaveHistory.filter(
                        h => !(h.month === existingSalary.month && h.year === existingSalary.year)
                    );
                } else {
                    employee.leaveHistory = [];
                }

                // Re-add history based on new dailyLogs
                if (req.body.dailyLogs && Array.isArray(req.body.dailyLogs)) {
                    req.body.dailyLogs.forEach(log => {
                        if (log.useManual && (log.manualStatus === 'CL' || log.manualStatus === 'SL')) {
                            employee.leaveHistory.push({
                                date: log.date,
                                type: log.manualStatus,
                                month: existingSalary.month,
                                year: existingSalary.year
                            });
                        }
                    });
                }

                await employee.save();
            }
        }

        if (!salary) return res.status(404).json({ message: "Salary record not found" });
        res.status(200).json(salary);
    } catch (error) {
        console.error("Error updating salary:", error);
        res.status(500).json({ message: "Error updating salary" });
    }
};

// Delete Salary
