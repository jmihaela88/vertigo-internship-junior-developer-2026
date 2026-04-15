import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { api, Market } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { MarketCard } from "@/components/market-card";
import { useNavigate } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";

function DashboardPage() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"active" | "resolved" | "archived">("active");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<"createdAt" | "totalBetSize" | "participants">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const hasNextPage = markets.length === 20;
  const showPagination = !isLoading && (page > 1 || hasNextPage);

  const loadMarkets = async (isPolling = false) => {
    try {
      if (!isPolling) setIsLoading(true);
      setError(null);
      const data = await api.listMarkets({
        status,
        page,
        limit: 20,
        sortBy,
        sortOrder,
      });
      setMarkets(data);
    } catch (err) {
      if (!isPolling) {
        setError(err instanceof Error ? err.message : "Failed to load markets");
      }
    } finally {
      if (!isPolling) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMarkets();
    const interval = setInterval(() => loadMarkets(true), 5000);
    return () => clearInterval(interval);
  }, [status, page, sortBy, sortOrder]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4 text-gray-900">Prediction Markets</h1>
          <p className="text-gray-600 mb-8 text-lg">Create and participate in prediction markets</p>
          <div className="space-x-4">
            <Button onClick={() => navigate({ to: "/auth/login" })}>Login</Button>
            <Button variant="outline" onClick={() => navigate({ to: "/auth/register" })}>
              Sign Up
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Markets</h1>
            <p className="text-gray-600 mt-2">
              Welcome back, {user?.username}! {user?.role === "admin" ? "(Admin Oracle)" : ""}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate({ to: "/profile" })}>
              Profile
            </Button>
            <Button variant="outline" onClick={() => navigate({ to: "/leaderboard" })}>
              Leaderboard
            </Button>
            <Button variant="outline" onClick={() => navigate({ to: "/auth/logout" })}>
              Logout
            </Button>
            <Button onClick={() => navigate({ to: "/markets/new" })}>Create Market</Button>
          </div>
        </div>

        {/* Filters and Sorting */}
        <div className="mb-6 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-4">
            <Select
              value={status}
              onValueChange={(value: "active" | "resolved" | "archived") => {
                setStatus(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active Markets</SelectItem>
                <SelectItem value="resolved">Resolved Markets</SelectItem>
                <SelectItem value="archived">Archived Markets</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={sortBy}
              onValueChange={(value: "createdAt" | "totalBetSize" | "participants") => {
                setSortBy(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">Date Created</SelectItem>
                <SelectItem value="totalBetSize">Total Volume</SelectItem>
                <SelectItem value="participants">Participants</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              title={sortOrder === "asc" ? "Ascending" : "Descending"}
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-6">
            {error}
          </div>
        )}

        {/* Markets Grid */}
        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Loading markets...</p>
            </CardContent>
          </Card>
        ) : markets.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="text-muted-foreground text-lg">
                  {page > 1
                    ? "No markets on this page. Try going back one page."
                    : `No ${status} markets found. ${status === "active" ? "Create one to get started!" : ""}`}
                </p>
                {page > 1 && (
                  <Button variant="outline" className="mt-4" onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    Go to Previous Page
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-6">
              {markets.map((market) => (
                <MarketCard key={market.id} market={market} isAdmin={user?.role === "admin"} />
              ))}
            </div>

          </>
        )}

        {/* Pagination Controls */}
        {showPagination && (
          <div className="flex items-center justify-center gap-4 mt-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
            <span className="text-sm font-medium">Page {page}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={!hasNextPage}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: DashboardPage,
});
