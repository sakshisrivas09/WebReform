import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import {
  Sparkles,
  RotateCcw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ShoppingCart,
  BookOpen,
  ShieldCheck,
  Zap,
  Sliders,
  Check,
  CheckCircle2,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Website, FitnessWeights, OptimizationRun } from "@/types";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { useAccessGuard } from "@/context/AccessGuardContext";

type PresetId = "conversions" | "content" | "gentle" | "aggressive" | "custom";
type SpeedMode = "fast" | "balanced" | "deep";

interface PresetConfig {
  id: PresetId;
  title: string;
  badge?: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  weights: FitnessWeights;
  maxDepth: number;
  maxChildren: number;
}

const PRESETS: PresetConfig[] = [
  {
    id: "conversions",
    title: "Boost Sales & Conversions",
    badge: "Recommended",
    description: "Guides visitors to high-value pages (products, pricing, checkout) in 2 to 3 clicks.",
    icon: ShoppingCart,
    weights: {
      navigation: 0.40,
      behavior: 0.30,
      semantic: 0.15,
      structural: 0.05,
      depth: 0.10,
    },
    maxDepth: 3,
    maxChildren: 7,
  },
  {
    id: "content",
    title: "Organize Content & Topics",
    badge: "For Blogs & Docs",
    description: "Clusters related articles and guides into clean, logical categories that are easy to browse.",
    icon: BookOpen,
    weights: {
      navigation: 0.30,
      behavior: 0.15,
      semantic: 0.40,
      structural: 0.10,
      depth: 0.05,
    },
    maxDepth: 4,
    maxChildren: 8,
  },
  {
    id: "gentle",
    title: "Gentle Cleanup",
    badge: "Low Disruption",
    description: "Fixes confusing dead-ends while keeping menus familiar so regular visitors stay comfortable.",
    icon: ShieldCheck,
    weights: {
      navigation: 0.20,
      behavior: 0.25,
      semantic: 0.10,
      structural: 0.40,
      depth: 0.05,
    },
    maxDepth: 4,
    maxChildren: 8,
  },
  {
    id: "aggressive",
    title: "Aggressive Flatten",
    badge: "Radical Redesign",
    description: "Radically strips away deep submenus to bring everything within 2 clicks from the homepage.",
    icon: Zap,
    weights: {
      navigation: 0.45,
      behavior: 0.15,
      semantic: 0.05,
      structural: 0.05,
      depth: 0.30,
    },
    maxDepth: 2,
    maxChildren: 6,
  },
];

export const OptimizationPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedWebsiteId = searchParams.get("websiteId");

  const [websites, setWebsites] = useState<Website[]>([]);
  const [runs, setRuns] = useState<OptimizationRun[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);

  // Form State
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<number>(
    preselectedWebsiteId ? Number(preselectedWebsiteId) : 0
  );
  const { requireAccess } = useAccessGuard();

  // Preset & Quality Mode State
  const [selectedPreset, setSelectedPreset] = useState<PresetId>("conversions");
  const [speedMode, setSpeedMode] = useState<SpeedMode>("balanced");
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Core Algorithmic Parameters
  const [populationSize, setPopulationSize] = useState<number>(30);
  const [iterations, setIterations] = useState<number>(100);
  const [randomSeed, setRandomSeed] = useState<number>(42);
  const [maxDepth, setMaxDepth] = useState<number>(3);
  const [maxChildren, setMaxChildren] = useState<number>(7);

  // Fitness Weights
  const [weights, setWeights] = useState<FitnessWeights>({
    navigation: 0.40,
    behavior: 0.30,
    semantic: 0.15,
    structural: 0.05,
    depth: 0.10,
  });

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSites = async () => {
      setLoading(true);
      setError(null);
      try {
        const [sites, optRuns] = await Promise.all([
          api.getWebsites(),
          api.getOptimizationRuns().catch(() => [] as OptimizationRun[]),
        ]);
        setWebsites(sites);
        setRuns(optRuns);
        if (sites.length > 0 && !selectedWebsiteId) {
          setSelectedWebsiteId(sites[0].id);
        }
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err);
        } else {
          setError(new ApiError("Failed to fetch available websites."));
        }
      } finally {
        setLoading(false);
      }
    };
    fetchSites();
  }, []);

  // Handle Preset Selection
  const applyPreset = (preset: PresetConfig) => {
    setSelectedPreset(preset.id);
    setWeights(preset.weights);
    setMaxDepth(preset.maxDepth);
    setMaxChildren(preset.maxChildren);
  };

  // Handle Speed Mode Selection
  const applySpeedMode = (mode: SpeedMode) => {
    setSpeedMode(mode);
    if (mode === "fast") {
      setPopulationSize(20);
      setIterations(50);
    } else if (mode === "balanced") {
      setPopulationSize(30);
      setIterations(100);
    } else if (mode === "deep") {
      setPopulationSize(60);
      setIterations(200);
    }
  };

  // Compute live sum of weights
  const weightSum = Number(
    (
      weights.navigation +
      weights.behavior +
      weights.semantic +
      weights.structural +
      weights.depth
    ).toFixed(2)
  );

  const isWeightsValid = Math.abs(weightSum - 1.0) < 0.01;

  const handleWeightChange = (key: keyof FitnessWeights, value: number) => {
    setSelectedPreset("custom");
    setWeights((prev) => ({
      ...prev,
      [key]: Math.max(0, Math.min(1, value)),
    }));
  };

  const handleNormalizeWeights = () => {
    const currentSum =
      weights.navigation +
      weights.behavior +
      weights.semantic +
      weights.structural +
      weights.depth;

    if (currentSum === 0) {
      setWeights({
        navigation: 0.2,
        behavior: 0.2,
        semantic: 0.2,
        structural: 0.2,
        depth: 0.2,
      });
      return;
    }

    setWeights({
      navigation: Number((weights.navigation / currentSum).toFixed(2)),
      behavior: Number((weights.behavior / currentSum).toFixed(2)),
      semantic: Number((weights.semantic / currentSum).toFixed(2)),
      structural: Number((weights.structural / currentSum).toFixed(2)),
      depth: Number((weights.depth / currentSum).toFixed(2)),
    });
  };

  const handleRandomizeSeed = () => {
    setRandomSeed(Math.floor(Math.random() * 10000));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedWebsiteId) {
      setFormError("Please select a target website.");
      return;
    }

    if (!isWeightsValid) {
      setFormError(
        `Custom weights must sum to 100% (Current: ${(weightSum * 100).toFixed(0)}%). Click "Auto-Normalize" in Advanced Settings.`
      );
      return;
    }

    requireAccess(async () => {
      setSubmitting(true);
      try {
        const run = await api.runOptimization({
          websiteId: selectedWebsiteId,
          populationSize,
          iterations,
          randomSeed,
          maxDepth,
          maxChildren,
          weights,
        });

        navigate(`/optimize/results/${run.id}`);
      } catch (err) {
        if (err instanceof ApiError) {
          setFormError(err.message);
        } else {
          setFormError("Failed to initiate structure reform run.");
        }
      } finally {
        setSubmitting(false);
      }
    });
  };

  if (loading) {
    return <LoadingState message="Loading optimization targets..." rows={3} />;
  }

  if (error) {
    return (
      <ErrorState
        title="Unable to connect"
        message={error.message}
        isBackendOffline={error.isBackendUnavailable}
      />
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-16">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Simplify Website Navigation
        </h1>
        <p className="text-sm text-slate-500 mt-1.5 max-w-2xl">
          Choose your website and primary business goal. WebReform will reorganize your links so visitors reach products and key pages in 2 to 3 clicks.
        </p>
      </div>

      {formError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block">Configuration Note</span>
            {formError}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: Target Website */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 block">
                Step 1
              </span>
              <h2 className="text-base font-semibold text-slate-900">
                Choose Target Website
              </h2>
            </div>
            <Link to="/websites" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
              + Register New Site
            </Link>
          </div>

          {websites.length === 0 ? (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs space-y-2">
              <p className="font-semibold">No websites registered yet.</p>
              <p>You must register and crawl a website before running navigation reforms.</p>
              <Link
                to="/websites"
                className="inline-flex items-center gap-1.5 font-semibold text-indigo-600 hover:text-indigo-800"
              >
                <span>Register a website now</span> &rarr;
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              <select
                value={selectedWebsiteId}
                onChange={(e) => setSelectedWebsiteId(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-xs"
              >
                {websites.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} — {w.baseUrl} ({w.pageCount ?? 0} pages crawled)
                  </option>
                ))}
              </select>

              {(() => {
                const cur = websites.find((w) => w.id === selectedWebsiteId);
                if (cur && (cur.pageCount ?? 0) < 2) {
                  return (
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between">
                      <span>This website has {cur.pageCount ?? 0} crawled page(s). At least 2 pages are required to reform navigation.</span>
                      <Link
                        to={`/websites/${cur.id}`}
                        className="font-semibold text-indigo-600 hover:text-indigo-800 underline ml-2 shrink-0"
                      >
                        Crawl Pages &rarr;
                      </Link>
                    </div>
                  );
                }

                const existingRun = runs.find((r) => r.websiteId === selectedWebsiteId && r.status === "COMPLETED");
                if (existingRun) {
                  const imp = (existingRun.initialFitness && existingRun.finalFitness && existingRun.initialFitness > 0)
                    ? ((existingRun.initialFitness - existingRun.finalFitness) / existingRun.initialFitness) * 100
                    : null;
                  return (
                    <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>
                          <strong>Optimized Structure Available:</strong> Last reform completed on{" "}
                          {new Date(existingRun.createdAt).toLocaleDateString()}
                          {imp != null && (
                            <span className="font-semibold text-emerald-700 ml-1">
                              (+{imp.toFixed(1)}% friction reduced)
                            </span>
                          )}.
                        </span>
                      </div>
                      <Link
                        to={`/optimize/results/${existingRun.id}`}
                        className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-900 underline shrink-0"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        View Existing Result &rarr;
                      </Link>
                    </div>
                  );
                }

                return null;
              })()}
            </div>
          )}
        </div>

        {/* Step 2: Goal-Driven Optimization Strategy */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between pb-1">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 block">
                Step 2
              </span>
              <h2 className="text-base font-semibold text-slate-900">
                What is your primary goal?
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pick a goal and WebReform balances click depths and topic groups automatically.
              </p>
            </div>
            {selectedPreset !== "custom" && (
              <span className="hidden sm:inline-flex items-center gap-1 text-xs text-emerald-700 font-medium bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                <Check className="w-3 h-3" /> Auto-Configured
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {PRESETS.map((preset) => {
              const Icon = preset.icon;
              const isSelected = selectedPreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                    isSelected
                      ? "border-indigo-600 bg-indigo-50/50 shadow-xs ring-1 ring-indigo-600"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 bg-white"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`p-2 rounded-lg ${
                            isSelected
                              ? "bg-indigo-600 text-white"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-semibold text-slate-900">
                          {preset.title}
                        </span>
                      </div>
                      {preset.badge && (
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            isSelected
                              ? "bg-indigo-100 text-indigo-700 border-indigo-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {preset.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {preset.description}
                    </p>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Target Depth: ≤ {preset.maxDepth} clicks</span>
                    <span>Max Submenu: {preset.maxChildren} links</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 3: Search Depth / Speed */}
        <div className="space-y-3 pt-2">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 block">
              Step 3
            </span>
            <h2 className="text-base font-semibold text-slate-900">
              Reform Thoroughness
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Balanced works best for 95% of websites. Use Deep Scan for large sites with 50+ pages.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => applySpeedMode("fast")}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                speedMode === "fast"
                  ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 bg-white"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-slate-900">⚡ Quick Scan</span>
                <span className="text-[10px] text-slate-400 font-mono">~5-10s</span>
              </div>
              <p className="text-xs text-slate-500">Fast exploratory scan to test layout options.</p>
            </button>

            <button
              type="button"
              onClick={() => applySpeedMode("balanced")}
              className={`p-3.5 rounded-xl border text-left transition-all relative ${
                speedMode === "balanced"
                  ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 bg-white"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-slate-900">⚖️ Balanced</span>
                <span className="text-[10px] text-indigo-700 font-semibold bg-indigo-100 px-1.5 py-0.5 rounded">
                  Recommended
                </span>
              </div>
              <p className="text-xs text-slate-500">Thorough search to find optimal navigation paths.</p>
            </button>

            <button
              type="button"
              onClick={() => applySpeedMode("deep")}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                speedMode === "deep"
                  ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 bg-white"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-slate-900">🔬 Deep Scan</span>
                <span className="text-[10px] text-slate-400 font-mono">~1-2m</span>
              </div>
              <p className="text-xs text-slate-500">Exhaustive search for stores and catalogs with 50+ pages.</p>
            </button>
          </div>
        </div>

        {/* Step 4: Collapsible Advanced Fine-Tuning */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-slate-50/60 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Sliders className="w-4 h-4 text-slate-500" />
              <div>
                <span className="text-sm font-semibold text-slate-800 block">
                  Fine-Tuning &amp; Developer Parameters (Optional)
                </span>
                <span className="text-xs text-slate-500 block">
                  {showAdvanced
                    ? "Hide custom weights and search thresholds"
                    : "Manually adjust weights, depth limits, and random seed"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              {selectedPreset === "custom" && (
                <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Custom Weights Active
                </span>
              )}
              {showAdvanced ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </div>
          </button>

          {showAdvanced && (
            <div className="p-5 pt-0 border-t border-slate-100 space-y-6">
              {/* Hierarchy Limits */}
              <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">Max Click Depth</label>
                  <select
                    value={maxDepth}
                    onChange={(e) => {
                      setSelectedPreset("custom");
                      setMaxDepth(Number(e.target.value));
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"
                  >
                    <option value={2}>2 Clicks (Ultra-flat)</option>
                    <option value={3}>3 Clicks (Recommended)</option>
                    <option value={4}>4 Clicks (Standard)</option>
                    <option value={5}>5 Clicks (Deep)</option>
                  </select>
                  <span className="text-[11px] text-slate-400">Target depth threshold</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">Submenu Item Limit</label>
                  <select
                    value={maxChildren}
                    onChange={(e) => {
                      setSelectedPreset("custom");
                      setMaxChildren(Number(e.target.value));
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"
                  >
                    <option value={5}>Compact (5 items)</option>
                    <option value={7}>Balanced (7 items)</option>
                    <option value={8}>Standard (8 items)</option>
                    <option value={12}>Mega Menu (12 items)</option>
                  </select>
                  <span className="text-[11px] text-slate-400">Max links per dropdown</span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-medium text-slate-700">Deterministic Seed</label>
                    <button
                      type="button"
                      onClick={handleRandomizeSeed}
                      className="text-xs text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1 font-medium"
                    >
                      <RotateCcw className="w-3 h-3" /> Randomize
                    </button>
                  </div>
                  <input
                    type="number"
                    value={randomSeed}
                    onChange={(e) => setRandomSeed(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 font-mono"
                  />
                  <span className="text-[11px] text-slate-400">Ensures reproducible results</span>
                </div>
              </div>

              {/* Sliders for Fitness Weights */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                      Multi-Objective Priority Weights
                    </h3>
                    <p className="text-xs text-slate-500">
                      Total allocation must equal <strong className="text-slate-800">100%</strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-mono px-2.5 py-1 rounded-full font-semibold border ${
                        isWeightsValid
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      Total: {(weightSum * 100).toFixed(0)}% / 100%
                    </span>
                    <button
                      type="button"
                      onClick={handleNormalizeWeights}
                      className="px-2.5 py-1 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 transition-colors shadow-xs"
                    >
                      Auto-Normalize
                    </button>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  {/* Navigation Efficiency */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-700 font-medium">Quick Paths &amp; Navigation Speed</span>
                      <span className="font-mono text-indigo-600 font-semibold">{(weights.navigation * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={weights.navigation}
                      onChange={(e) => handleWeightChange("navigation", parseFloat(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                    <span className="text-[11px] text-slate-500 block">Minimizes click distances from homepage.</span>
                  </div>

                  {/* Behavior & Traffic */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-700 font-medium">User Traffic &amp; High-Value Pages</span>
                      <span className="font-mono text-indigo-600 font-semibold">{(weights.behavior * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={weights.behavior}
                      onChange={(e) => handleWeightChange("behavior", parseFloat(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                    <span className="text-[11px] text-slate-500 block">Positions popular content closer to root menus.</span>
                  </div>

                  {/* Semantic Topics */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-700 font-medium">Topic Relevance &amp; Semantic Grouping</span>
                      <span className="font-mono text-indigo-600 font-semibold">{(weights.semantic * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={weights.semantic}
                      onChange={(e) => handleWeightChange("semantic", parseFloat(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                    <span className="text-[11px] text-slate-500 block">Clusters related topics under common parent categories.</span>
                  </div>

                  {/* Structural Preservation */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-700 font-medium">Familiarity &amp; Existing Link Preservation</span>
                      <span className="font-mono text-indigo-600 font-semibold">{(weights.structural * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={weights.structural}
                      onChange={(e) => handleWeightChange("structural", parseFloat(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                    <span className="text-[11px] text-slate-500 block">Maintains familiar links to avoid confusing regular visitors.</span>
                  </div>

                  {/* Depth Penalty */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-700 font-medium">Strict Depth Limit Enforcement</span>
                      <span className="font-mono text-indigo-600 font-semibold">{(weights.depth * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={weights.depth}
                      onChange={(e) => handleWeightChange("depth", parseFloat(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                    <span className="text-[11px] text-slate-500 block">Strictly penalizes pages pushed beyond the click threshold.</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <Link
            to="/websites"
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || !isWeightsValid}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-500 shadow-sm transition-all active:scale-95 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {submitting ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin" />
                Generating Structure...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Optimized Navigation
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
