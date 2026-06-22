import { API_BASE_URL } from "@/src/utils/config";

// Fix: Ensure API_URL always ends with /api
const getApiUrl = () => {
    const baseUrl = API_BASE_URL || "http://localhost:8000";
    return baseUrl.endsWith("/api") ? baseUrl : `${baseUrl}/api`;
};

const API_URL = getApiUrl();
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

interface SaasAdminAuthClient {
    token: string | null;
}

class SaasAdminAuth {
    private getToken(): string | null {
        if (typeof window === "undefined") return null;
        return localStorage.getItem(SAAS_ADMIN_TOKEN_KEY);
    }

    private setToken(token: string): void {
        if (typeof window === "undefined") return;
        localStorage.setItem(SAAS_ADMIN_TOKEN_KEY, token);
    }

    private removeToken(): void {
        if (typeof window === "undefined") return;
        localStorage.removeItem(SAAS_ADMIN_TOKEN_KEY);
    }

    async login(username: string, password: string): Promise<LoginResponse> {
        try {
            console.log("🔐 Attempting login to:", `${API_URL}/saasadmin/login`);

            const response = await fetch(`${API_URL}/saasadmin/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ username, password }),
                credentials: "include",
            });

            console.log("📡 Response status:", response.status);

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
            console.log("✅ Login successful");

            // Store token
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

        const response = await fetch(`${API_URL}/saasadmin${endpoint}`, {
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

    async exportCompaniesCSV(): Promise<void> {
        try {
            const token = this.getToken();
            if (!token) throw new Error("Not authenticated");

            const response = await fetch(`${API_URL}/saasadmin/export/companies`, {
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
            a.download = `companies_${new Date().toISOString().split('T')[0]}.csv`;
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

            const response = await fetch(`${API_URL}/saasadmin/export/users`, {
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
            a.download = `users_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Export error:", error);
            throw error;
        }
    }
}

export const saasAdminAuth = new SaasAdminAuth();
