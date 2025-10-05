import { useLiveQuery } from "dexie-react-hooks";
import { TabCard } from "@/components/tabs/tab-card";
import {
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { DeleteAction } from "@/components/ui/delete-action";
import { db } from "@/lib/db";
import { normalizeUrl } from "@/lib/resource-helpers";

interface ResourceCardProps {
  resourceId: number;
  onClick: () => void;
  onDelete?: (id: number) => void;
}

export function ResourceCard({
  resourceId,
  onClick,
  onDelete = () => {},
}: ResourceCardProps) {
  // Fetch resource data directly from database
  const resource = useLiveQuery(
    () => db.resources.get(resourceId),
    [resourceId],
  );

  // Fetch active tabs to determine if this resource is currently active
  const activeTabs = useLiveQuery(
    () => db.activeTabs.where("tabStatus").equals("active").toArray(),
    [],
  );

  // Don't render if resource data hasn't loaded yet
  if (!resource) {
    return null;
  }

  const { title, url, favIconUrl, tags, description } = resource;

  // Check if this resource is currently active
  const isActive =
    activeTabs?.some((activeTab) => {
      if (!activeTab.url || !resource.url) return false;
      return normalizeUrl(activeTab.url) === normalizeUrl(resource.url);
    }) || false;

  const cardData = {
    title,
    url,
    favIconUrl,
    tags,
  };

  const ariaLabel = `Open resource "${title || "Untitled"}" ${isActive ? "(currently active)" : ""} ${url ? `from ${url}` : ""}`;

  return (
    <TabCard
      data={cardData}
      onClick={onClick}
      ariaLabel={ariaLabel}
      isInteractive={true}
      afterTitle={
        isActive ? (
          <span
            className="h-2 w-2 rounded-full bg-primary flex-shrink-0 block"
            title="Currently active"
            aria-hidden="true"
          />
        ) : undefined
      }
      afterInfo={
        description ? (
          <p
            className="mt-1 truncate text-muted-foreground text-xs"
            title={description}
          >
            {description.length > 80
              ? `${description.slice(0, 80)}…`
              : description}
          </p>
        ) : undefined
      }
      renderActions={() => (
        <DeleteAction
          onDelete={() => onDelete(resource.id)}
          tooltip="Delete resource"
        />
      )}
      renderContextMenu={() => (
        <>
          <ContextMenuItem onClick={() => window.open(url, "_blank")}>
            Open in New Tab
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onDelete(resource.id)}>
            Delete Resource
          </ContextMenuItem>
        </>
      )}
    />
  );
}
