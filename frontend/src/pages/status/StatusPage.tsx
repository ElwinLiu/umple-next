import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, RefreshCw } from "lucide-react";
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
        <header className="flex flex-col gap-3 rounded-lg border border-border bg-surface-0 px-4 py-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">UmpleOnline Status</h1>
              {status ? <StatusBadge value={status.status} /> : null}
            </div>
            <p className="text-sm text-ink-muted">
              Developer monitoring for the backend, compiler, collaboration, LSP, and execution services.
            </p>
            {status ? (
              <p className="text-xs text-ink-faint">
                Last refresh {formatDate(status.generatedAt)}. Auto-refreshes every 30 seconds.
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/">Back to editor</Link>
            </Button>
            <Button onClick={() => void loadStatus()} disabled={refreshing} size="sm">
              <RefreshCw data-icon="inline-start" />
              {refreshing ? "Refreshing" : "Refresh"}
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
  const services = Object.entries(status.services ?? {});
  const legacy = status.legacy ?? {};
  const legacyDocker = asRecord(legacy.docker);
  const release = status.release ?? {};
  const releaseLabel = formatValue(release.releaseTag) || shortCommit(status.build?.sourceCommit) || "unknown";
  const releaseDetail = shortCommit(release.sourceCommit) || shortCommit(status.build?.sourceCommit) || formatValue(status.build?.sourceRefName);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <SummaryCard title="Backend uptime" value={formatDuration(status.uptimeSeconds)} description="Since this backend process started" />
        <SummaryCard title="Release" value={releaseLabel} description={releaseDetail} />
        <SummaryCard title="Compiler" value={formatValue(status.umplesync?.alive) === "true" ? "Running" : "Not running"} description={`Port ${formatValue(status.umplesync?.port)}`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <DataCard title="Build" description="Source revision baked into the backend image">
          <KeyValueTable data={status.build} />
        </DataCard>

        <DataCard title="Release" description="Deployment metadata written by the production release flow">
          <KeyValueTable data={status.release} />
        </DataCard>

        <DataCard title="Runtime" description="Backend process and configured service targets">
          <KeyValueTable data={{ ...status.process, ...status.config }} />
        </DataCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DataCard title="Dependency Checks" description="Configured software and filesystem dependencies">
          <RecordsTable records={status.dependencies ?? []} primary="name" />
        </DataCard>

        <DataCard title="Health Checks" description="Backend healthcheck inputs used by Docker and operators">
          <KeyValueTable data={status.checks} />
        </DataCard>
      </div>

      <section className="grid gap-4 xl:grid-cols-3">
        {services.map(([name, service]) => (
          <DataCard key={name} title={serviceTitle(name)} description={formatValue(service.url)}>
            <KeyValueTable data={service} />
          </DataCard>
        ))}
      </section>

      <DataCard
        title="Umplesync"
        description="Compiler process details and raw output from the umplesync -log command"
        action={<StatusBadge value={formatValue(status.umplesync?.status)} />}
      >
        <KeyValueTable data={withoutKeys(status.umplesync, ["log"])} />
        <Separator className="my-4" />
        <pre className="max-h-[28rem] overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed text-foreground">
          {formatValue(status.umplesync?.log) || "No log output returned."}
        </pre>
      </DataCard>

      <DataCard title="Counters" description="Historical and since-start counters exposed by the status API">
        <KeyValueTable data={status.counters} />
      </DataCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <DataCard title="Legacy Software" description="Legacy log.php software probes, including executable paths">
          <RecordsTable records={asRecordArray(legacy.software)} primary="name" />
        </DataCard>

        <DataCard title="Legacy Listener" description="Legacy lsof-style listener check for the umplesync port">
          <KeyValueTable data={asRecord(legacy.listener)} />
        </DataCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DataCard title="Legacy Docker" description="Legacy container names and docker stats probes">
          <KeyValueTable data={withoutKeys(legacyDocker, ["stats"])} />
          <Separator className="my-4" />
          <RecordsTable records={asRecordArray(legacyDocker.stats)} primary="name" />
        </DataCard>

        <DataCard title="Legacy Execution" description="Execution-server fields exposed by the old status page">
          <KeyValueTable data={asRecord(legacy.execution)} />
        </DataCard>
      </div>

      <DataCard title="Legacy Visits" description="Old countlog.txt visit counter when present in the deployment">
        <KeyValueTable data={asRecord(legacy.visits)} />
      </DataCard>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="truncate text-2xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

function DataCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function KeyValueTable({ data }: { data: Record<string, unknown> | undefined }) {
  const entries = Object.entries(data ?? {});
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No data reported.</p>;
  }

  return (
    <Table>
      <TableBody>
        {entries.map(([key, value]) => (
          <TableRow key={key}>
            <TableCell className="w-48 align-top font-medium text-muted-foreground">{labelize(key)}</TableCell>
            <TableCell className="max-w-[44rem] whitespace-normal break-words font-mono text-xs">
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
    return <p className="text-sm text-muted-foreground">No records reported.</p>;
  }

  const keys = Array.from(new Set(records.flatMap((record) => Object.keys(record))));
  const sortedKeys = [primary, ...keys.filter((key) => key !== primary)];

  return (
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
  const normalized = value.toLowerCase();
  const className = cn(
    "border font-semibold",
    (normalized === "ok" || normalized === "running") &&
      "border-status-success/30 bg-status-success/10 text-status-success",
    normalized === "degraded" &&
      "border-status-warning/30 bg-status-warning/10 text-status-warning",
    (normalized === "unreachable" || normalized === "unavailable") &&
      "border-status-error/30 bg-status-error/10 text-status-error",
  );

  return (
    <Badge variant="outline" className={className}>
      {value}
    </Badge>
  );
}

function StatusSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={index}>
          <CardHeader>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function isStatusValue(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return ["ok", "degraded", "unreachable", "unavailable", "not_tracked", "running"].includes(value.toLowerCase());
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

function withoutKeys(data: Record<string, unknown>, keys: string[]) {
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
