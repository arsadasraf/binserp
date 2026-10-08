import { salarySchema, employeeSchema } from "../../models/hr/index.js";

const getCompanyId = (req) => {
    if (!req.user) throw new Error("User context missing in request");
    if (req.userType === "company") return req.user.id;
    if (req.userType === "user" || req.userType === "saasadmin" || req.userType === "employee") {
        if (req.user.company && req.user.company._id) return req.user.company._id;
        if (req.user.company) return req.user.company;
    }
    throw new Error("Could not resolve company ID from request context");
};

export const bulkCreateSalaries = async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        const { month, year, salaries, overwrite = false } = req.body;

        if (!month || !year || !Array.isArray(salaries) || salaries.length === 0) {
            return res.status(400).json({ message: "Month, year, and a non-empty array of salaries are required." });
        }

        const Employee = req.getModel('Employee', employeeSchema);
        const Salary = req.getModel('Salary', salarySchema);

        let createdCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        const errors = [];

        for (const item of salaries) {
            try {
                const {
                    employeeId, presentDays, workingDays = 30, totalDutyHours = 0,
                    totalOtHours = 0, otRatePH = 0, grossPay = 0, otPay = 0, netPay = 0,
                    dailyLogs = [], leavesConsumed = { casualLeave: 0, sickLeave: 0, compOff: 0 },
                    compOffAccrued = 0, salaryComponents, employerContributions
                } = item;

                if (!employeeId) {
                    errors.push({ employeeId: "unknown", error: "Missing employeeId" });
                    continue;
                }

                const employee = await Employee.findOne({ _id: employeeId, company: companyId });
                if (!employee) {
                    errors.push({ employeeId, error: "Employee not found in company" });
                    continue;
                }

                const existing = await Salary.findOne({
                    company: companyId,
                    employee: employeeId,
                    month,
                    year: Number(year)
                });

                if (existing && !overwrite) {
                    skippedCount++;
                    continue;
                }

                const salaryData = {
                    company: companyId,
                    employee: employeeId,
                    month,
                    year: Number(year),
                    workingDays,
                    presentDays: presentDays || 0,
                    totalDutyHours: totalDutyHours || 0,
                    otRatePH: otRatePH || 0,
                    salaryComponents: {
                        basic: employee.salary?.basic || 0,
                        hra: employee.salary?.hra || 0,
                        conveyance: employee.salary?.conveyance || 0,
                        medical: employee.salary?.medical || 0,
                        specialAllowance: employee.salary?.specialAllowance || 0,
                        pf: salaryComponents?.pf ?? employee.salary?.pf ?? 0,
                        esi: salaryComponents?.esi ?? 0,
                        professionalTax: salaryComponents?.professionalTax ?? employee.salary?.professionalTax ?? 0
                    },
                    employerContributions: {
                        pf: employerContributions?.pf ?? 0,
                        esi: employerContributions?.esi ?? 0
                    },
                    overtime: {
                        hours: totalOtHours || 0,
                        rate: otRatePH || 0,
                        amount: otPay || 0
                    },
                    grossSalary: grossPay || 0,
                    netSalary: netPay || 0,
                    dailyLogs: dailyLogs || [],
                    leavesConsumed: leavesConsumed || { casualLeave: 0, sickLeave: 0, compOff: 0 },
                    compOffAccrued: compOffAccrued || 0,
                    status: "Draft",
                    recordType: "Combined",
                    remarks: `Bulk generated for ${presentDays} present days.`,
                    updatedBy: req.user._id
                };

                if (existing) {
                    // Update existing
                    await Salary.updateOne({ _id: existing._id }, { $set: salaryData });
                    updatedCount++;
                } else {
                    // Create new
                    salaryData.generatedBy = req.user._id;
                    const newSalary = new Salary(salaryData);
                    await newSalary.save();
                    createdCount++;
                }

                // Update employee leaves and comp-off if newly generated or applicable
                let employeeUpdated = false;
                if (compOffAccrued > 0) {
                    employee.compOffBalance = (employee.compOffBalance || 0) + compOffAccrued;
                    employeeUpdated = true;
                }

                if (leavesConsumed && (leavesConsumed.casualLeave > 0 || leavesConsumed.sickLeave > 0 || leavesConsumed.compOff > 0)) {
                    if (employee.leaves) {
                        employee.leaves.casualLeave = Math.max(0, employee.leaves.casualLeave - (leavesConsumed.casualLeave || 0));
                        employee.leaves.sickLeave = Math.max(0, employee.leaves.sickLeave - (leavesConsumed.sickLeave || 0));
                    }
                    if (leavesConsumed.compOff > 0) {
                        employee.compOffBalance = Math.max(0, (employee.compOffBalance || 0) - leavesConsumed.compOff);
                    }
                    employeeUpdated = true;
                }

                if (employeeUpdated) {
                    await Employee.updateOne(
                        { _id: employee._id },
                        {
                            $set: {
                                compOffBalance: employee.compOffBalance,
                                leaves: employee.leaves
                            }
                        }
                    );
                }

            } catch (itemErr) {
                console.error(`Error processing salary for employee ${item.employeeId}:`, itemErr);
                errors.push({ employeeId: item.employeeId, error: itemErr.message });
            }
        }

        return res.status(200).json({
            success: true,
            totalProcessed: salaries.length,
            createdCount,
            updatedCount,
            skippedCount,
            errors
        });

    } catch (error) {
        console.error("Error in bulkCreateSalaries:", error);
        return res.status(500).json({ message: `Server error during bulk salary generation: ${error.message}` });
    }
};
