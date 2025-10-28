import { useLiveQuery } from "dexie-react-hooks";
import { Info, X } from "lucide-react";
import { useCallback, useState } from "react";
import { browser } from "wxt/browser";

import { SnapshotItem } from "@/components/snapshots/snapshot-item";
import { TabCard } from "@/components/tabs/tab-card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ContextMenuItem } from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { db } from "@/lib/db/db";
import { getDisplayTitleFromUrl } from "@/lib/helpers/utils";
import type { SnapshotTab, WorkspaceSnapshot } from "@/lib/types/types";

export function HistoryDialog({
  open,
  onOpenChange,
  workspaceId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  workspaceId: number;
}) {
  const snapshots = useLiveQuery(async () => {
    if (!workspaceId || workspaceId <= 0) return [] as WorkspaceSnapshot[];
    return db.workspaceSnapshots
      .where("workspaceId")
      .equals(workspaceId)
      .reverse()
      .sortBy("createdAt");
  }, [workspaceId]);

  const previewDataMap = useLiveQuery(async () => {
    if (!snapshots?.length)
      return new Map<
        number,
        {
          preview: SnapshotTab[];
          tabCount: number;
          windowCount: number;
          groupCount: number;
        }
      >();

    const entries = await Promise.all(
      snapshots.slice(0, 50).map(async (s) => {
        const [tabs, groups] = await Promise.all([
          db.snapshotTabs.where("snapshotId").equals(s.id).toArray(),
          db.snapshotTabGroups.where("snapshotId").equals(s.id).toArray(),
        ]);
        const preview = tabs
          .slice()
          .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
          .slice(0, 6);
        const windowCount = new Set(tabs.map((t) => t.windowIndex)).size;
        return [
          s.id,
          {
            preview,
            tabCount: tabs.length,
            windowCount,
            groupCount: groups.length,
          },
        ] as const;
      }),
    );

    return new Map(entries);
  }, [snapshots?.map((s) => s.id).join(",")]);

  // Expanded snapshot state
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Selected snapshot state
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Load full tabs for the expanded snapshot
  const expandedTabs = useLiveQuery(async () => {
    if (expandedId == null) return [] as SnapshotTab[];
    const tabs = await db.snapshotTabs
      .where("snapshotId")
      .equals(expandedId)
      .toArray();
    return tabs.slice().sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  }, [expandedId]);

  const deleteSnapshot = useCallback(
    async (snapshotId: number) => {
      await browser.runtime.sendMessage({
        type: "deleteSnapshot",
        snapshotId,
      });
      if (expandedId === snapshotId) setExpandedId(null);
      if (selectedId === snapshotId) setSelectedId(null);
    },
    [expandedId, selectedId],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle>Snapshot History</DialogTitle>
          </div>
          <DialogDescription>
            Restore a previous state of this workspace.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-auto pr-1 pt-1 scrollbar-none">
          {(snapshots?.length ?? 0) === 0 ? (
            <div className="text-sm text-muted-foreground">
              No snapshots yet.
            </div>
          ) : (
            (snapshots ?? []).map((s) => {
              const isSelected = selectedId === s.id;
              const isExpanded = expandedId === s.id;
              const tabCount = previewDataMap?.get(s.id)?.tabCount;
              const date = new Date(s.createdAt).toLocaleDateString("en-US", {
                weekday: "short",
                month: "long",
                day: "numeric",
                year: "numeric",
              });
              const time = new Date(s.createdAt).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              });

              return (
                // biome-ignore lint/a11y/useSemanticElements: Need div due to nested interactive elements
                <div
                  key={s.id}
                  className={`rounded-lg border p-4 cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? "ring-2 ring-primary border-primary bg-primary/5"
                      : "border-border hover:bg-accent/50"
                  }`}
                  onClick={() => setSelectedId(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedId(s.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={`Select snapshot from ${date} at ${time}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <SnapshotItem snapshot={s} tabCount={tabCount} />
                    </div>
                    <div className="shrink-0 flex items-center gap-1">
                      <Collapsible
                        open={isExpanded}
                        onOpenChange={(open) =>
                          setExpandedId(open ? s.id : null)
                        }
                      >
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedId(isExpanded ? null : s.id);
                            }}
                            aria-label="Toggle snapshot details"
                          >
                            <Info className="h-4 w-4" />
                          </Button>
                        </CollapsibleTrigger>
                      </Collapsible>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete snapshot"
                        title="Delete snapshot"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSnapshot(s.id);
                        }}
                        className="h-8 w-8"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <Collapsible open={isExpanded} onOpenChange={() => {}}>
                    <CollapsibleContent className="mt-3">
                      <div className="max-h-48 overflow-auto pr-1 scrollbar-none space-y-1">
                        {(expandedTabs ?? []).map((t) => {
                          const displayTitle = getDisplayTitleFromUrl(t.url);
                          const cardData = {
                            title: displayTitle,
                            url: t.url,
                            favIconUrl: t.favIconUrl,
                            tags: t.tags,
                          };

                          return (
                            <TabCard
                              key={t.id}
                              data={cardData}
                              onClick={() => {}}
                              ariaLabel={`Tab: ${displayTitle}`}
                              isInteractive={false}
                              renderContextMenu={() => (
                                <ContextMenuItem
                                  onClick={async () => {
                                    if (t.url) {
                                      await browser.runtime.sendMessage({
                                        type: "openResourcesAsTabs",
                                        urls: [t.url],
                                      });
                                    }
                                  }}
                                >
                                  Open tab in current workspace
                                </ContextMenuItem>
                              )}
                            />
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              );
            })
          )}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await browser.runtime.sendMessage({
                type: "createSnapshot",
                workspaceId,
                reason: "manual",
              });
            }}
          >
            Take Snapshot
          </Button>
          <Button
            size="sm"
            variant="default"
            disabled={selectedId === null}
            onClick={async () => {
              if (selectedId !== null) {
                await browser.runtime.sendMessage({
                  type: "restoreSnapshot",
                  snapshotId: selectedId,
                  mode: "replace",
                });
                onOpenChange(false);
              }
            }}
          >
            Restore Snapshot
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
