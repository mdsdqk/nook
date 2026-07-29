import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/ui/chip";
import { AiIndicator } from "@/components/ui/ai-indicator";

const colorGroups = [
  {
    title: "Primary",
    swatches: [
      { name: "primary", className: "bg-primary" },
      { name: "primary-container", className: "bg-primary-container" },
      { name: "on-primary", className: "bg-on-primary" },
    ],
  },
  {
    title: "Secondary",
    swatches: [
      { name: "secondary", className: "bg-secondary" },
      { name: "secondary-container", className: "bg-secondary-container" },
      { name: "on-secondary", className: "bg-on-secondary" },
    ],
  },
  {
    title: "Tertiary",
    swatches: [
      { name: "tertiary", className: "bg-tertiary" },
      { name: "tertiary-container", className: "bg-tertiary-container" },
      { name: "on-tertiary", className: "bg-on-tertiary" },
    ],
  },
  {
    title: "Surfaces",
    swatches: [
      { name: "canvas", className: "bg-canvas" },
      { name: "surface", className: "bg-surface" },
      { name: "container-low", className: "bg-surface-container-low" },
      { name: "container", className: "bg-surface-container" },
      { name: "container-high", className: "bg-surface-container-high" },
      { name: "highest", className: "bg-surface-container-highest" },
    ],
  },
] as const;

export function App() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Ambient AI glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 -right-24 h-[320px] w-[320px] rounded-full bg-tertiary/15 blur-[100px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 h-[280px] w-[400px] rounded-full bg-secondary/10 blur-[100px]"
      />

      <main className="relative mx-auto max-w-[1440px] px-4 py-stack-lg md:px-container">
        {/* Brand header */}
        <header className="mb-stack-lg">
          <AiIndicator label="Design System" className="mb-stack-sm" />
          <h1 className="text-display-xl font-bold tracking-[-0.04em] text-white max-md:text-headline-lg">
            Spike
          </h1>
          <p className="mt-stack-sm max-w-xl text-body-base text-on-surface/60">
            Financial Sentience — a glassmorphic dark system for agentic AI
            finance experiences.
          </p>
        </header>

        <div className="flex flex-col gap-stack-lg">
          {/* Colors */}
          <section>
            <h2 className="mb-stack-md text-headline-lg font-semibold tracking-[-0.02em] max-md:text-headline-lg-mobile">
              Colors
            </h2>
            <div className="grid gap-stack-md md:grid-cols-2 xl:grid-cols-4">
              {colorGroups.map((group) => (
                <Card key={group.title}>
                  <CardHeader>
                    <CardTitle>{group.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    {group.swatches.map((swatch) => (
                      <div key={swatch.name} className="flex items-center gap-3">
                        <div
                          className={`h-8 w-8 shrink-0 rounded border border-white/10 ${swatch.className}`}
                        />
                        <span className="text-label-caps text-on-surface-variant">
                          {swatch.name}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Typography */}
          <section>
            <h2 className="mb-stack-md text-headline-lg font-semibold tracking-[-0.02em] max-md:text-headline-lg-mobile">
              Typography
            </h2>
            <Card>
              <div className="flex flex-col gap-stack-md">
                <div>
                  <p className="mb-1 text-label-caps text-on-surface-variant">
                    display-xl · Geist 700
                  </p>
                  <p className="text-display-xl font-bold tracking-[-0.04em] text-white max-md:text-headline-lg">
                    Agentic Clarity
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-label-caps text-on-surface-variant">
                    headline-lg · Geist 600
                  </p>
                  <p className="text-headline-lg font-semibold tracking-[-0.02em] max-md:text-headline-lg-mobile">
                    Portfolio Overview
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-label-caps text-on-surface-variant">
                    title-md · Geist 500
                  </p>
                  <p className="text-title-md font-medium">Monthly Cashflow</p>
                </div>
                <div>
                  <p className="mb-1 text-label-caps text-on-surface-variant">
                    body-base · Geist 400
                  </p>
                  <p className="text-body-base text-white">
                    Primary body text uses high-contrast white for absolute
                    readability.
                  </p>
                  <p className="mt-1 text-body-base text-on-surface/60">
                    Secondary descriptions sit at 60% opacity to maintain
                    hierarchy.
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-label-caps text-on-surface-variant">
                    body-sm · Geist 400
                  </p>
                  <p className="text-body-sm text-on-surface/60">
                    Compact supporting copy for dense dashboard widgets.
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-label-caps text-on-surface-variant">
                    label-caps · JetBrains Mono 500
                  </p>
                  <p className="text-label-caps text-primary">
                    Category · Insight · Sync
                  </p>
                </div>
              </div>
            </Card>
          </section>

          {/* Components */}
          <section>
            <h2 className="mb-stack-md text-headline-lg font-semibold tracking-[-0.02em] max-md:text-headline-lg-mobile">
              Components
            </h2>
            <div className="grid gap-stack-md md:grid-cols-2 xl:grid-cols-3">
              {/* Buttons */}
              <Card>
                <CardHeader>
                  <CardTitle>Buttons</CardTitle>
                  <CardAction>View More</CardAction>
                </CardHeader>
                <CardDescription>
                  Primary gradient CTA and ghost secondary.
                </CardDescription>
                <CardContent className="flex flex-wrap gap-3">
                  <Button variant="primary">Ask Agent</Button>
                  <Button variant="secondary">Cancel</Button>
                  <Button variant="ghost">Skip</Button>
                </CardContent>
              </Card>

              {/* Inputs */}
              <Card>
                <CardHeader>
                  <CardTitle>Inputs</CardTitle>
                </CardHeader>
                <CardDescription>
                  Darker field with primary focus glow.
                </CardDescription>
                <CardContent className="flex flex-col gap-3">
                  <Input placeholder="Search transactions…" />
                  <Input defaultValue="₹24,500" aria-label="Amount" />
                </CardContent>
              </Card>

              {/* Chips */}
              <Card>
                <CardHeader>
                  <CardTitle>Chips</CardTitle>
                </CardHeader>
                <CardDescription>
                  Category tags in JetBrains Mono.
                </CardDescription>
                <CardContent className="flex flex-wrap gap-2">
                  <Chip>Groceries</Chip>
                  <Chip variant="primary">AI Insight</Chip>
                  <Chip variant="secondary">Income</Chip>
                  <Chip variant="tertiary">Transfer</Chip>
                  <Chip variant="outline">Pending</Chip>
                </CardContent>
              </Card>

              {/* AI Indicator */}
              <Card>
                <CardHeader>
                  <CardTitle>AI Indicator</CardTitle>
                </CardHeader>
                <CardDescription>
                  Pulsing orb when the system is thinking.
                </CardDescription>
                <CardContent className="flex flex-col gap-stack-sm">
                  <AiIndicator label="Thinking…" size="sm" />
                  <AiIndicator label="Analyzing cashflow" size="md" />
                  <AiIndicator label="Insight ready" size="lg" />
                </CardContent>
              </Card>

              {/* Glass border AI */}
              <Card className="xl:col-span-2">
                <CardHeader>
                  <CardTitle>Insight Card</CardTitle>
                  <CardAction>Dismiss</CardAction>
                </CardHeader>
                <CardDescription>
                  Gradient border for agentic insights.
                </CardDescription>
                <CardContent>
                  <AiIndicator variant="border">
                    <div className="flex items-start gap-3">
                      <AiIndicator size="md" />
                      <div>
                        <p className="text-title-md font-medium text-white">
                          You spent 18% less on dining this week
                        </p>
                        <p className="mt-1 text-body-sm text-on-surface/60">
                          Compared to your 4-week average. Emerald trend
                          detected — keep the streak going.
                        </p>
                        <div className="mt-stack-sm flex gap-2">
                          <Chip variant="secondary">−18%</Chip>
                          <Chip variant="primary">Dining</Chip>
                        </div>
                      </div>
                    </div>
                  </AiIndicator>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Elevation */}
          <section>
            <h2 className="mb-stack-md text-headline-lg font-semibold tracking-[-0.02em] max-md:text-headline-lg-mobile">
              Elevation
            </h2>
            <div className="grid gap-stack-md md:grid-cols-3">
              <div className="rounded-lg border border-white/5 bg-canvas p-stack-md">
                <p className="mb-2 text-label-caps text-on-surface-variant">
                  Level 0 · Canvas
                </p>
                <p className="text-body-sm text-on-surface/60">
                  Pure black (#050505) for maximum glow contrast.
                </p>
              </div>
              <div className="glass-1 rounded-lg p-stack-md">
                <p className="mb-2 text-label-caps text-on-surface-variant">
                  Level 1 · Glass
                </p>
                <p className="text-body-sm text-on-surface/60">
                  Translucent white over canvas with 12px blur.
                </p>
              </div>
              <div className="glass-2 rounded-lg p-stack-md">
                <p className="mb-2 text-label-caps text-on-surface-variant">
                  Level 2 · Focus
                </p>
                <p className="text-body-sm text-on-surface/60">
                  Brighter border plus primary outer glow.
                </p>
              </div>
            </div>
            <div className="glass-float mt-stack-md rounded-lg p-stack-md">
              <p className="mb-2 text-label-caps text-on-surface-variant">
                Floating · Modal / Tooltip
              </p>
              <p className="text-body-sm text-on-surface/60">
                Stronger blur for content isolation above the canvas.
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
