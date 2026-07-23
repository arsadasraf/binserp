export interface Skill {
    _id: string;
    name: string;
    description?: string;
    company: string;
    createdAt: string;
    updatedAt: string;
}

export interface Holiday {
    _id: string;
    name: string;
    date: string;
    type: string;
    isActive: boolean;
    company: string;
}

export interface Department {
    _id: string;
    name: string;
    description?: string;
    company: string;
    createdAt: string;
    updatedAt: string;
}

export interface EmployeeType {
    _id: string;
    name: string;
    description?: string;
    company: string;
    createdAt: string;
    updatedAt: string;
}

export interface Designation {
    _id: string;
    name: string;
    description?: string;
    company: string;
    createdAt: string;
    updatedAt: string;
}

export interface Employee {
    _id: string;
    employeeId: string;
    name: string;
    email: string;
    contact: string;
    department: string;
    employeeType?: string;
    designation: string;
    joiningDate: string;
    status: "Active" | "Inactive" | "Terminated" | "OnLeave";
    isActive?: boolean;
    paymentDetails?: {
        accountNumber: string;
        bankName: string;
        ifscCode: string;
        branchName: string;
    };
    photo?: string;
    faceEncoding?: string;
    experience?: string;
    degree?: string;
    salary?: {
        basic: number;
        hra: number;
        conveyance: number;
        medical: number;
        specialAllowance: number;
        pf: number;
        professionalTax: number;
        grossSalary: number;
        netSalary: number;
        deductions?: number;
        incentives?: number;
        perDayCalculationBasis?: string;
        otRate?: number;
    };
    leaves?: {
        casualLeave: number;
        sickLeave: number;
    };
    standardWorkingHours?: number;
    weeklyOff?: string;
    holidayWorkPolicy?: string;
    weekOffWorkPolicy?: string;
    leaveHistory?: {
        date: string;
        type: string;
        month: string;
        year: number;
    }[];
    skills: {
        name: string;
        level: number;
        certified: boolean;
    }[];
    createdAt: string;
    updatedAt: string;
}

export interface Salary {
    _id: string;
    employee: Employee | string; // Can be populated
    month: string;
    year: number;
    workingDays: number;
    presentDays: number;
    salaryComponents: {
        basic: number;
        hra: number;
        conveyance: number;
        medical: number;
        specialAllowance: number;
        pf: number;
        professionalTax: number;
    };
    overtime: {
        hours: number;
        rate: number;
        amount: number;
    };
    deductions: number;
    incentives?: number;
    grossSalary: number;
    netSalary: number;
    status: "Draft" | "Paid";
    paymentDate?: string;
    remarks?: string;
    createdAt: string;
    updatedAt: string;
}
