import { getRelativeTime } from "@/lib/helpers/utils";
import type { WorkspaceSnapshot } from "@/lib/types/types";

interface SnapshotItemProps {
  snapshot: WorkspaceSnapshot;
  tabCount?: number;
  className?: string;
}

export function SnapshotItem({
  snapshot,
  tabCount,
  className,
}: SnapshotItemProps) {
  const date = new Date(snapshot.createdAt).toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const time = new Date(snapshot.createdAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const relativeTime = getRelativeTime(snapshot.createdAt);

  return (
    <div className={className}>
      <div className="font-medium text-sm">{`${date} at ${time}`}</div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{relativeTime}</span>
        {tabCount !== undefined && (
          <>
            <span>•</span>
            <span>{tabCount} tabs</span>
          </>
        )}
        <span>•</span>
        <span>{snapshot.reason === "manual" ? "Manual" : "Auto"} snapshot</span>
      </div>
    </div>
  );
}
