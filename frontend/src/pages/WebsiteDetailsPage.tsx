import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Globe,
  ExternalLink,
  Bot,
  RefreshCw,
  BarChart2,
  Sliders,
  Play,
  FileText,
  Clock,
  Layers,
  ArrowLeft,
  X,
  Trash2,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Zap,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Website, Page, CrawlJobResponse, OptimizationRun } from "@/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { StatCard } from "@/components/ui/StatCard";
import { useAccessGuard } from "@/context/AccessGuardContext";

export const WebsiteDetailsPage: React.FC = () => {
  const { requireAccess } = useAccessGuard();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const websiteId = Number(id);

  const [website, setWebsite] = useState<Website | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [runs, setRuns] = useState<OptimizationRun[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);

  // Crawl trigger state
  const [crawlModalOpen, setCrawlModalOpen] = useState<boolean>(false);
  const [maxPages, setMaxPages] = useState<number>(10);
  const [maxDepth, setMaxDepth] = useState<number>(3);
  const [crawling, setCrawling] = useState<boolean>(false);
  const [deepScanning, setDeepScanning] = useState<boolean>(false);
  const [crawlStatus, setCrawlStatus] = useState<CrawlJobResponse | null>(null);
  const [crawlError, setCrawlError] = useState<string | null>(null);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!websiteId || isNaN(websiteId)) return;
    setLoading(true);
    setError(null);
    try {
      const [site, sitePages, optRuns] = await Promise.all([
        api.getWebsite(websiteId),
        api.getWebsitePages(websiteId),
        api.getOptimizationRuns(websiteId).catch(() => [] as OptimizationRun[]),
      ]);
      setWebsite(site);
      setPages(sitePages);
      setRuns(optRuns);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
      } else {
        setError(new ApiError("Failed to fetch website details."));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [websiteId]);

  const handleStartCrawl = (e: React.FormEvent) => {
    e.preventDefault();
    requireAccess(async () => {
      setCrawling(true);
      setCrawlError(null);
      try {
        const job = await api.startCrawl(websiteId, { maxPages, maxDepth });
        setCrawlStatus(job);
        // Poll crawl status
        pollCrawlStatus(job.jobId);
      } catch (err) {
        if (err instanceof ApiError) {
          setCrawlError(err.message);
        } else {
          setCrawlError("Failed to initiate website crawl.");
        }
        setCrawling(false);
      }
    });
  };

  const pollCrawlStatus = (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const job = await api.getCrawlJob(websiteId, jobId);
        setCrawlStatus(job);
        if (job.status === "COMPLETED" || job.status === "FAILED") {
          clearInterval(interval);
          setCrawling(false);
          await fetchData();
        }
      } catch {
        clearInterval(interval);
        setCrawling(false);
      }
    }, 1500);
  };

  const handleFullDeepScanAndReform = () => {
    requireAccess(async () => {
      setDeepScanning(true);
      setCrawlError(null);
      try {
        // 1. Deep Crawl up to 50 pages and depth 3
        const job = await api.startCrawl(websiteId, { maxPages: 50, maxDepth: 3 });
        setCrawlStatus(job);

        // 2. Poll until crawl completion
        await new Promise<void>((resolve, reject) => {
          let attempts = 0;
          const interval = setInterval(async () => {
            attempts++;
            try {
              const status = await api.getCrawlJob(websiteId, job.jobId);
              setCrawlStatus(status);
              if (status.status === "COMPLETED") {
                clearInterval(interval);
                resolve();
              } else if (status.status === "FAILED") {
                clearInterval(interval);
                reject(new Error(status.errorMessage || "Website crawl failed."));
              } else if (attempts > 60) {
                clearInterval(interval);
                resolve();
              }
            } catch (err) {
              clearInterval(interval);
              reject(err);
            }
          }, 1200);
        });

        // 3. Automatically run optimization
        const run = await api.runOptimization({
          websiteId,
          populationSize: 40,
          iterations: 120,
          randomSeed: 42,
          maxDepth: 3,
          maxChildren: 7,
          weights: {
            navigation: 0.40,
            behavior: 0.30,
            semantic: 0.15,
            structural: 0.05,
            depth: 0.10,
          },
        });

        // 4. Show result directly!
        navigate(`/optimize/results/${run.id}`);
      } catch (err) {
        setCrawlError(err instanceof Error ? err.message : "Failed to run full deep scan.");
        setDeepScanning(false);
      }
    });
  };

  const confirmDeleteWebsite = () => {
    if (!website) return;
    requireAccess(async () => {
      setDeleting(true);
      setDeleteError(null);
      try {
        await api.deleteWebsite(website.id);
        navigate("/websites");
      } catch (err) {
        console.error("Failed to delete website:", err);
        setDeleteError(err instanceof Error ? err.message : "Failed to delete website.");
        setDeleting(false);
      }
    });
  };

  if (loading) {
    return <LoadingState message="Loading website topology details..." rows={5} />;
  }

  if (error || !website) {
    return (
      <div className="space-y-4">
        <Link
          to="/websites"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Websites
        </Link>
        <ErrorState
          title="Website Not Found or Server Offline"
          message={error ? error.message : "The requested website target could not be loaded."}
          isBackendOffline={error?.isBackendUnavailable}
          onRetry={fetchData}
        />
      </div>
    );
  }

  const pageCount = pages.length;
  const avgDepth =
    pageCount > 0
      ? (pages.reduce((acc, p) => acc + p.depth, 0) / pageCount).toFixed(2)
      : "0.00";
  const maxObservedDepth =
    pageCount > 0 ? Math.max(...pages.map((p) => p.depth)) : 0;
  const avgLoadTime =
    pageCount > 0
      ? (
          pages.reduce((acc, p) => acc + (p.loadTime || 0), 0) / pageCount
        ).toFixed(0)
      : "0";

  const completedRuns = runs.filter((r) => r.status === "COMPLETED");
  const latestCompletedRun = completedRuns.length > 0 ? completedRuns[0] : null;

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            to="/websites"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> All Websites
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{website.name}</h1>
            <StatusBadge status={pageCount > 0 ? "ANALYZED" : "IDLE"} size="sm" />
          </div>
          <a
            href={website.baseUrl}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
          >
            {website.baseUrl}
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleFullDeepScanAndReform}
            disabled={deepScanning || crawling}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-500 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            title="Crawl 50+ pages and generate optimized navigation in 1 click"
          >
            {deepScanning ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Deep Scanning &amp; Reforming...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 fill-white" />
                <span>Full Deep Scan</span>
              </>
            )}
          </button>
          {latestCompletedRun && (
            <Link
              to={`/optimize/results/${latestCompletedRun.id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-500 shadow-sm transition-colors"
              title="View latest optimized hierarchy"
            >
              <Sparkles className="w-3.5 h-3.5" />
              View Latest Reform
            </Link>
          )}
          <button
            onClick={() => setCrawlModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            Custom Crawl
          </button>
          <Link
            to={`/websites/${website.id}/analysis`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-indigo-100 bg-indigo-50/50 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 transition-colors shadow-sm"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            Analysis
          </Link>
          <Link
            to={`/optimize?websiteId=${website.id}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
          >
            <Sliders className="w-3.5 h-3.5" />
            Reform Navigation
          </Link>
          <button
            onClick={() => {
              setDeleteError(null);
              setDeleteModalOpen(true);
            }}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-rose-200 bg-rose-50/60 text-xs font-semibold text-rose-600 hover:bg-rose-100 hover:text-rose-700 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            title="Delete Website"
          >
            {deleting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>

      {/* Real Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Discovered Pages"
          value={pageCount}
          subtitle="Pages stored in database"
          icon={FileText}
          accentColor="indigo"
        />
        <StatCard
          title="Average Click Depth"
          value={avgDepth}
          subtitle={`Max depth observed: ${maxObservedDepth}`}
          icon={Layers}
          accentColor="cyan"
        />
        <StatCard
          title="Avg Page Fetch Time"
          value={`${avgLoadTime} ms`}
          subtitle="Crawler HTTP latency"
          icon={Clock}
          accentColor="amber"
        />
        <StatCard
          title="Target Domain"
          value={website.name}
          subtitle={`ID: #${website.id}`}
          icon={Globe}
          accentColor="purple"
        />
      </div>

      {/* Latest Navigation Reform Card */}
      {latestCompletedRun && (
        <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50/80 via-white to-indigo-50/50 p-5 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-emerald-100/60">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Optimized Structure Available
              </span>
              <span className="text-xs text-slate-500">
                Run #{latestCompletedRun.id} • {new Date(latestCompletedRun.createdAt).toLocaleDateString()} at {new Date(latestCompletedRun.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <Link
              to={`/optimize/results/${latestCompletedRun.id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-500 shadow-sm transition-all self-start sm:self-auto hover:shadow"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>View Reform Results &amp; Navigation Tree</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="bg-white/80 border border-slate-200/80 rounded-lg p-3">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">Baseline Friction</span>
              <span className="font-mono text-sm font-semibold text-slate-700">
                {latestCompletedRun.initialFitness != null ? latestCompletedRun.initialFitness.toFixed(4) : "—"}
              </span>
            </div>
            <div className="bg-white/80 border border-emerald-200/80 rounded-lg p-3">
              <span className="text-[11px] font-medium text-emerald-600 uppercase tracking-wider block">Reformed Score</span>
              <span className="font-mono text-sm font-bold text-emerald-700">
                {latestCompletedRun.finalFitness != null ? latestCompletedRun.finalFitness.toFixed(4) : "—"}
              </span>
            </div>
            <div className="bg-white/80 border border-slate-200/80 rounded-lg p-3">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">Efficiency Gain</span>
              <span className="font-mono text-sm font-bold text-emerald-600">
                {latestCompletedRun.initialFitness && latestCompletedRun.finalFitness && latestCompletedRun.initialFitness > 0
                  ? `+${(((latestCompletedRun.initialFitness - latestCompletedRun.finalFitness) / latestCompletedRun.initialFitness) * 100).toFixed(2)}%`
                  : "—"}
              </span>
            </div>
            <div className="bg-white/80 border border-slate-200/80 rounded-lg p-3">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">Optimization Time</span>
              <span className="font-mono text-sm font-semibold text-slate-700">
                {latestCompletedRun.executionTimeMs != null ? `${latestCompletedRun.executionTimeMs} ms` : `${latestCompletedRun.executionTime} s`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Crawling active banner if crawling */}
      {crawlStatus && (
        <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/70 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-900">
              Active Ingestion Job: {crawlStatus.jobId}
            </span>
            <StatusBadge status={crawlStatus.status} size="sm" />
          </div>
          <div className="text-xs text-slate-700 flex items-center gap-4">
            <span>Pages Crawled: <strong>{crawlStatus.pagesCrawled}</strong></span>
            <span>Links Found: <strong>{crawlStatus.linksDiscovered}</strong></span>
            {crawlStatus.errorMessage && (
              <span className="text-rose-600 font-medium">{crawlStatus.errorMessage}</span>
            )}
          </div>
        </div>
      )}

      {/* Discovered Pages Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Discovered Pages Inventory</h2>
            <p className="text-xs text-slate-500">
              Extracted internal HTML pages and structural hierarchy depths
            </p>
          </div>
          <button
            onClick={fetchData}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-50 transition-colors"
            title="Refresh Pages"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {pages.length === 0 ? (
          <div className="py-12 text-center text-slate-500 space-y-2">
            <Bot className="w-10 h-10 mx-auto text-slate-400" />
            <p className="text-sm font-medium text-slate-700">No pages crawled yet</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Run the crawler to discover internal links and build the navigation directed graph.
            </p>
            <button
              onClick={() => setCrawlModalOpen(true)}
              className="mt-3 inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-indigo-600 text-xs font-medium text-white hover:bg-indigo-500 shadow-sm"
            >
              <Play className="w-3.5 h-3.5" /> Start Crawl
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 bg-slate-50/50">
                  <th className="py-3 px-3 font-medium">Depth</th>
                  <th className="py-3 px-3 font-medium">Page Title</th>
                  <th className="py-3 px-3 font-medium">URL Path</th>
                  <th className="py-3 px-3 font-medium text-right">Fetch Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {pages.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3 font-mono">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                          p.depth === 0
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                            : p.depth <= 2
                            ? "bg-sky-50 text-sky-700 border-sky-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        Level {p.depth}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-900 max-w-[220px] truncate">
                      {p.title || "(Untitled Page)"}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-500 max-w-[320px] truncate">
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-indigo-600 inline-flex items-center gap-1"
                      >
                        {p.url}
                        <ExternalLink className="w-3 h-3 opacity-60" />
                      </a>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-500 text-right">
                      {p.loadTime ? `${p.loadTime.toFixed(0)} ms` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Navigation Reform History */}
      {runs.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                Navigation Reform History
              </h2>
              <p className="text-xs text-slate-500">
                Saved optimization runs and historical hierarchy trees for this website.
              </p>
            </div>
            <Link
              to={`/optimize?websiteId=${website.id}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              <span>Run New Reform</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Run ID</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Baseline</th>
                  <th className="py-2.5 px-3">Reformed</th>
                  <th className="py-2.5 px-3">Improvement</th>
                  <th className="py-2.5 px-3">Duration</th>
                  <th className="py-2.5 px-3 text-right">Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {runs.map((r) => {
                  const imp = (r.initialFitness && r.finalFitness && r.initialFitness > 0)
                    ? ((r.initialFitness - r.finalFitness) / r.initialFitness) * 100
                    : null;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 font-mono font-medium text-slate-900">
                        #{r.id}
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {new Date(r.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-3">
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
                      <td className="py-3 px-3 font-mono">
                        {r.initialFitness != null ? r.initialFitness.toFixed(4) : "—"}
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-slate-900">
                        {r.finalFitness != null ? r.finalFitness.toFixed(4) : "—"}
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-emerald-600">
                        {imp != null ? `+${imp.toFixed(2)}%` : "—"}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-500">
                        {r.executionTimeMs != null ? `${r.executionTimeMs} ms` : "—"}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Link
                          to={`/optimize/results/${r.id}`}
                          className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                          <span>View Report</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Crawl Configuration Modal */}
      {crawlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Bot className="w-5 h-5 text-indigo-600" />
                Crawl Setup: {website.name}
              </h2>
              <button
                onClick={() => setCrawlModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {crawlError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {crawlError}
              </div>
            )}

            <form onSubmit={handleStartCrawl} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">
                  Maximum Pages to Discover
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={maxPages}
                  onChange={(e) => setMaxPages(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
                <span className="text-[11px] text-slate-500">
                  Recommended: 10 - 50 pages for optimization benchmark datasets.
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">
                  Maximum Click Depth Limit
                </label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={maxDepth}
                  onChange={(e) => setMaxDepth(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCrawlModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={crawling}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 inline-flex items-center gap-2 shadow-sm"
                >
                  {crawling ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Ingesting...
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" /> Start Crawl
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && website && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-rose-100 bg-white p-6 shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </div>
                Delete Target Website
              </h2>
              <button
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleting}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {deleteError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {deleteError}
              </div>
            )}

            <p className="text-sm text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete{" "}
              <span className="font-semibold text-slate-900">
                &ldquo;{website.name}&rdquo;
              </span>
              ? All {pages.length} crawled pages, link topology graphs, and navigation reform runs for this website will be removed permanently.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteWebsite}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-rose-600 text-xs font-semibold text-white hover:bg-rose-500 transition-colors disabled:opacity-50 inline-flex items-center gap-2 shadow-sm cursor-pointer"
              >
                {deleting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {deleting ? "Deleting..." : "Delete Website"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
