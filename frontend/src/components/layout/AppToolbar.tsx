import { useEffect, useMemo, useRef, useState } from "react";
import { useEphemeralStore } from "../../stores/ephemeralStore";
import { useSessionStore, type DiagramView } from "../../stores/sessionStore";
import { usePreferencesStore } from "../../stores/preferencesStore";
import { useCompile, useExecute } from "../../hooks/useExecute";
import { useGenerate } from "../../hooks/useGenerate";
import { useExamples } from "../../hooks/useExamples";
import type { ExampleSetId } from "../../api/types";
import {
  GENERATE_ONLY_TARGET_GROUPS,
  getGenerateTarget,
} from "../../generation/targets";
import { AiConfigForm } from "@/components/sidebar/AiConfigForm";
import { useTaskStore } from "../../stores/taskStore";
import {
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Code,
  GitFork,
  Hammer,
  Loader2,
  Play,
  Plus,
  Search,
  Shield,
  Sparkles,
} from "lucide-react";
import { Combobox, type ComboboxGroup } from "@/components/ui/combobox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Tip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { VIEW_MODE_GROUPS } from "../../constants/diagram";

const shellBtn =
  "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink";
const toolbarBtn =
  "flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer";
const iconBtn =
  "inline-flex size-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink";

export function AppToolbar() {
  const { compile } = useCompile();
  const { execute } = useExecute();
  const openCommandPalette = useEphemeralStore((s) => s.openCommandPalette);
  const compiling = useEphemeralStore((s) => s.compiling);
  const generatingCode = useEphemeralStore((s) => s.generatingCode);
  const executing = useEphemeralStore((s) => s.executing);
  const errorCount = useEphemeralStore((s) => s.outputErrorCount);
  const autoCompile = usePreferencesStore((s) => s.autoCompile);
  const viewMode = useSessionStore((s) => s.viewMode);
  const setViewMode = useSessionStore((s) => s.setViewMode);
  const generateTargetId = useSessionStore((s) => s.generateTargetId);
  const selectedExampleId = useSessionStore((s) => s.selectedExampleId);
  const selectedExampleSetId = useSessionStore((s) => s.selectedExampleSetId);
  const handleGenerate = useGenerate();
  const {
    sets: exampleSets,
    loadExample,
    loadBlank,
    loading: loadingExamples,
  } = useExamples();
  const selectedGenerateTarget = getGenerateTarget(generateTargetId);
  const canExecuteGenerateTarget = Boolean(selectedGenerateTarget?.executable);
  const [activeExampleSetId, setActiveExampleSetId] =
    useState<ExampleSetId | null>(null);

  const viewModeGroups = useMemo<ComboboxGroup[]>(
    () =>
      VIEW_MODE_GROUPS.map((group) => ({
        label: group.label,
        options: group.modes.map((mode) => ({
          value: mode.value,
          label: mode.longLabel ?? mode.label,
          triggerLabel: mode.label,
          testId: `diagram-view-${mode.value}`,
          keywords: [mode.label, mode.longLabel, group.label].filter(
            Boolean,
          ) as string[],
        })),
      })),
    [],
  );

  const exampleSetOptions = useMemo(
    () =>
      exampleSets.map((set) => ({
        value: set.id,
        label: set.label,
        keywords: [set.label],
      })),
    [exampleSets],
  );

  const activeExampleSet = useMemo(
    () =>
      exampleSets.find((set) => set.id === activeExampleSetId) ??
      exampleSets[0] ??
      null,
    [exampleSets, activeExampleSetId],
  );

  const exampleOptions = useMemo(
    () => [
      {
        value: "blank",
        label: "Select Example",
        keywords: ["select example", "blank", "empty", "new model"],
      },
      ...(activeExampleSet?.examples.map((example) => ({
        value: example.id,
        label: example.label || example.name,
        keywords: [example.name, example.label, activeExampleSet.label].filter(
          Boolean,
        ) as string[],
      })) ?? []),
    ],
    [activeExampleSet],
  );

  const generateGroups = useMemo<ComboboxGroup[]>(
    () =>
      GENERATE_ONLY_TARGET_GROUPS.map((group) => ({
        label: group.label,
        options: group.targets.map((target) => ({
          value: target.id,
          label: target.label,
          keywords: [target.id, group.label],
        })),
      })),
    [],
  );

  // Compile success micro-interaction
  const prevCompilingRef = useRef(compiling);
  const [justCompiled, setJustCompiled] = useState(false);

  useEffect(() => {
    const didJustCompile =
      prevCompilingRef.current && !compiling && errorCount === 0;
    prevCompilingRef.current = compiling;

    if (didJustCompile) {
      setJustCompiled(true);
      const timer = setTimeout(() => setJustCompiled(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [compiling, errorCount]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        compile();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [compile]);

  useEffect(() => {
    if (selectedExampleSetId) {
      setActiveExampleSetId(selectedExampleSetId);
    }
  }, [selectedExampleSetId]);

  useEffect(() => {
    if (!activeExampleSetId && exampleSets.length > 0) {
      setActiveExampleSetId(exampleSets[0].id);
    }
  }, [activeExampleSetId, exampleSets]);

  return (
    <div
      className="relative flex items-center justify-between gap-3 h-[var(--toolbar-h)] px-3 shrink-0 border-b border-border/70 bg-surface-1/95 backdrop-blur-sm"
      data-testid="app-toolbar"
    >
      <div className="flex items-center gap-2 shrink-0">
        <Tip
          side="bottom"
          content={
            <div className="space-y-1">
              <p className="font-medium">UmpleOnline v2 is experimental.</p>
              <p>
                Use{" "}
                <a
                  href="https://try.umple.org"
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand hover:text-brand-hover"
                >
                  try.umple.org
                </a>{" "}
                for production work.
              </p>
            </div>
          }
        >
          <a
            href="https://umple.org"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-ink transition-colors hover:bg-surface-2"
            aria-label="Open the Umple website"
          >
            <img src="/umple-logo.svg" alt="" className="h-5 w-auto shrink-0" />
            <span className="text-sm font-semibold tracking-tight whitespace-nowrap">
              UmpleOnline (v2)
            </span>
          </a>
        </Tip>

        <Tip content="Open the user manual" side="bottom">
          <a
            href="https://manual.umple.org"
            target="_blank"
            rel="noreferrer"
            className={shellBtn}
          >
            <BookOpen className="size-3.5" />
            Manual
          </a>
        </Tip>
      </div>

      <div className="flex flex-1 min-w-0 justify-center">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex items-center gap-1" data-tour="examples">
            <Combobox
              options={exampleSetOptions}
              value={activeExampleSet?.id}
              onSelect={(selection) =>
                setActiveExampleSetId(selection as ExampleSetId)
              }
              placeholder="Example Set"
              searchPlaceholder="Search example sets..."
              emptyText={
                loadingExamples ? "Loading example sets..." : "No example sets."
              }
              disabled={loadingExamples && exampleSetOptions.length === 0}
              className={cn(
                toolbarBtn,
                "w-auto h-8 border border-border/70 bg-surface-0 px-2.5 py-1 shadow-sm focus:border-border-strong focus:ring-0",
              )}
              contentClassName="w-64 min-w-[16rem]"
              listClassName="max-h-72"
              ariaLabel="Example Set"
            />
            <Combobox
              options={exampleOptions}
              value={
                selectedExampleId === "blank"
                  ? "blank"
                  : (selectedExampleId ?? undefined)
              }
              onSelect={(selection) => {
                if (!activeExampleSet) return;
                if (selection === "blank") {
                  loadBlank(activeExampleSet.id, activeExampleSet.categoryId, {
                    switchToDefaultView: true,
                  });
                  return;
                }
                void loadExample(selection, { switchToDefaultView: true });
              }}
              placeholder="Select Example"
              searchPlaceholder="Search examples..."
              emptyText={
                loadingExamples ? "Loading examples..." : "No examples."
              }
              disabled={
                !activeExampleSet ||
                (loadingExamples && exampleOptions.length <= 1)
              }
              className={cn(
                toolbarBtn,
                "w-auto h-8 border border-border/70 bg-surface-0 px-2.5 py-1 shadow-sm focus:border-border-strong focus:ring-0",
              )}
              contentClassName="w-64 min-w-[16rem]"
              listClassName="max-h-72"
              ariaLabel="Examples"
            />
          </div>

          <DropdownMenu>
            <Tip content="Tasks" side="bottom">
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    shellBtn,
                    "border border-border/70 bg-surface-0 shadow-sm",
                  )}
                  aria-label="Tasks"
                >
                  <ClipboardList className="size-3.5" />
                  Tasks
                  <ChevronDown className="size-3 shrink-0" />
                </button>
              </DropdownMenuTrigger>
            </Tip>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onSelect={() => useTaskStore.getState().openSheet("create")}
              >
                <Plus className="size-3.5" />
                Create Task
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => useTaskStore.getState().openSheet("manage")}
              >
                <Search className="size-3.5" />
                Manage Task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {!autoCompile && (
            <Tip content="Compile (Ctrl+Enter)" side="bottom">
              <button
                onClick={compile}
                disabled={compiling}
                aria-label={compiling ? "Compiling" : "Compile (Ctrl+Enter)"}
                data-testid="compile-button"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/70 bg-surface-0 px-2.5 text-xs font-medium text-ink-muted shadow-sm transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-70"
              >
                {compiling ? (
                  <Loader2 className="size-3.5 shrink-0 animate-spin" />
                ) : justCompiled ? (
                  <Check className="size-3.5 shrink-0 text-status-success animate-fade-in" />
                ) : (
                  <Hammer className="size-3.5 shrink-0" />
                )}
                <span className="truncate">
                  {compiling ? (
                    "Compiling..."
                  ) : justCompiled ? (
                    <span className="text-status-success animate-fade-in">
                      Compiled
                    </span>
                  ) : (
                    "Compile"
                  )}
                </span>
              </button>
            </Tip>
          )}

          <Combobox
            groups={viewModeGroups}
            value={viewMode}
            onSelect={(value) => setViewMode(value as DiagramView)}
            searchPlaceholder="Search views..."
            className="w-auto h-8 border border-border/70 bg-surface-0 px-2.5 py-1 font-medium text-ink-muted shadow-sm hover:text-ink hover:bg-surface-2 focus:border-border-strong focus:ring-0"
            contentClassName="w-64 min-w-[16rem]"
            listClassName="max-h-80"
            ariaLabel="Diagram view"
            data-tour="diagram-view"
          />

          <div data-tour="generate">
            <Combobox
              groups={generateGroups}
              value={generateTargetId}
              onSelect={(targetId) => {
                void handleGenerate(targetId);
              }}
              placeholder="Generate"
              searchPlaceholder="Search targets..."
              disabled={generatingCode}
              className="w-auto h-8 border border-border/70 bg-surface-0 px-2.5 py-1 font-medium text-ink-muted shadow-sm hover:text-ink hover:bg-surface-2 focus:border-border-strong focus:ring-0"
              contentClassName="w-72 min-w-[18rem]"
              listClassName="max-h-80"
              triggerChildren={
                <>
                  {generatingCode ? (
                    <Loader2 className="size-3.5 shrink-0 animate-spin" />
                  ) : (
                    <Code className="size-3.5 shrink-0" />
                  )}
                  <span className="truncate">
                    {generatingCode ? "Generating..." : "Generate"}
                  </span>
                  <ChevronDown className="size-3 shrink-0" />
                </>
              }
              ariaLabel="Generate"
            />
          </div>

          <Tip
            content={
              canExecuteGenerateTarget
                ? `Execute ${selectedGenerateTarget?.label ?? generateTargetId}`
                : "Execution is only supported for Java and Python"
            }
            side="bottom"
          >
            <button
              onClick={() => void execute(generateTargetId)}
              disabled={executing || !canExecuteGenerateTarget}
              aria-label={
                executing
                  ? "Executing"
                  : `Execute ${selectedGenerateTarget?.label ?? generateTargetId}`
              }
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/70 bg-surface-0 px-2.5 text-xs font-medium text-ink-muted shadow-sm transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-70"
            >
              {executing ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin" />
              ) : (
                <Play className="size-3.5 shrink-0" />
              )}
              <span className="truncate">
                {executing ? "Executing..." : "Execute"}
              </span>
            </button>
          </Tip>

          <Popover>
            <Tip content="Umple AI" side="bottom">
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    shellBtn,
                    "border border-border/70 bg-surface-0 shadow-sm",
                  )}
                  aria-label="Umple AI configuration"
                >
                  <Sparkles className="size-3.5" />
                  AI
                </button>
              </PopoverTrigger>
            </Tip>
            <PopoverContent align="end" className="w-72">
              <p className="text-xs font-medium mb-2">Umple AI</p>
              <AiConfigForm />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Tip content="Search commands and examples (Ctrl+K)" side="bottom">
          <button
            onClick={openCommandPalette}
            className={iconBtn}
            aria-label="Open command palette"
          >
            <Search className="size-4" />
          </button>
        </Tip>

        <TopLinkIconButton
          href="https://umple.org/privacy"
          label="Privacy and security"
          icon={Shield}
        />
        <TopLinkIconButton
          href="https://github.com/umple/umpleonline"
          label="GitHub repository"
          icon={GitFork}
        />
        <TopLinkIconButton
          href="https://umple.org/questions"
          label="Ask a question"
          icon={CircleHelp}
        />
      </div>

      {(compiling || generatingCode || executing) && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden">
          <div className="h-full w-1/4 bg-brand animate-progress-indeterminate" />
        </div>
      )}
    </div>
  );
}

function TopLinkIconButton({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Tip content={label} side="bottom">
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={iconBtn}
        aria-label={label}
      >
        <Icon className="size-4" />
      </a>
    </Tip>
  );
}
