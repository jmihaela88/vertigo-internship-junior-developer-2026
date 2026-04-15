const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4001";

// Types
export interface Market {
  id: number;
  title: string;
  description?: string;
  status: "active" | "resolved" | "archived";
  resolvedOutcomeId?: number | null;
  createdAt: string;
  creator?: string;
  outcomes: MarketOutcome[];
  totalMarketBets: number;
  participantsCount: number;
}

export interface MarketOutcome {
  id: number;
  title: string;
  odds: number;
  totalBets: number;
}

export interface ListMarketsOptions {
  status?: "active" | "resolved" | "archived";
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "totalBetSize" | "participants";
  sortOrder?: "asc" | "desc";
}

export interface User {
  id: number;
  username: string;
  email: string;
  role: "user" | "admin";
  balance?: number;
  hasApiKey?: boolean;
  apiKeyId?: string | null;
  apiKeyCreatedAt?: string | null;
  apiKeyLastUsedAt?: string | null;
  token: string;
}

export interface ApiKeyResponse {
  apiKey?: string;
  apiKeyId?: string;
  apiKeyCreatedAt?: string;
  hasApiKey: boolean;
  message: string;
}

export interface Bet {
  id: number;
  userId: number;
  marketId: number;
  outcomeId: number;
  amount: number;
  createdAt: string;
}

export interface ResolvedBet {
  id: number;
  amount: number;
  createdAt: string;
  marketTitle: string;
  outcomeTitle: string;
  status: "won" | "lost";
}

export interface ActiveBet {
  id: number;
  amount: number;
  createdAt: string;
  marketId: number;
  marketTitle: string;
  outcomeTitle: string;
  outcomeId: number;
  odds: number;
}

export interface CreatedMarket {
  id: number;
  title: string;
  description: string | null;
  status: "active" | "resolved" | "archived";
  createdAt: string;
  outcomesCount: number;
  totalMarketBets: number;
  participantsCount: number;
}

export interface AdminResolvedMarket {
  id: number;
  title: string;
  resolvedAt: string | null;
  winningOutcome: string | null;
  totalMarketBets: number;
  participantsCount: number;
}

export interface UserBetsResponse {
  resolved: ResolvedBet[];
  active: ActiveBet[];
  markets: CreatedMarket[];
  adminResolvedMarkets: AdminResolvedMarket[];
  pagination: {
    resolved: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    active: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    markets: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    adminResolvedMarkets: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface LeaderboardEntry {
  rank: number;
  userId: number;
  username: string;
  totalWinnings: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// API Client
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getAuthHeader() {
    const token = localStorage.getItem("auth_token");
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      ...this.getAuthHeader(),
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      // If there are validation errors, throw them
      if (data.errors && Array.isArray(data.errors)) {
        const errorMessage = data.errors.map((e: any) => `${e.field}: ${e.message}`).join(", ");
        throw new Error(errorMessage);
      }
      throw new Error(data.error || `API Error: ${response.status}`);
    }

    return data ?? {};
  }

  // Auth endpoints
  async register(username: string, email: string, password: string): Promise<User> {
    return this.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    });
  }

  async login(email: string, password: string): Promise<User> {
    return this.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  // Markets endpoints
  async listMarkets(options: ListMarketsOptions = {}): Promise<Market[]> {
    const params = new URLSearchParams();
    if (options.status) params.append("status", options.status);
    if (options.page) params.append("page", options.page.toString());
    if (options.limit) params.append("limit", options.limit.toString());
    if (options.sortBy) params.append("sortBy", options.sortBy);
    if (options.sortOrder) params.append("sortOrder", options.sortOrder);
    
    return this.request(`/api/markets?${params.toString()}`);
  }

  async getMarket(id: number): Promise<Market> {
    return this.request(`/api/markets/${id}`);
  }

  async createMarket(title: string, description: string, outcomes: string[]): Promise<Market> {
    return this.request("/api/markets", {
      method: "POST",
      body: JSON.stringify({ title, description, outcomes }),
    });
  }

  async resolveMarket(
    marketId: number,
    outcomeId: number,
  ): Promise<{
    id: number;
    status: "resolved";
    resolvedOutcomeId: number;
    payoutUsersCount: number;
    payoutTotal: number;
    message: string;
  }> {
    return this.request(`/api/markets/${marketId}/resolve`, {
      method: "POST",
      body: JSON.stringify({ outcomeId }),
    });
  }

  async archiveMarket(
    marketId: number,
  ): Promise<{ id: number; status: "archived"; refundUsersCount: number; refundTotal: number; message: string }> {
    return this.request(`/api/markets/${marketId}/archive`, {
      method: "POST",
    });
  }

  // Bets endpoints
  async placeBet(marketId: number, outcomeId: number, amount: number): Promise<Bet> {
    return this.request(`/api/markets/${marketId}/bets`, {
      method: "POST",
      body: JSON.stringify({ outcomeId, amount }),
    });
  }

  async getUserBets(query: {
    pageResolved?: number;
    limitResolved?: number;
    pageActive?: number;
    limitActive?: number;
    pageMarkets?: number;
    limitMarkets?: number;
    pageAdminResolved?: number;
    limitAdminResolved?: number;
  } = {}): Promise<UserBetsResponse> {
    const params = new URLSearchParams();
    if (query.pageResolved) params.append("pageResolved", query.pageResolved.toString());
    if (query.limitResolved) params.append("limitResolved", query.limitResolved.toString());
    if (query.pageActive) params.append("pageActive", query.pageActive.toString());
    if (query.limitActive) params.append("limitActive", query.limitActive.toString());
    if (query.pageMarkets) params.append("pageMarkets", query.pageMarkets.toString());
    if (query.limitMarkets) params.append("limitMarkets", query.limitMarkets.toString());
    if (query.pageAdminResolved) {
      params.append("pageAdminResolved", query.pageAdminResolved.toString());
    }
    if (query.limitAdminResolved) {
      params.append("limitAdminResolved", query.limitAdminResolved.toString());
    }

    return this.request(`/api/users/me/bets?${params.toString()}`);
  }
  async getCurrentUser(): Promise<User> {
    return this.request("/api/users/me");
  }

  async generateApiKey(): Promise<ApiKeyResponse> {
    return this.request("/api/users/me/api-key", {
      method: "POST",
    });
  }

  async revokeApiKey(): Promise<ApiKeyResponse> {
    return this.request("/api/users/me/api-key", {
      method: "DELETE",
    });
  }

  async getLeaderboard(query: { page?: number; limit?: number; username?: string } = {}): Promise<LeaderboardResponse> {
    const params = new URLSearchParams();
    if (query.page) params.append("page", query.page.toString());
    if (query.limit) params.append("limit", query.limit.toString());
    if (query.username) params.append("username", query.username);

    return this.request(`/api/users/leaderboard?${params.toString()}`);
  }
}

export const api = new ApiClient(API_BASE_URL);
