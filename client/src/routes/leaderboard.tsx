import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useDeferredValue, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { LeaderboardEntry } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function LeaderboardPage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<Array<LeaderboardEntry>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);
  const [searchUsername, setSearchUsername] = useState("");
  const deferredSearch = useDeferredValue(searchUsername);

  const limit = 20;

  useEffect(() => {
    if (isAuthLoading) return;

    if (!isAuthenticated) {
      navigate({ to: "/auth/login" });
      return;
    }

    const loadLeaderboard = async () => {
      try {
        setError(null);
        const username = deferredSearch.trim();
        const data = await api.getLeaderboard({
          page,
          limit,
          ...(username ? { username } : {}),
        });
        setEntries(data.entries);
        setTotalPages(Math.max(1, data.pagination.totalPages));
        setTotalEntries(data.pagination.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load leaderboard");
      } finally {
        setIsLoading(false);
      }
    };

    loadLeaderboard();

    const interval = setInterval(loadLeaderboard, 15000);
    return () => clearInterval(interval);
  }, [isAuthenticated, isAuthLoading, navigate, page, deferredSearch]);

  useEffect(() => {
    setPage(1);
  }, [deferredSearch]);

  if (isAuthLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading leaderboard...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-4xl mx-auto px-4 space-y-6">
        <Button variant="outline" onClick={() => navigate({ to: "/" })}>
          ← Back to Markets
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Leaderboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 flex-col sm:flex-row">
              <Input
                placeholder="Search by username..."
                value={searchUsername}
                onChange={(e) => setSearchUsername(e.target.value)}
                className="flex-1"
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {entries.length === 0 ? (
              <p className="text-muted-foreground">
                {deferredSearch.trim() ? "No users match your search." : "No users found."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                      <th className="px-6 py-3">Rank</th>
                      <th className="px-6 py-3">User</th>
                      <th className="px-6 py-3 text-right">Total Winnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.userId} className="bg-white border-b hover:bg-gray-50">
                        <td className="px-6 py-4 font-semibold">#{entry.rank}</td>
                        <td className="px-6 py-4 font-medium">{entry.username}</td>
                        <td className="px-6 py-4 text-right font-bold text-green-700">
                          ${entry.totalWinnings.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-between gap-4 pt-2">
              <p className="text-sm text-muted-foreground">{totalEntries} total users</p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-sm font-medium">Page {page} of {totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/leaderboard")({
  component: LeaderboardPage,
});
