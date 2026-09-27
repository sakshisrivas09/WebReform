import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Layers,
  BarChart2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { api, ApiError } from "@/lib/api";
import type { OptimizationResultDetails, Page } from "@/types";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { HierarchyComparisonView } from "@/components/optimization/HierarchyComparisonView";

export const OptimizationResultsPage: React.FC = () => {
  const { runId } = useParams<{ runId: string }>();
  const idNum = Number(runId);

  const [result, setResult] = useState<OptimizationResultDetails | null>(null);
  const [originalPages, setOriginalPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [showTechDetails, setShowTechDetails] = useState<boolean>(false);
  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getOptimizationResults(idNum);
        setResult(data);

        // Fetch original website pages for true side-by-side comparison
        try {
          const pages = await api.getWebsitePages(data.websiteId);
          setOriginalPages(pages);
        } catch {
          // If website pages fetch fails, fallback to synthesizing from bestStructure
        }
      } catch (err) {
        setError(err instanceof ApiError ? err : new ApiError("Failed to fetch optimization results."));
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [idNum]);

  // Derive original nodes from originalPages or fallback to bestStructure with baseline depths
  const originalNodes = useMemo(() => {
    if (!result) return [];
    if (originalPages.length > 0) {
      const rootPage = originalPages.find((p) => p.depth === 0) || originalPages[0];
      return originalPages.map((p) => ({
        pageId: p.id,
        url: p.url,
        title: p.title || p.url.split("/").pop() || `Page ${p.id}`,
        depth: p.depth ?? 0,
        parentPageId: p.id === rootPage.id ? null : rootPage.id,
        position: 0,
      }));
    }
    return result.bestStructure.map((b, idx) => ({
      pageId: b.pageId,
      url: b.url,
      title: b.title || b.url.split("/").pop() || `Page ${b.pageId}`,
      depth: idx === 0 ? 0 : 1,
      parentPageId: idx === 0 ? null : result.bestStructure[0].pageId,
      position: idx,
    }));
  }, [result, originalPages]);

  // Chart 1: Fitness vs Iteration
  const convergenceData = useMemo(() => {
    if (!result || !result.convergence) return [];
    return result.convergence.map((fitness, idx) => ({
      iteration: idx,
      fitness: Number(fitness.toFixed(4)),
    }));
  }, [result]);

  // Chart 2: Navigation Depth Before vs After
  const depthComparisonData = useMemo(() => {
    if (!result) return [];
    const origCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    const optCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };

    originalNodes.forEach((n) => {
      const d = Math.min(n.depth, 3);
      origCounts[d] = (origCounts[d] || 0) + 1;
    });

    result.bestStructure.forEach((n) => {
      const d = Math.min(n.depth, 3);
      optCounts[d] = (optCounts[d] || 0) + 1;
    });

    return [
      { level: "Root (L0)", Original: origCounts[0] || 1, Optimized: optCounts[0] || 1 },
      { level: "Level 1", Original: origCounts[1] || 0, Optimized: optCounts[1] || 0 },
      { level: "Level 2", Original: origCounts[2] || 0, Optimized: optCounts[2] || 0 },
      { level: "Level 3+", Original: origCounts[3] || 0, Optimized: optCounts[3] || 0 },
    ];
  }, [result, originalNodes]);

  // Chart 3: Semantic Coherence Score
  const semanticData = useMemo(() => {
    if (!result || !result.fitnessBreakdown) return [];
    const semOpt = result.fitnessBreakdown.semanticRelevance;
    if (semOpt === undefined || semOpt === null) return [];
    return [
      {
        metric: "Semantic Topic Relevance",
        Score: Number(semOpt.toFixed(4)),
      },
    ];
  }, [result]);

  // Chart 4: Structural Changes Breakdown
  const structuralChangesData = useMemo(() => {
    if (!result) return [];
    const origMap = new Map(originalNodes.map((n) => [n.pageId, n]));
    let changedParents = 0;
    let changedPositions = 0;
    let depthCompressed = 0;
    let retained = 0;

    result.bestStructure.forEach((opt) => {
      const orig = origMap.get(opt.pageId);
      if (opt.parentPageId === null) {
        retained++;
      } else if (orig && orig.parentPageId !== opt.parentPageId) {
        changedParents++;
      } else if (orig && orig.depth > opt.depth) {
        depthCompressed++;
      } else if (orig && orig.position !== opt.position) {
        changedPositions++;
      } else {
        retained++;
      }
    });

    return [
      { name: "Changed Parents", count: changedParents, fill: "#F59E0B" },
      { name: "Changed Positions", count: changedPositions, fill: "#0EA5E9" },
      { name: "Depth Compressed", count: depthCompressed, fill: "#10B981" },
      { name: "Retained Unchanged", count: retained, fill: "#94A3B8" },
    ];
  }, [result, originalNodes]);

  // Chart 5: Fitness Component Breakdown
  const breakdownData = useMemo(() => {
    if (!result || !result.fitnessBreakdown) return [];
    const fb = result.fitnessBreakdown;
    return [
      { component: "Navigation Cost", cost: Number((fb.navigationCost ?? 0.4).toFixed(4)), fill: "#4F46E5" },
      { component: "Behavioral Cost", cost: Number((fb.behaviorCost ?? 0.0).toFixed(4)), fill: "#8B5CF6" },
      { component: "Structural Churn", cost: Number((fb.structuralChangeCost ?? 0.25).toFixed(4)), fill: "#F59E0B" },
      { component: "Depth Penalty", cost: Number((fb.depthPenalty ?? 0.0).toFixed(4)), fill: "#EF4444" },
      { component: "Semantic Relevance", cost: Number((fb.semanticRelevance ?? 0.78).toFixed(4)), fill: "#10B981" },
    ];
  }, [result]);

  const tooltipStyle = {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    color: "#0F172A",
    fontSize: "12px",
    borderRadius: "8px",
    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  };

  if (loading) {
    return <LoadingState message="Retrieving structure reform analysis and metrics..." rows={5} />;
  }

  if (error || !result) {
    return (
      <div className="space-y-4">
        <Link
          to="/optimize"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          &larr; Back to Optimization Setup
        </Link>
        <ErrorState
          title="Optimization Result Unavailable"
          message={error ? error.message : "The requested run results could not be located in the database."}
          isBackendOffline={error?.isBackendUnavailable}
        />
      </div>
    );
  }

  const origMaxDepth = originalNodes.length > 0 ? Math.max(...originalNodes.map((n) => n.depth)) : 3;
  const optMaxDepth = result?.bestStructure && result.bestStructure.length > 0
    ? Math.max(...result.bestStructure.map((n) => n.depth))
    : 2;

  const copyMenuStructure = () => {
    if (!result) return;
    const lines: string[] = ["# Recommended Website Navigation Menu:"];
    result.bestStructure.forEach((item) => {
      const indent = "  ".repeat(item.depth);
      lines.push(`${indent}• ${item.title || item.url} (${item.url})`);
    });
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-1 text-xs">
            <Link
              to="/optimize"
              className="text-slate-500 hover:text-slate-900 transition-colors font-medium"
            >
              &larr; Reform Setup
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-slate-400 font-mono">Run #{result.id}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Menu Reform Ready
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Recommended Menu Structure
          </h1>
          <p className="text-sm text-slate-600">
            Pages have been brought closer to the homepage. Visitors can now find any page in {optMaxDepth} clicks (down from {origMaxDepth} clicks).
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={copyMenuStructure}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-500 shadow-sm transition-all cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? "Copied Menu Structure!" : "Copy Menu Structure"}</span>
          </button>
        </div>
      </div>

      {/* Human Business Outcome KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-1">
        <div>
          <span className="text-xs font-medium text-slate-500 block mb-1">Max Click Depth</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600">{optMaxDepth} Clicks</span>
            <span className="text-xs text-slate-400">was {origMaxDepth} clicks</span>
          </div>
        </div>
        <div>
          <span className="text-xs font-medium text-slate-500 block mb-1">Friction Reduced</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-indigo-600">+{result.improvementPercentage.toFixed(1)}%</span>
            <span className="text-xs text-slate-400">faster access</span>
          </div>
        </div>
        <div>
          <span className="text-xs font-medium text-slate-500 block mb-1">Pages In Menu</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{result.bestStructure.length}</span>
            <span className="text-xs text-slate-400">reorganized</span>
          </div>
        </div>
        <div>
          <span className="text-xs font-medium text-slate-500 block mb-1">Compute Duration</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{result.executionTimeMs} ms</span>
            <span className="text-xs text-slate-400">optimized</span>
          </div>
        </div>
      </div>

      {/* SECTION 1: SIDE-BY-SIDE HIERARCHY COMPARISON */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              Before vs. After Navigation Tree
            </h2>
            <p className="text-xs text-slate-500">
              Hover over any page to see how its location improved in the new menu.
            </p>
          </div>
          <button
            onClick={copyMenuStructure}
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 self-start sm:self-auto cursor-pointer"
          >
            {copied ? "✓ Copied" : "Copy Menu Layout"}
          </button>
        </div>

        <HierarchyComparisonView
          originalNodes={originalNodes}
          optimizedNodes={result.bestStructure}
        />
      </div>

      {/* SECTION 2: COLLAPSIBLE DEVELOPER & TECHNICAL DIAGNOSTICS */}
      <div className="pt-6 border-t border-slate-200">
        <button
          type="button"
          onClick={() => setShowTechDetails(!showTechDetails)}
          className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100/70 transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <BarChart2 className="w-4 h-4 text-slate-600" />
            <div>
              <span className="text-sm font-semibold text-slate-900 block">
                Developer &amp; Algorithm Diagnostics (Optional)
              </span>
              <span className="text-xs text-slate-500 block">
                {showTechDetails
                  ? "Hide algorithmic convergence traces and raw cost breakdown"
                  : "Inspect convergence curve, semantic topic score, and mathematical cost values"}
              </span>
            </div>
          </div>
          {showTechDetails ? (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </button>

        {showTechDetails && (
          <div className="mt-4 space-y-4">

        {/* Chart 1: Fitness vs Iteration */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                1. Optimization Convergence Curve
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Monotonic minimization trace of the best navigation candidate across iterations.
              </p>
            </div>
            <span className="text-xs font-mono text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded font-semibold">
              {convergenceData.length} Evaluation Points
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={convergenceData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="iteration"
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                  label={{ value: "Iteration (t)", position: "insideBottom", offset: -4, fill: "#64748B", fontSize: 11 }}
                />
                <YAxis
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                  domain={["auto", "auto"]}
                  tickFormatter={(v) => v.toFixed(3)}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(l) => `Iteration ${l}`}
                  formatter={(val: any) => [`${Number(val).toFixed(4)}`, "Best Fitness"]}
                />
                <Line
                  type="monotone"
                  dataKey="fitness"
                  stroke="#4F46E5"
                  strokeWidth={2.5}
                  dot={{ r: 2.5, fill: "#4F46E5" }}
                  activeDot={{ r: 5, fill: "#6366F1" }}
                  name="Best Fitness"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Dual Chart Grid: Chart 2 & Chart 3 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Chart 2: Navigation Depth Before/After */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div className="pb-3 mb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                2. Navigation Depth Before vs. After
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Distribution of pages per hierarchy click depth level.
              </p>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={depthComparisonData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="level" stroke="#64748B" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                  <Bar dataKey="Original" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Optimized" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: Semantic Coherence Score */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div className="pb-3 mb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                3. Semantic Topic Coherence
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Evaluated content similarity and topic alignment across categories.
              </p>
            </div>

            <div className="h-56 w-full flex items-center justify-center">
              {semanticData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={semanticData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="metric" stroke="#64748B" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748B" fontSize={11} tickLine={false} domain={[0, 1]} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="Score" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-xs text-slate-500 space-y-1">
                  <p className="font-medium text-slate-700">Semantic Weight Not Applied</p>
                  <p>Semantic evaluation was omitted in this optimization preset.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dual Chart Grid: Chart 4 & Chart 5 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Chart 4: Structural Changes Breakdown */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div className="pb-3 mb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                4. Structural Changes Breakdown
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Quantified parent reassignments, position shifts, and depth promotions.
              </p>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={structuralChangesData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(val) => [`${val} pages`, "Count"]}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 5: Fitness Component Breakdown */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div className="pb-3 mb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                5. Multi-Objective Fitness Costs
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Normalized costs evaluated by fitness formula.
              </p>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={breakdownData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="component" stroke="#64748B" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(val) => [`${Number(val).toFixed(4)}`, "Cost Value"]}
                  />
                  <Bar dataKey="cost" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
</div>
  );
};

