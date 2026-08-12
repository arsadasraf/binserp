import { API_BASE_URL } from "@/src/utils/config";

const getApiUrl = (): string => {
    // 1. Priority: Environment Variable
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    if (envUrl && envUrl !== "undefined" && envUrl.trim() !== "") {
        const cleaned = envUrl.replace(/\/+$/, "");
        return cleaned.endsWith("/api") ? cleaned : `${cleaned}/api`;
    }

    // 2. Priority: Browser Runtime
    if (typeof window !== "undefined") {
        const host = window.location.hostname;
        if (host === "localhost" || host === "127.0.0.1") {
            return `http://${host}:8000/api`;
        }
        // Production Nginx reverse proxy: current origin + /api
        return `${window.location.origin}/api`;
    }

    // 3. Fallback
    const base = API_BASE_URL || "http://localhost:8000";
    const cleaned = base.replace(/\/+$/, "");
    return cleaned.endsWith("/api") ? cleaned : `${cleaned}/api`;
};

const SAAS_ADMIN_TOKEN_KEY = "saasAdminToken";

interface LoginResponse {
    success: boolean;
    data: {
        admin: {
            id: string;
            username: string;
            email: string;
            roleLevel: number;
        };
        token: string;
    };
    message: string;
}

class SaasAdminAuth {
    private getToken(): string | null {
        if (typeof window === "undefined") return null;
        return localStorage.getItem(SAAS_ADMIN_TOKEN_KEY) || localStorage.getItem("token");
    }

    private setToken(token: string): void {
        if (typeof window === "undefined") return;
        localStorage.setItem(SAAS_ADMIN_TOKEN_KEY, token);
    }

    private removeToken(): void {
        if (typeof window === "undefined") return;
        localStorage.removeItem(SAAS_ADMIN_TOKEN_KEY);
        localStorage.removeItem("token");
        localStorage.removeItem("userType");
    }

    async login(username: string, password: string): Promise<LoginResponse> {
        try {
            const apiUrl = getApiUrl();
            const response = await fetch(`${apiUrl}/saasadmin/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ username, password }),
                credentials: "include",
            });

            if (!response.ok) {
                let errorMessage = "Login failed";
                try {
                    const data = await response.json();
                    errorMessage = data.message || errorMessage;
                } catch (e) {
                    errorMessage = `Server error: ${response.status} ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();
            this.setToken(data.data.token);
            return data;
        } catch (error: any) {
            console.error("❌ Login error:", error);
            if (error.message === "Failed to fetch") {
                throw new Error("Cannot connect to server. Please ensure the backend is running.");
            }
            throw error;
        }
    }

    logout(): void {
        this.removeToken();
        if (typeof window !== "undefined") {
            window.location.href = "/binssaas";
        }
    }

    isAuthenticated(): boolean {
        return this.getToken() !== null;
    }

    getAuthHeaders(): HeadersInit {
        const token = this.getToken();
        return {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
    }

    async fetchWithAuth(endpoint: string, options: RequestInit = {}): Promise<any> {
        const token = this.getToken();
        if (!token) {
            throw new Error("Not authenticated");
        }

        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/saasadmin${endpoint}`, {
            ...options,
            headers: {
                ...this.getAuthHeaders(),
                ...options.headers,
            },
            credentials: "include",
        });

        const data = await response.json();

        if (!response.ok) {
            if (response.status === 401) {
                this.logout();
            }
            throw new Error(data.message || "Request failed");
        }

        return data;
    }

    async toggleUserBlock(userId: string, companyId: string, isEmployee: boolean): Promise<any> {
        return this.fetchWithAuth(`/users/${userId}/block`, {
            method: "PUT",
            body: JSON.stringify({ companyId, isEmployee }),
        });
    }

    async toggleCompanySuspend(companyId: string, isCurrentlySuspended: boolean): Promise<any> {
        const endpoint = isCurrentlySuspended ? `/companies/${companyId}/unsuspend` : `/companies/${companyId}/suspend`;
        return this.fetchWithAuth(endpoint, {
            method: "PUT",
            body: JSON.stringify({ reason: "Blocked by SaaS Platform Administrator" }),
        });
    }

    async getCompanyRoles(companyId: string): Promise<any> {
        return this.fetchWithAuth(`/companies/${companyId}/roles`);
    }

    async exportCompaniesCSV(): Promise<void> {
        try {
            const token = this.getToken();
            if (!token) throw new Error("Not authenticated");

            const apiUrl = getApiUrl();
            const response = await fetch(`${apiUrl}/saasadmin/export/companies`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                credentials: "include",
            });

            if (!response.ok) throw new Error("Export failed");

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `companies_${new Date().toISOString().split("T")[0]}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Export error:", error);
            throw error;
        }
    }

    async exportUsersCSV(): Promise<void> {
        try {
            const token = this.getToken();
            if (!token) throw new Error("Not authenticated");

            const apiUrl = getApiUrl();
            const response = await fetch(`${apiUrl}/saasadmin/export/users`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                credentials: "include",
            });

            if (!response.ok) throw new Error("Export failed");

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `users_${new Date().toISOString().split("T")[0]}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Export error:", error);
            throw error;
        }
    }
}

export const saasAdminAuth = new SaasAdminAuth();
