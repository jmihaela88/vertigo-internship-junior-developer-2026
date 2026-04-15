import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { api, UserBetsResponse } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, isLoading: isAuthLoading, login } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<UserBetsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isApiKeyLoading, setIsApiKeyLoading] = useState(false);
  const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null);
  const [apiKeyNotice, setApiKeyNotice] = useState<string | null>(null);
  const [showApiPanel, setShowApiPanel] = useState(false);

  const [pageResolved, setPageResolved] = useState(1);
  const [pageActive, setPageActive] = useState(1);
  const [pageMarkets, setPageMarkets] = useState(1);
  const [pageAdminResolved, setPageAdminResolved] = useState(1);
  const [selectedSection, setSelectedSection] = useState<"active" | "resolved" | "markets" | "adminResolved">("active");

  const limit = 20;

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const response = await api.getUserBets({
        pageResolved,
        limitResolved: limit,
        pageActive,
        limitActive: limit,
        pageMarkets,
        limitMarkets: limit,
        pageAdminResolved,
        limitAdminResolved: limit,
      });
      setData(response);

      // Keep profile balance in sync with server-side payouts/refunds.
      const refreshedUser = await api.getCurrentUser();
      if (user.token) {
        login({ ...refreshedUser, token: user.token });
      }
    } catch (err) {
      console.error("Failed to fetch bets", err);
    } finally {
      setLoading(false);
    }
  }, [pageResolved, pageActive, pageMarkets, pageAdminResolved, user, login]);

  const refreshCurrentUser = useCallback(async () => {
    if (!user?.token) return;
    const refreshedUser = await api.getCurrentUser();
    login({ ...refreshedUser, token: user.token });
  }, [login, user]);

  const handleGenerateApiKey = async () => {
    if (!user) return;

    try {
      setIsApiKeyLoading(true);
      setApiKeyNotice(null);
      const result = await api.generateApiKey();
      setGeneratedApiKey(result.apiKey || null);
      setApiKeyNotice("API key generated. Copy it now because it will not be shown again.");
      await refreshCurrentUser();
    } catch (err) {
      setApiKeyNotice(err instanceof Error ? err.message : "Failed to generate API key");
    } finally {
      setIsApiKeyLoading(false);
    }
  };

  const handleRevokeApiKey = async () => {
    if (!user) return;

    try {
      setIsApiKeyLoading(true);
      setApiKeyNotice(null);
      await api.revokeApiKey();
      setGeneratedApiKey(null);
      setApiKeyNotice("API key revoked successfully.");
      await refreshCurrentUser();
    } catch (err) {
      setApiKeyNotice(err instanceof Error ? err.message : "Failed to revoke API key");
    } finally {
      setIsApiKeyLoading(false);
    }
  };

  const handleCopyApiKey = async () => {
    if (!generatedApiKey) return;

    try {
      await navigator.clipboard.writeText(generatedApiKey);
      setApiKeyNotice("API key copied to clipboard.");
    } catch {
      setApiKeyNotice("Could not copy API key. Please copy it manually.");
    }
  };

  useEffect(() => {
    if (isAuthLoading) return;

    if (!user) {
      navigate({ to: "/auth/login" });
      return;
    }
    fetchData();

    // Poll for active bets updates every 5 seconds
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [user, navigate, fetchData, isAuthLoading]);

  if (isAuthLoading) {
    return <div className="p-8 text-center">Checking authentication...</div>;
  }


  if (loading && !data) {
    return <div className="p-8 text-center">Loading profile...</div>;
  }

  if (!data) return null;

  const activeCount = data.pagination.active.total;
  const resolvedCount = data.pagination.resolved.total;
  const createdMarketsCount = data.pagination.markets.total;
  const adminResolvedCount = data.pagination.adminResolvedMarkets.total;
  const userInitial = user?.username?.charAt(0).toUpperCase() || "U";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-7xl mx-auto px-4 space-y-6">
        <Button variant="outline" onClick={() => navigate({ to: "/" })}>
          ← Back to Markets
        </Button>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold">
                  {userInitial}
                </div>
                <div>
                  <h1 className="text-3xl font-bold">{user?.username}</h1>
                  <p className="text-muted-foreground">
                    {user?.email} {user?.role === "admin" ? "• Admin" : "• User"}
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-6 py-4 text-right">
                <p className="text-sm text-emerald-700">Current Balance</p>
                <p className="text-3xl font-bold text-emerald-800">${user?.balance?.toFixed(2) || "0.00"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="max-w-7xl mx-auto px-4 space-y-6">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg">API Access</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Status: <span className="font-semibold">{user?.hasApiKey ? "Active" : "No API key"}</span>
                </p>
              </div>
              <Button variant="outline" onClick={() => setShowApiPanel((v) => !v)}>
                {showApiPanel ? "Hide API Controls" : "Manage API Key"}
              </Button>
            </div>

            {showApiPanel && (
              <>
                <p className="text-sm text-gray-600">
                  Generate an API key to place bets programmatically. Use it with `Authorization: ApiKey &lt;key&gt;` or the `x-api-key` header.
                </p>

                {apiKeyNotice && (
                  <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
                    {apiKeyNotice}
                  </div>
                )}

                {generatedApiKey && (
                  <div className="space-y-2 rounded-md border border-dashed border-amber-300 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-900">New API Key</p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <code className="flex-1 break-all rounded bg-white px-3 py-2 text-sm text-gray-900 border">
                        {generatedApiKey}
                      </code>
                      <Button variant="outline" onClick={handleCopyApiKey} disabled={isApiKeyLoading}>
                        Copy
                      </Button>
                    </div>
                    <p className="text-xs text-amber-900/80">
                      Save this key now. You will not be able to view it again after leaving this page.
                    </p>
                  </div>
                )}

                <div className="grid gap-2 text-sm text-gray-700">
                  {user?.apiKeyId && (
                    <div>
                      Key ID: <span className="font-mono">{user.apiKeyId}</span>
                    </div>
                  )}
                  {user?.apiKeyCreatedAt && (
                    <div>
                      Created: {new Date(user.apiKeyCreatedAt).toLocaleString()}
                    </div>
                  )}
                  {user?.apiKeyLastUsedAt && (
                    <div>
                      Last used: {new Date(user.apiKeyLastUsedAt).toLocaleString()}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button onClick={handleGenerateApiKey} disabled={isApiKeyLoading}>
                    {user?.hasApiKey ? "Rotate API Key" : "Generate API Key"}
                  </Button>
                  {user?.hasApiKey && (
                    <Button variant="outline" onClick={handleRevokeApiKey} disabled={isApiKeyLoading}>
                      Revoke API Key
                    </Button>
                  )}
                </div>
              </>
            )}
            {!showApiPanel && (
              <p className="text-xs text-muted-foreground">
                Click "Manage API Key" to generate, rotate, or revoke your key.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className={`pt-6 grid grid-cols-1 gap-3 ${user?.role === "admin" ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
            <Button
              className="h-12 justify-between px-4 text-base font-semibold"
              variant={selectedSection === "active" ? "default" : "outline"}
              onClick={() => setSelectedSection("active")}
            >
              Active Bets
              <Badge variant="secondary">{activeCount}</Badge>
            </Button>
            <Button
              className="h-12 justify-between px-4 text-base font-semibold"
              variant={selectedSection === "resolved" ? "default" : "outline"}
              onClick={() => setSelectedSection("resolved")}
            >
              Resolved Bets
              <Badge variant="secondary">{resolvedCount}</Badge>
            </Button>
            <Button
              className="h-12 justify-between px-4 text-base font-semibold"
              variant={selectedSection === "markets" ? "default" : "outline"}
              onClick={() => setSelectedSection("markets")}
            >
              Created Markets
              <Badge variant="secondary">{createdMarketsCount}</Badge>
            </Button>
            {user?.role === "admin" && (
              <Button
                className="h-12 justify-between px-4 text-base font-semibold"
                variant={selectedSection === "adminResolved" ? "default" : "outline"}
                onClick={() => setSelectedSection("adminResolved")}
              >
                Resolved By You
                <Badge variant="secondary">{adminResolvedCount}</Badge>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Active Bets */}
        {selectedSection === "active" && <Card>
          <CardHeader>
            <CardTitle>Active Bets</CardTitle>
          </CardHeader>
          <CardContent>
            {data.active.length === 0 ? (
              <div className="rounded-lg border border-dashed p-10 text-center text-gray-500">
                No active bets yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                      <th className="px-6 py-3">Market</th>
                      <th className="px-6 py-3">Outcome</th>
                      <th className="px-6 py-3">Amount</th>
                      <th className="px-6 py-3">Current Odds (%)</th>
                      <th className="px-6 py-3">Potential Payout</th>
                      {user?.role === "admin" && <th className="px-6 py-3">Admin Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {data.active.map((bet) => (
                      <tr key={bet.id} className="bg-white border-b hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium">{bet.marketTitle}</td>
                        <td className="px-6 py-4">{bet.outcomeTitle}</td>
                        <td className="px-6 py-4">${bet.amount}</td>
                        <td className="px-6 py-4">{bet.odds}%</td>
                        <td className="px-6 py-4 font-bold text-green-600">
                          {bet.odds > 0
                            ? `$${(bet.amount * (100 / bet.odds)).toFixed(2)}`
                            : "N/A"}
                        </td>
                        {user?.role === "admin" && (
                          <td className="px-6 py-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                navigate({
                                  to: "/markets/$id",
                                  params: { id: String(bet.marketId) },
                                })
                              }
                            >
                              Set Outcome
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Active Pagination */}
            {data.pagination.active.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  disabled={pageActive === 1}
                  onClick={() => setPageActive((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="flex items-center">
                  Page {pageActive} of {data.pagination.active.totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={pageActive === data.pagination.active.totalPages}
                  onClick={() => setPageActive((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>}

        {/* Resolved Bets */}
        {selectedSection === "resolved" && <Card>
          <CardHeader>
            <CardTitle>Resolved Bets</CardTitle>
          </CardHeader>
          <CardContent>
            {data.resolved.length === 0 ? (
              <div className="rounded-lg border border-dashed p-10 text-center text-gray-500">
                No resolved bets yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                      <th className="px-6 py-3">Market</th>
                      <th className="px-6 py-3">Outcome</th>
                      <th className="px-6 py-3">Amount</th>
                      <th className="px-6 py-3">Result</th>
                      <th className="px-6 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.resolved.map((bet) => (
                      <tr key={bet.id} className="bg-white border-b hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium">{bet.marketTitle}</td>
                        <td className="px-6 py-4">{bet.outcomeTitle}</td>
                        <td className="px-6 py-4">${bet.amount}</td>
                        <td className="px-6 py-4">
                          <Badge variant={bet.status === "won" ? "success" : "destructive"}>
                            {bet.status?.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          {new Date(bet.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Resolved Pagination */}
            {data.pagination.resolved.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  disabled={pageResolved === 1}
                  onClick={() => setPageResolved((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="flex items-center">
                  Page {pageResolved} of {data.pagination.resolved.totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={pageResolved === data.pagination.resolved.totalPages}
                  onClick={() => setPageResolved((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>}

        {/* Created Markets */}
        {selectedSection === "markets" && <Card>
          <CardHeader>
            <CardTitle>Created Markets</CardTitle>
          </CardHeader>
          <CardContent>
            {data.markets.length === 0 ? (
              <div className="rounded-lg border border-dashed p-10 text-center text-gray-500">
                You have not created any markets yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                      <th className="px-6 py-3">Title</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Outcomes</th>
                      <th className="px-6 py-3">Total Bets</th>
                      <th className="px-6 py-3">Participants</th>
                      <th className="px-6 py-3">Created</th>
                      <th className="px-6 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.markets.map((market) => (
                      <tr key={market.id} className="bg-white border-b hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium">{market.title}</td>
                        <td className="px-6 py-4">
                          <Badge variant={market.status === "active" ? "success" : "secondary"}>
                            {market.status.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">{market.outcomesCount}</td>
                        <td className="px-6 py-4">${market.totalMarketBets.toFixed(2)}</td>
                        <td className="px-6 py-4">{market.participantsCount}</td>
                        <td className="px-6 py-4">{new Date(market.createdAt).toLocaleDateString()}</td>
                        <td className="px-6 py-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              navigate({
                                to: "/markets/$id",
                                params: { id: String(market.id) },
                              })
                            }
                          >
                            Open
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Created Markets Pagination */}
            {data.pagination.markets.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  disabled={pageMarkets === 1}
                  onClick={() => setPageMarkets((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="flex items-center">
                  Page {pageMarkets} of {data.pagination.markets.totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={pageMarkets === data.pagination.markets.totalPages}
                  onClick={() => setPageMarkets((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>}

        {selectedSection === "adminResolved" && user?.role === "admin" && <Card>
          <CardHeader>
            <CardTitle>Markets Resolved By You</CardTitle>
          </CardHeader>
          <CardContent>
            {data.adminResolvedMarkets.length === 0 ? (
              <div className="rounded-lg border border-dashed p-10 text-center text-gray-500">
                You have not resolved any markets yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                      <th className="px-6 py-3">Market</th>
                      <th className="px-6 py-3">Winning Outcome</th>
                      <th className="px-6 py-3">Total Bets</th>
                      <th className="px-6 py-3">Participants</th>
                      <th className="px-6 py-3">Resolved At</th>
                      <th className="px-6 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.adminResolvedMarkets.map((market) => (
                      <tr key={market.id} className="bg-white border-b hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium">{market.title}</td>
                        <td className="px-6 py-4">
                          <Badge variant="secondary">{market.winningOutcome || "Unknown"}</Badge>
                        </td>
                        <td className="px-6 py-4">${market.totalMarketBets.toFixed(2)}</td>
                        <td className="px-6 py-4">{market.participantsCount}</td>
                        <td className="px-6 py-4">
                          {market.resolvedAt ? new Date(market.resolvedAt).toLocaleDateString() : "-"}
                        </td>
                        <td className="px-6 py-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              navigate({
                                to: "/markets/$id",
                                params: { id: String(market.id) },
                              })
                            }
                          >
                            Open
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {data.pagination.adminResolvedMarkets.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  disabled={pageAdminResolved === 1}
                  onClick={() => setPageAdminResolved((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="flex items-center">
                  Page {pageAdminResolved} of {data.pagination.adminResolvedMarkets.totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={pageAdminResolved === data.pagination.adminResolvedMarkets.totalPages}
                  onClick={() => setPageAdminResolved((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>}
      </div>
    </div>
  );
}
