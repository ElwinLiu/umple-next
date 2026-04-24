import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  HelpCircle,
  RefreshCw,
  Tag,
  Terminal,
  XCircle,
} from "lucide-react";
import { api } from "@/api/client";
import type { StatusResponse } from "@/api/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const REFRESH_INTERVAL_MS = 30_000;

type HealthRecord = {
  group: string;
  name: string;
  data: Record<string, unknown>;
};

export function StatusPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStatus = useCallback(async (signal?: AbortSignal) => {
    setError(null);
    setRefreshing(true);
    try {
      const next = await api.status(signal);
      setStatus(next);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to load status");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadStatus(controller.signal);
    const interval = window.setInterval(() => {
      void loadStatus();
    }, REFRESH_INTERVAL_MS);

    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [loadStatus]);

  return (
    <main className="h-screen overflow-y-auto bg-surface-1 text-ink">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-xl border border-border bg-surface-0 p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand/10 p-2 shadow-inner ring-1 ring-brand/20">
              <img src="/umple-logo.svg" alt="" className="h-full w-full object-contain" />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-ink">System Status</h1>
                {status ? <StatusBadge value={status.status} /> : null}
              </div>
              <p className="text-sm font-medium text-ink-muted">
                UmpleOnline Backend • Compiler • Collaboration • LSP • Execution
              </p>
              {status ? (
                <div className="flex items-center gap-2 text-xs text-ink-faint">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    Last update: {formatDate(status.generatedAt)}
                  </span>
                  <span className="h-1 w-1 rounded-full bg-border" />
                  <span>Refreshes every 30s</span>
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <Button asChild variant="outline" size="sm" className="font-semibold">
              <Link to="/">Back to editor</Link>
            </Button>
            <Button
              onClick={() => void loadStatus()}
              disabled={refreshing}
              size="sm"
              className={cn(
                "font-semibold transition-all",
                refreshing ? "opacity-80" : "shadow-sm active:scale-95",
              )}
            >
              <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
              {refreshing ? "Refreshing..." : "Refresh Status"}
            </Button>
          </div>
        </header>

        {error ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Status unavailable</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {loading && !status ? <StatusSkeleton /> : null}
        {status ? <StatusContent status={status} /> : null}
      </div>
    </main>
  );
}

function StatusContent({ status }: { status: StatusResponse }) {
  const release = status.release ?? {};
  const legacy = status.legacy ?? {};
  const legacyDocker = asRecord(legacy.docker);
  const releaseLabel = formatValue(release.releaseTag) || shortCommit(status.build?.sourceCommit) || "unknown";
  const releaseDetail = shortCommit(release.sourceCommit) || shortCommit(status.build?.sourceCommit) || formatValue(status.build?.sourceRefName);
  const compilerState = formatValue(status.umplesync?.alive) === "true" ? "Running" : "Not running";
  const healthRecords = buildHealthRecords(status);
  const dockerStats = asRecordArray(legacyDocker.stats);

  return (
    <div className="flex flex-col gap-4" data-testid="status-dashboard">
      <OverviewStrip
        items={[
          {
            label: "Backend uptime",
            value: formatDuration(status.uptimeSeconds),
            detail: "Since this process started",
            icon: <Clock className="size-5" />,
          },
          {
            label: "Release",
            value: releaseLabel,
            detail: releaseDetail || "No release metadata",
            icon: <Tag className="size-5" />,
          },
          {
            label: "Compiler",
            value: compilerState,
            detail: `Port ${formatValue(status.umplesync?.port) || "unknown"}`,
            icon: <Cpu className="size-5" />,
          },
          {
            label: "Health rows",
            value: String(healthRecords.length),
            detail: "Services, checks, dependencies",
            icon: <Activity className="size-5" />,
          },
        ]}
      />

      {dockerStats.length > 0 && (
        <StatusSection
          title="System resources"
          description="Real-time Docker container resource usage across the UmpleOnline stack"
          testId="status-system-resources"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {dockerStats.map((stat, index) => (
              <div
                key={`${stat.name}-${index}`}
                className="flex flex-col gap-2 rounded-lg border border-border bg-surface-1 p-3 shadow-sm transition-all hover:border-brand/30 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="truncate font-bold text-ink">{labelize(String(stat.name))}</span>
                  <StatusBadge value={String(stat.status)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-muted">CPU Usage</span>
                    <span className="font-mono font-medium text-ink">{formatValue(stat.CPUPerc)}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full bg-brand"
                      style={{ width: String(stat.CPUPerc).replace("%", "") + "%" }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-muted">Memory</span>
                    <span className="font-mono font-medium text-ink">{formatValue(stat.MemUsage)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-muted">Net I/O</span>
                    <span className="font-mono text-[10px] text-ink-faint">
                      {formatValue(stat.NetIO)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </StatusSection>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]">
        <StatusSection
          title="Service health"
          description="Services, backend checks, and configured software or filesystem dependencies"
          testId="status-service-health"
        >
          <HealthTable records={healthRecords} />
        </StatusSection>

        <StatusSection
          title="Release & runtime"
          description="Build provenance, deployment metadata, backend process, and configured service targets"
          testId="status-release-runtime"
        >
          <SectionBlock title="Build">
            <KeyValueTable data={status.build} compact />
          </SectionBlock>
          <SectionBlock title="Release">
            <KeyValueTable data={status.release} compact />
          </SectionBlock>
          <SectionBlock title="Process">
            <KeyValueTable data={status.process} compact />
          </SectionBlock>
          <SectionBlock title="Config">
            <KeyValueTable data={status.config} compact />
          </SectionBlock>
        </StatusSection>
      </div>

      <StatusSection
        title="Umplesync compiler"
        description="Compiler process details and raw output from the umplesync -log command"
        action={<StatusBadge value={formatValue(status.umplesync?.status)} />}
        testId="status-umplesync"
      >
        <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
          <div className="flex flex-col gap-4">
            <SectionBlock title="Compiler details">
              <KeyValueTable data={withoutKeys(status.umplesync, ["log", "errors"])} compact />
            </SectionBlock>
            {formatValue(status.umplesync?.errors) ? (
              <SectionBlock title="Errors" className="text-status-error">
                <div className="p-3 font-mono text-xs bg-status-error/5 border border-status-error/20 rounded-md">
                  {formatValue(status.umplesync.errors)}
                </div>
              </SectionBlock>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase text-ink-faint">
                <Terminal className="size-3" />
                Compiler logs
              </h2>
            </div>
            <div className="group relative">
              <div className="absolute inset-0 -m-0.5 rounded-lg bg-gradient-to-b from-brand/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative flex flex-col overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 shadow-2xl">
                <div className="flex items-center gap-1.5 border-b border-neutral-800 bg-neutral-900/50 px-4 py-2">
                  <div className="size-2.5 rounded-full bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.3)]" />
                  <div className="size-2.5 rounded-full bg-amber-500/80 shadow-[0_0_8px_rgba(245,158,11,0.3)]" />
                  <div className="size-2.5 rounded-full bg-green-500/80 shadow-[0_0_8px_rgba(34,197,94,0.3)]" />
                  <span className="ml-2 font-mono text-[10px] text-neutral-500 uppercase tracking-widest">
                    umplesync.log
                  </span>
                </div>
                <pre className="max-h-[28rem] overflow-auto p-4 font-mono text-xs leading-relaxed text-neutral-300 scrollbar-thin scrollbar-track-neutral-950 scrollbar-thumb-neutral-800">
                  {formatValue(status.umplesync?.log) || (
                    <span className="italic text-neutral-600">No log output returned.</span>
                  )}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </StatusSection>

      <StatusSection
        title="Diagnostics"
        description="Counters and legacy status probes retained from the full status payload"
        testId="status-diagnostics"
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <SectionBlock title="Counters">
            <KeyValueTable data={status.counters} compact />
          </SectionBlock>
          <SectionBlock title="Legacy visits">
            <KeyValueTable data={asRecord(legacy.visits)} compact />
          </SectionBlock>
          <SectionBlock title="Legacy software">
            <RecordsTable records={asRecordArray(legacy.software)} primary="name" />
          </SectionBlock>
          <SectionBlock title="Legacy listener">
            <KeyValueTable data={asRecord(legacy.listener)} compact />
          </SectionBlock>
          <SectionBlock title="Legacy Docker" className="xl:col-span-2">
            <KeyValueTable data={withoutKeys(legacyDocker, ["stats"])} compact />
          </SectionBlock>
          <SectionBlock title="Legacy execution" className="xl:col-span-2">
            <KeyValueTable data={asRecord(legacy.execution)} compact />
          </SectionBlock>
        </div>
      </StatusSection>
    </div>
  );
}

function OverviewStrip({
  items,
}: {
  items: Array<{ label: string; value: string; detail: string; icon?: ReactNode }>;
}) {
  return (
    <section className="grid overflow-hidden rounded-lg border border-border bg-surface-0 shadow-sm sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={cn(
            "flex min-w-0 gap-3 px-4 py-4",
            index > 0 && "border-t border-border sm:border-l sm:border-t-0",
            index === 2 && "sm:border-l-0 xl:border-l",
          )}
        >
          {item.icon && (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-1 text-ink-muted shadow-inner">
              {item.icon}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
              {item.label}
            </p>
            <p className="mt-0.5 truncate text-xl font-bold tracking-tight text-ink">{item.value}</p>
            <p className="mt-0.5 truncate text-xs text-ink-muted">{item.detail}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

function StatusSection({
  title,
  description,
  action,
  children,
  testId,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <Card className="gap-4 rounded-lg py-4" data-testid={testId}>
      <CardHeader className="gap-1 px-4 sm:px-5">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className="px-4 sm:px-5">{children}</CardContent>
    </Card>
  );
}

function SectionBlock({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("min-w-0", className)}>
      <h2 className="mb-2 text-xs font-semibold uppercase text-ink-faint">{title}</h2>
      <div className="overflow-hidden rounded-md border border-border bg-surface-0/40">{children}</div>
    </section>
  );
}

function buildHealthRecords(status: StatusResponse): HealthRecord[] {
  const services = Object.entries(status.services ?? {}).map(([name, data]) => ({
    group: "Service",
    name: serviceTitle(name),
    data,
  }));
  const checks = Object.entries(status.checks ?? {}).map(([name, data]) => ({
    group: "Check",
    name: labelize(name),
    data,
  }));
  const dependencies = (status.dependencies ?? []).map((data) => ({
    group: "Dependency",
    name: formatValue(data.name) || "Dependency",
    data,
  }));

  return [...services, ...checks, ...dependencies];
}

function HealthTable({ records }: { records: HealthRecord[] }) {
  if (records.length === 0) {
    return <p className="text-sm text-muted-foreground">No health records reported.</p>;
  }

  return (
    <div className="overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Group</TableHead>
            <TableHead className="w-44">Name</TableHead>
            <TableHead className="w-28">Status</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record, index) => (
            <TableRow key={`${record.group}-${record.name}-${index}`}>
              <TableCell className="align-top text-xs text-ink-muted">{record.group}</TableCell>
              <TableCell className="align-top font-medium">{record.name}</TableCell>
              <TableCell className="align-top">
                <StatusBadge value={formatValue(record.data.status) || "unknown"} />
              </TableCell>
              <TableCell className="max-w-[42rem] whitespace-normal break-words align-top font-mono text-xs">
                <CompactRecord data={withoutKeys(record.data, ["name", "status"])} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function CompactRecord({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, value]) => formatValue(value) !== "");
  if (entries.length === 0) return <span className="text-ink-faint">No detail</span>;

  return (
    <dl className="grid gap-1">
      {entries.map(([key, value]) => (
        <div key={key} className="grid gap-1 md:grid-cols-[9rem_minmax(0,1fr)]">
          <dt className="font-sans text-xs font-medium text-ink-muted">{labelize(key)}</dt>
          <dd className="min-w-0 break-words">
            <FormattedValue value={value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function KeyValueTable({
  data,
  compact = false,
}: {
  data: Record<string, unknown> | undefined;
  compact?: boolean;
}) {
  const entries = Object.entries(data ?? {});
  if (entries.length === 0) {
    return <p className="px-3 py-2 text-sm text-muted-foreground">No data reported.</p>;
  }

  return (
    <Table>
      <TableBody>
        {entries.map(([key, value]) => (
          <TableRow key={key}>
            <TableCell className={cn("align-top font-medium text-muted-foreground", compact ? "w-36 py-2" : "w-48")}>
              {labelize(key)}
            </TableCell>
            <TableCell className={cn("max-w-[44rem] whitespace-normal break-words font-mono text-xs", compact && "py-2")}>
              <FormattedValue value={value} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RecordsTable({
  records,
  primary,
}: {
  records: Array<Record<string, unknown>>;
  primary: string;
}) {
  if (records.length === 0) {
    return <p className="px-3 py-2 text-sm text-muted-foreground">No records reported.</p>;
  }

  const keys = Array.from(new Set(records.flatMap((record) => Object.keys(record))));
  const sortedKeys = [primary, ...keys.filter((key) => key !== primary)];

  return (
    <div className="overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {sortedKeys.map((key) => (
              <TableHead key={key}>{labelize(key)}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record, index) => (
            <TableRow key={`${formatValue(record[primary])}-${index}`}>
              {sortedKeys.map((key) => (
                <TableCell key={key} className="max-w-[28rem] whitespace-normal break-words font-mono text-xs">
                  <FormattedValue value={record[key]} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function FormattedValue({ value }: { value: unknown }) {
  if (isStatusValue(value)) {
    return <StatusBadge value={value} />;
  }
  if (typeof value === "boolean") {
    return <Badge variant="outline">{value ? "true" : "false"}</Badge>;
  }
  if (value && typeof value === "object") {
    return <pre className="m-0 whitespace-pre-wrap break-words">{JSON.stringify(value, null, 2)}</pre>;
  }
  return <>{formatValue(value)}</>;
}

function StatusBadge({ value }: { value: string }) {
  const normalized = (value || "unknown").toLowerCase();

  let icon = <HelpCircle className="size-3.5" />;
  let className = "border-muted-foreground/30 bg-muted/50 text-muted-foreground";

  if (normalized === "ok" || normalized === "running") {
    icon = <CheckCircle2 className="size-3.5" />;
    className =
      "border-status-success/30 bg-status-success text-white dark:text-status-success dark:bg-status-success/10";
  } else if (["degraded", "unparsed", "not_tracked"].includes(normalized)) {
    icon = <AlertTriangle className="size-3.5" />;
    className =
      "border-status-warning/30 bg-status-warning text-white dark:text-status-warning dark:bg-status-warning/10";
  } else if (["unreachable", "unavailable", "error"].includes(normalized)) {
    icon = <XCircle className="size-3.5" />;
    className =
      "border-status-error/30 bg-status-error text-white dark:text-status-error dark:bg-status-error/10";
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "flex w-fit items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        className,
      )}
    >
      {icon}
      {value || "unknown"}
    </Badge>
  );
}

function StatusSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="px-4 py-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-28" />
              </div>
            </div>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardHeader>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function isStatusValue(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return ["ok", "degraded", "unreachable", "unavailable", "not_tracked", "running", "unparsed"].includes(value.toLowerCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function shortCommit(value: unknown): string {
  const commit = formatValue(value);
  if (!commit || commit === "unknown") return "";
  return commit.length > 12 ? commit.slice(0, 12) : commit;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds)) return "";
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function labelize(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (match) => match.toUpperCase());
}

function serviceTitle(value: string): string {
  if (value === "codeExecution") return "Code Execution";
  if (value === "lsp") return "LSP";
  return labelize(value);
}

function withoutKeys(data: Record<string, unknown> | undefined, keys: string[]) {
  return Object.fromEntries(Object.entries(data ?? {}).filter(([key]) => !keys.includes(key)));
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => (
    item !== null && typeof item === "object" && !Array.isArray(item)
  ));
}
