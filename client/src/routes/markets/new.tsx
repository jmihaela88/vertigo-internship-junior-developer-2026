import { useForm } from "@tanstack/react-form";
import { useNavigate, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

function CreateMarketPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (isAuthLoading) {
    return <div className="p-8 text-center">Checking authentication...</div>;
  }

  if (!isAuthenticated) {
    navigate({ to: "/auth/login" });
    return null;
  }


  const form = useForm({
    defaultValues: {
      title: "",
      description: "",
      outcomes: ["", ""],
    },
    onSubmit: async (formData) => {
      const values = formData.value;

      if (!values.title.trim()) {
        setError("Market title is required");
        return;
      }

      const validOutcomes = values.outcomes.filter((o) => o.trim());
      if (validOutcomes.length < 2) {
        setError("At least 2 outcomes are required");
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const market = await api.createMarket(values.title, values.description, validOutcomes);
        navigate({ to: `/markets/${market.id}` });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create market");
      } finally {
        setIsLoading(false);
      }
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="text-3xl">Create a Market</CardTitle>
            <CardDescription>
              Set up a new prediction market and define the outcomes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                form.handleSubmit();
              }}
              className="space-y-6"
            >
              <form.Field name="title">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="title">Market Title</Label>
                    <Input
                      id="title"
                      type="text"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      placeholder="e.g., Will Bitcoin reach $100k by end of 2024?"
                      disabled={isLoading}
                    />
                  </div>
                )}
              </form.Field>

              <form.Field name="description">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea
                      id="description"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      placeholder="Provide more context about this market..."
                      disabled={isLoading}
                      rows={4}
                    />
                  </div>
                )}
              </form.Field>

              <div className="space-y-4">
                <Label>Outcomes</Label>
                <form.Field name="outcomes">
                  {(field) => (
                    <div className="space-y-2">
                      {field.state.value.map((outcome, index) => (
                        <Input
                          key={index}
                          type="text"
                          value={outcome}
                          onChange={(e) => {
                            const newOutcomes = [...field.state.value];
                            newOutcomes[index] = e.target.value;
                            field.handleChange(newOutcomes);
                          }}
                          onBlur={field.handleBlur}
                          placeholder={`Outcome ${index + 1}`}
                          disabled={isLoading}
                        />
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          field.handleChange([...field.state.value, ""]);
                        }}
                        disabled={isLoading}
                        className="w-full"
                      >
                        + Add Outcome
                      </Button>
                    </div>
                  )}
                </form.Field>
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="flex gap-4">
                <Button type="submit" className="flex-1" disabled={isLoading}>
                  {isLoading ? "Creating..." : "Create Market"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate({ to: "/" })}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/markets/new")({
  component: CreateMarketPage,
});
