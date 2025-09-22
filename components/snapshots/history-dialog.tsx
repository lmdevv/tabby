import { useLiveQuery } from "dexie-react-hooks";
import { X } from "lucide-react";
import { useCallback, useState } from "react";
import { browser } from "wxt/browser";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { db } from "@/lib/db";
import type { SnapshotTab, WorkspaceSnapshot } from "@/lib/types";

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
    },
    [expandedId],
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
              const preview = previewDataMap?.get(s.id)?.preview ?? [];
              const when = new Date(s.createdAt).toLocaleString();
              return (
                <div
                  key={s.id}
                  className="flex flex-col gap-2 rounded border p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Button
                      variant="ghost"
                      className="min-w-0 text-left w-full justify-start p-0 h-auto"
                      onClick={() =>
                        setExpandedId((prev) => (prev === s.id ? null : s.id))
                      }
                      aria-expanded={expandedId === s.id}
                    >
                      <div className="font-medium truncate">
                        {when}
                        {previewDataMap?.get(s.id) ? (
                          <span className="text-muted-foreground font-normal">
                            {" "}
                            · {previewDataMap.get(s.id)?.tabCount} tabs,{" "}
                            {previewDataMap.get(s.id)?.windowCount} windows,{" "}
                            {previewDataMap.get(s.id)?.groupCount} groups
                          </span>
                        ) : null}
                      </div>
                      {expandedId !== s.id && preview.length > 0 && (
                        <div className="flex gap-2 mt-1 overflow-hidden">
                          {preview.map((t) => (
                            <div
                              key={`${t.snapshotId}:${t.url}:${t.index}`}
                              className="flex items-center gap-1 text-xs text-muted-foreground truncate max-w-[12rem]"
                            >
                              {t.favIconUrl && (
                                <img
                                  src={t.favIconUrl}
                                  alt=""
                                  className="size-4 rounded-sm"
                                />
                              )}
                              <span className="truncate">
                                {t.title || t.url}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </Button>
                    <div className="shrink-0 flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete snapshot"
                        title="Delete snapshot"
                        onClick={() => deleteSnapshot(s.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {expandedId === s.id && (
                    <div className="mt-1 border-t pt-2">
                      <div className="text-xs text-muted-foreground mb-1">
                        {expandedTabs?.length ?? 0} tabs
                      </div>
                      <div className="max-h-48 overflow-auto pr-1 scrollbar-none">
                        <ul className="space-y-1">
                          {(expandedTabs ?? []).map((t) => (
                            <li
                              key={`${t.id}`}
                              className="flex flex-col gap-1 text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {t.favIconUrl && (
                                  <img
                                    src={t.favIconUrl}
                                    alt=""
                                    className="size-3.5 rounded-sm"
                                  />
                                )}
                                <span className="truncate">
                                  {t.title || t.url}
                                </span>
                              </div>
                              {(t.tags?.length || t.description) && (
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                  {t.tags?.length ? (
                                    <div className="flex flex-wrap gap-1">
                                      {t.tags.map((tag) => (
                                        <span
                                          key={tag}
                                          className="rounded bg-muted px-1.5 py-0.5"
                                        >
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  ) : null}
                                  {t.description && (
                                    <span className="truncate">
                                      {t.description}
                                    </span>
                                  )}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            await browser.runtime.sendMessage({
                              type: "restoreSnapshot",
                              snapshotId: s.id,
                              mode: "append",
                            });
                            onOpenChange(false);
                          }}
                        >
                          Append
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={async () => {
                            await browser.runtime.sendMessage({
                              type: "restoreSnapshot",
                              snapshotId: s.id,
                              mode: "replace",
                            });
                            onOpenChange(false);
                          }}
                        >
                          Replace
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
        <div className="mt-3 flex items-center justify-end">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
