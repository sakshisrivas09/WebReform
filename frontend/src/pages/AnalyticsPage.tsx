import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  Clock,
  Compass,
  TrendingDown,
  Sparkles,
  ArrowRight,
  Globe,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { api, ApiError } from "@/lib/api";
import type { Website, OptimizationRun } from "@/types";
import { StatCard } from "@/components/ui/StatCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";

export const AnalyticsPage: React.FC = () => {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [runs, setRuns] = useState<OptimizationRun[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sites, optRuns] = await Promise.all([
        api.getWebsites(),
        api.getOptimizationRuns().catch(() => [] as OptimizationRun[]),
      ]);
      setWebsites(sites);
      setRuns(optRuns);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err
          : new ApiError("Failed to fetch optimization analytics telemetry.")
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const completedRuns = useMemo(
    () => runs.filter((r) => r.status === "COMPLETED"),
    [runs]
  );

  const avgImprovement = useMemo(() => {
    if (completedRuns.length === 0) return 0;
    const sum = completedRuns.reduce(
      (acc, r) => {
        const imp = r.improvementPercentage ?? ((r.initialFitness && r.initialFitness > 0 && r.finalFitness != null) ? ((r.initialFitness - r.finalFitness) / r.initialFitness) * 100 : 0);
        return acc + imp;
      },
      0
    );
    return Number((sum / completedRuns.length).toFixed(2));
  }, [completedRuns]);

  const bestScore = useMemo(() => {
    if (completedRuns.length === 0) return "N/A";
    const validScores = completedRuns
      .map((r) => r.finalFitness)
      .filter((f): f is number => typeof f === "number" && !isNaN(f));
    if (validScores.length === 0) return "N/A";
    const min = Math.min(...validScores);
    return min.toFixed(4);
  }, [completedRuns]);

  const avgExecutionTime = useMemo(() => {
    if (completedRuns.length === 0) return 0;
    const sum = completedRuns.reduce(
      (acc, r) => acc + (r.executionTimeMs ?? (r.executionTime ? Math.round(r.executionTime * 1000) : 0)),
      0
    );
    return Math.round(sum / completedRuns.length);
  }, [completedRuns]);

  // Convergence overlay chart from completed runs
  const convergenceChartData = useMemo(() => {
    if (completedRuns.length === 0) return [];
    // Take up to 5 most recent completed runs with convergence histories
    const recent = completedRuns
      .filter((r): r is OptimizationRun & { convergence: number[] } => Array.isArray(r.convergence) && r.convergence.length > 0)
      .slice(-5);

    if (recent.length === 0) return [];

    const maxIters = Math.max(...recent.map((r) => r.convergence.length));
    const points: Record<string, any>[] = [];

    for (let i = 0; i < maxIters; i++) {
      const pt: Record<string, any> = { iteration: i };
      recent.forEach((r) => {
        if (i < r.convergence.length) {
          const label = `Run #${r.id}`;
          pt[label] = Number(r.convergence[i].toFixed(4));
        }
      });
      points.push(pt);
    }

    return points;
  }, [completedRuns]);

  const tooltipStyle = {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    color: "#0F172A",
    fontSize: "12px",
    borderRadius: "8px",
    boxShadow:
      "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  };

  const lineColors = ["#4F46E5", "#0EA5E9", "#8B5CF6", "#10B981", "#F59E0B"];

  if (loading) {
    return <LoadingState message="Loading optimization analytics and telemetry..." rows={4} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 mb-2">
            <BarChart3 className="h-3.5 w-3.5 text-indigo-600" />
            Performance Intelligence
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Sparkles className="w-6 h-6 text-indigo-600" />
            Optimization Analytics &amp; Convergence
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Empirical evaluation of navigation friction reduction, convergence curves, and reform run histories.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link
            to="/optimize"
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
          >
            <span>Start Reform</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {error && (
        <ErrorState
          title="Telemetry Connection Error"
          message={error.message}
          isBackendOffline={error.isBackendUnavailable}
          onRetry={fetchData}
        />
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Websites Monitored"
          value={websites.length}
          subtitle="Registered domain targets"
          icon={Globe}
          accentColor="indigo"
        />
        <StatCard
          title="Completed Reforms"
          value={completedRuns.length}
          subtitle={`${runs.length} total optimization jobs`}
          icon={CheckCircle2}
          accentColor="emerald"
        />
        <StatCard
          title="Avg. Path Efficiency Gain"
          value={completedRuns.length > 0 ? `+${avgImprovement}%` : "—"}
          subtitle="Navigation friction reduction"
          icon={TrendingDown}
          accentColor="cyan"
        />
        <StatCard
          title="Avg. Optimization Speed"
          value={completedRuns.length > 0 ? `${avgExecutionTime} ms` : "—"}
          subtitle="Algorithm search compute time"
          icon={Clock}
          accentColor="purple"
        />
      </div>

      {/* Convergence Chart or Empty State */}
      {completedRuns.length > 0 && convergenceChartData.length > 0 ? (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Compass className="w-4 h-4 text-indigo-600" />
                  Fitness Function Convergence Across Completed Runs
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Friction metric minimization curve (lower score signifies faster path accessibility and coherent structure).
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Best Score: {bestScore}
              </span>
            </div>

            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={convergenceChartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis
                    dataKey="iteration"
                    stroke="#64748B"
                    fontSize={11}
                    tickLine={false}
                    label={{ value: "Iteration Step", position: "insideBottom", offset: -5, fontSize: 11, fill: "#94A3B8" }}
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
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }} />
                  {completedRuns.slice(-5).map((r, idx) => (
                    <Line
                      key={r.id}
                      type="monotone"
                      dataKey={`Run #${r.id}`}
                      stroke={lineColors[idx % lineColors.length]}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Historical Runs Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Recent Structure Reform Executions
              </h3>
              <span className="text-xs text-slate-500">
                {runs.length} record{runs.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3">Run ID</th>
                    <th className="px-6 py-3">Target Website</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Initial Score</th>
                    <th className="px-6 py-3">Final Score</th>
                    <th className="px-6 py-3">Improvement</th>
                    <th className="px-6 py-3">Duration</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {runs.map((r) => {
                    const site = websites.find((w) => w.id === r.websiteId);
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-3.5 font-mono font-medium text-slate-900">
                          #{r.id}
                        </td>
                        <td className="px-6 py-3.5 font-medium text-slate-900">
                          {site ? site.name : `Website #${r.websiteId}`}
                        </td>
                        <td className="px-6 py-3.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                              r.status === "COMPLETED"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : r.status === "FAILED"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 font-mono">
                          {r.initialFitness != null ? r.initialFitness.toFixed(4) : "—"}
                        </td>
                        <td className="px-6 py-3.5 font-mono font-semibold text-slate-900">
                          {r.finalFitness != null ? r.finalFitness.toFixed(4) : "—"}
                        </td>
                        <td className="px-6 py-3.5 font-mono font-semibold text-emerald-600">
                          {r.improvementPercentage != null
                            ? `+${r.improvementPercentage.toFixed(2)}%`
                            : "—"}
                        </td>
                        <td className="px-6 py-3.5 font-mono">
                          {r.executionTimeMs != null ? `${r.executionTimeMs} ms` : "—"}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <Link
                            to={`/optimize/results/${r.id}`}
                            className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800"
                          >
                            <span>View Report</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center space-y-4 shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <BarChart3 className="h-7 w-7" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-900">
              No Optimization Telemetry Yet
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Convergence curves and navigation efficiency gains will automatically populate here as soon as your first website reform is executed.
            </p>
          </div>

          <div className="pt-2">
            <Link
              to="/optimize"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
            >
              <span>Run Your First Website Reform</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
