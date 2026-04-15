import { useEffect, useState } from "react";
import { useParams, useNavigate, createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { api, Market } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

function MarketDetailPage() {
  const { id } = useParams({ from: "/markets/$id" });
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();
  const [market, setMarket] = useState<Market | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<number | null>(null);
  const [betAmount, setBetAmount] = useState("");
  const [isBetting, setIsBetting] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const marketId = parseInt(id, 10);

  useEffect(() => {
    const loadMarket = async () => {
      try {
        setIsLoading(true);
        const data = await api.getMarket(marketId);
        setMarket(data);
        if (data.outcomes.length > 0) {
          setSelectedOutcomeId(data.outcomes[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load market details");
      } finally {
        setIsLoading(false);
      }
    };

    loadMarket();
  }, [marketId]);

  const handlePlaceBet = async () => {
    if (!selectedOutcomeId || !betAmount) {
      setError("Please select an outcome and enter a bet amount");
      return;
    }

    const parsedAmount = Number.parseFloat(betAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Bet amount must be a positive number");
      return;
    }

    try {
      setIsBetting(true);
      setError(null);
      await api.placeBet(marketId, selectedOutcomeId, parsedAmount);
      setBetAmount("");
      // Reload market to show updated odds
      const updated = await api.getMarket(marketId);
      setMarket(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to place bet");
    } finally {
      setIsBetting(false);
    }
  };

  const handleResolveMarket = async () => {
    if (!market || !selectedOutcomeId) {
      setError("Please select an outcome to resolve this market");
      return;
    }

    if (user?.role !== "admin") {
      setError("Only admins can resolve markets");
      return;
    }

    const confirmed = window.confirm(
      "Resolve this market with the selected outcome? This action cannot be undone.",
    );
    if (!confirmed) return;

    try {
      setIsResolving(true);
      setError(null);
      const result = await api.resolveMarket(marketId, selectedOutcomeId);
      const updated = await api.getMarket(marketId);
      setMarket(updated);
      setError(null);
      window.alert(
        `Market resolved. Paid out $${result.payoutTotal.toFixed(2)} to ${result.payoutUsersCount} user(s).`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve market");
    } finally {
      setIsResolving(false);
    }
  };

  const handleArchiveMarket = async () => {
    if (!market) {
      setError("Market not found");
      return;
    }

    if (user?.role !== "admin") {
      setError("Only admins can archive markets");
      return;
    }

    const confirmed = window.confirm(
      "Archive this market and refund all bettors? This action cannot be undone.",
    );
    if (!confirmed) return;

    try {
      setIsArchiving(true);
      setError(null);
      const result = await api.archiveMarket(marketId);
      const updated = await api.getMarket(marketId);
      setMarket(updated);
      window.alert(
        `Market archived. Refunded $${result.refundTotal.toFixed(2)} to ${result.refundUsersCount} user(s).`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive market");
    } finally {
      setIsArchiving(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Checking authentication...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <p className="text-muted-foreground">Please log in to view this market</p>
            <Button onClick={() => navigate({ to: "/auth/login" })}>Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading market...</p>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <p className="text-destructive">Market not found</p>
            <Button onClick={() => navigate({ to: "/" })}>Back to Markets</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-3xl mx-auto px-4 space-y-6">
        {/* Header */}
        <Button variant="outline" onClick={() => navigate({ to: "/" })}>
          ← Back
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-4xl">{market.title}</CardTitle>
                {market.description && (
                  <CardDescription className="text-lg mt-2">{market.description}</CardDescription>
                )}
              </div>
              <Badge
                variant={market.status === "active" ? "success" : market.status === "resolved" ? "secondary" : "destructive"}
              >
                {market.status === "active"
                  ? "Active"
                  : market.status === "resolved"
                    ? "Resolved"
                    : "Archived"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Outcomes Display */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Outcomes</h3>
              {market.outcomes.map((outcome) => (
                <div
                  key={outcome.id}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    selectedOutcomeId === outcome.id
                      ? "border-primary bg-primary/5"
                      : "border-secondary bg-secondary/5 hover:border-primary/50"
                  }`}
                  onClick={() => market.status === "active" && setSelectedOutcomeId(outcome.id)}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <h4 className="font-semibold">{outcome.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Total bets: ${outcome.totalBets.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-primary">{outcome.odds}%</p>
                      <p className="text-xs text-muted-foreground">odds</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bet Distribution Chart */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Bet Distribution</h3>
              <div className="space-y-3">
                {market.outcomes.map((outcome) => (
                  <div key={`chart-${outcome.id}`} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{outcome.title}</span>
                      <span className="text-muted-foreground">{outcome.odds.toFixed(2)}%</span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-secondary/50 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.max(0, Math.min(100, outcome.odds))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Market Stats */}
            <div className="rounded-lg p-6 border border-primary/20 bg-primary/5">
              <p className="text-sm text-muted-foreground mb-1">Total Market Value</p>
              <p className="text-4xl font-bold text-primary">
                ${market.totalMarketBets.toFixed(2)}
              </p>
            </div>

            {/* Betting Section */}
            {market.status === "active" && (
              <Card className="bg-secondary/5">
                <CardHeader>
                  <CardTitle>Place Your Bet</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Selected Outcome</Label>
                    <div className="p-3 bg-white border border-secondary rounded-md">
                      {market.outcomes.find((o) => o.id === selectedOutcomeId)?.title ||
                        "None selected"}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="betAmount">Bet Amount ($)</Label>
                    <Input
                      id="betAmount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={betAmount}
                      onChange={(e) => setBetAmount(e.target.value)}
                      placeholder="Enter amount"
                      disabled={isBetting}
                    />
                  </div>

                  <Button
                    className="w-full text-lg py-6"
                    onClick={handlePlaceBet}
                    disabled={
                      isBetting ||
                      !selectedOutcomeId ||
                      !betAmount ||
                      !Number.isFinite(Number.parseFloat(betAmount)) ||
                      Number.parseFloat(betAmount) <= 0
                    }
                  >
                    {isBetting ? "Placing bet..." : "Place Bet"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {market.status === "active" && user?.role === "admin" && (
              <Card className="border-amber-300 bg-amber-50">
                <CardHeader>
                  <CardTitle>Admin Oracle: Resolve Market</CardTitle>
                  <CardDescription>
                    Select the winning outcome and resolve this market. Creators do not auto-resolve.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={handleResolveMarket}
                      disabled={!selectedOutcomeId || isResolving || isArchiving}
                    >
                      {isResolving ? "Resolving..." : "Resolve with Selected Outcome"}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleArchiveMarket}
                      disabled={isArchiving || isResolving}
                    >
                      {isArchiving ? "Archiving..." : "Archive Market + Refund Bettors"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {market.status === "resolved" && (
              <Card>
                <CardContent className="py-6">
                  <p className="text-muted-foreground">This market has been resolved.</p>
                  {market.resolvedOutcomeId && (
                    <p className="mt-2 font-semibold text-green-700">
                      Winning outcome:{" "}
                      {market.outcomes.find((outcome) => outcome.id === market.resolvedOutcomeId)?.title ||
                        "Unknown"}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {market.status === "archived" && (
              <Card>
                <CardContent className="py-6">
                  <p className="text-muted-foreground">
                    This market was archived by an admin. All bettors were refunded.
                  </p>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/markets/$id")({
  component: MarketDetailPage,
});
