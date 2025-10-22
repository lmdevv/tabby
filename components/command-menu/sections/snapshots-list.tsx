"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { History } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { browser } from "wxt/browser";
import { SnapshotItem } from "@/components/snapshots/snapshot-item";
import {
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { db } from "@/lib/db/db";
import type { FooterProps } from "../types";

interface SnapshotsListProps {
  workspaceId: number | null;
  selectedValue: string;
  onClose: () => void;
  setFooterProps: (props: FooterProps) => void;
}

export function SnapshotsList({
  workspaceId,
  selectedValue,
  onClose,
  setFooterProps,
}: SnapshotsListProps) {
  // Fetch snapshots for the current workspace
  const snapshots = useLiveQuery(async () => {
    if (!workspaceId || workspaceId <= 0) return [];
    return db.workspaceSnapshots
      .where("workspaceId")
      .equals(workspaceId)
      .reverse()
      .sortBy("createdAt");
  }, [workspaceId]);

  // Get tab counts for snapshots
  const tabCounts = useLiveQuery(async () => {
    if (!snapshots?.length) return new Map<number, number>();
    const counts = await Promise.all(
      snapshots.map(async (s) => {
        const count = await db.snapshotTabs
          .where("snapshotId")
          .equals(s.id)
          .count();
        return [s.id, count] as const;
      }),
    );
    return new Map(counts);
  }, [snapshots?.map((s) => s.id).join(",")]);

  const handleRestoreSnapshot = async (snapshotId: number) => {
    try {
      const result = await browser.runtime.sendMessage({
        type: "restoreSnapshot",
        snapshotId,
        mode: "replace",
      });
      if (result?.success) {
        toast.success("Snapshot restored successfully");
      } else {
        toast.error(result?.error || "Failed to restore snapshot");
      }
    } catch (_error) {
      toast.error("Failed to restore snapshot");
    }
    onClose();
  };

  // Update footer when selection changes
  React.useEffect(() => {
    const selectedSnapshot = snapshots?.find(
      (s) => `snapshot ${s.id}` === selectedValue,
    );
    if (selectedSnapshot) {
      const date = new Date(selectedSnapshot.createdAt).toLocaleDateString(
        "en-US",
        {
          weekday: "short",
          month: "long",
          day: "numeric",
          year: "numeric",
        },
      );
      const time = new Date(selectedSnapshot.createdAt).toLocaleTimeString(
        "en-US",
        {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        },
      );
      setFooterProps({
        enterText: `Restore snapshot from ${date} at ${time}`,
        shortcuts: [
          { key: "⌃H", action: "Back" },
          { key: "⌃←", action: "Back" },
        ],
      });
    } else {
      setFooterProps({
        enterText: "Select snapshot to restore",
        shortcuts: [
          { key: "⌃H", action: "Back" },
          { key: "⌃←", action: "Back" },
        ],
      });
    }
  }, [selectedValue, snapshots, setFooterProps]);

  return (
    <>
      {/* Avoid flashing "No results" while the query is initializing */}
      {snapshots !== undefined && (
        <CommandEmpty>No results found.</CommandEmpty>
      )}

      <CommandGroup>
        {snapshots?.map((snapshot) => {
          const tabCount = tabCounts?.get(snapshot.id) ?? 0;

          return (
            <CommandItem
              key={snapshot.id}
              value={`snapshot ${snapshot.id}`}
              onSelect={() => handleRestoreSnapshot(snapshot.id)}
            >
              <History className="mr-2 h-4 w-4" />
              <SnapshotItem snapshot={snapshot} tabCount={tabCount} />
            </CommandItem>
          );
        })}
        {snapshots && snapshots.length === 0 && (
          <div className="text-sm text-muted-foreground p-2">
            No snapshots available
          </div>
        )}
      </CommandGroup>
    </>
  );
}
