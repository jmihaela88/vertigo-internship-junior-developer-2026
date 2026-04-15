import { Market } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "@tanstack/react-router";

interface MarketCardProps {
  market: Market;
  isAdmin?: boolean;
}

export function MarketCard({ market, isAdmin = false }: MarketCardProps) {
  const navigate = useNavigate();

  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl">{market.title}</CardTitle>
            <CardDescription>By: {market.creator || "Unknown"}</CardDescription>
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
      <CardContent className="flex flex-col flex-1 space-y-4">
        {/* Outcomes */}
        <div className="space-y-2 flex-1">
          {market.outcomes.map((outcome) => (
            <div
              key={outcome.id}
              className="flex items-center justify-between bg-secondary/20 p-3 rounded-md"
            >
              <div>
                <p className="text-sm font-medium">{outcome.title}</p>
                <p className="text-xs text-muted-foreground">
                  ${outcome.totalBets.toFixed(2)} total
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">{outcome.odds}%</p>
              </div>
            </div>
          ))}
        </div>

        {/* Total Market Value */}
        <div className="mt-auto space-y-4">
            <div className="p-3 rounded-md border border-primary/20 bg-primary/5">
            <p className="text-xs text-muted-foreground">Total Market Value</p>
            <p className="text-2xl font-bold text-primary">${market.totalMarketBets.toFixed(2)}</p>
            </div>

            {/* Action Button */}
            <Button className="w-full" onClick={() => navigate({ to: `/markets/${market.id}` })}>
            {market.status === "active" ? (isAdmin ? "Set Outcome" : "Place Bet") : "View Results"}
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}
