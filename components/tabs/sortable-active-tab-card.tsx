import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { Tab } from "@/lib/types/types";
import { ActiveTabCard } from "./active-tab-card";

interface SortableActiveTabCardProps {
  id: string;
  tabId: number;
  groupId?: number;
  onClick: () => void;
  onDelete?: (id: number) => void;
  onPin?: (id: number, pinned: boolean) => void;
  onAddToResourceGroup?: (tab: Tab, groupId: number) => void;
  handle?: React.ReactNode;
  isFocused?: boolean;
  isInClipboard?: boolean;
}

export function SortableActiveTabCard({
  id,
  tabId,
  groupId,
  onClick,
  onDelete,
  onPin,
  onAddToResourceGroup,
  handle,
  isFocused,
  isInClipboard,
}: SortableActiveTabCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const defaultHandle = (
    <div
      {...attributes}
      {...listeners}
      className="text-muted-foreground hover:text-foreground"
    >
      <GripVertical className="h-4 w-4" />
    </div>
  );

  return (
    <div ref={setNodeRef} style={sortableStyle}>
      <ActiveTabCard
        tabId={tabId}
        groupId={groupId}
        onClick={onClick}
        onDelete={onDelete}
        onPin={onPin}
        onAddToResourceGroup={onAddToResourceGroup}
        handle={handle || defaultHandle}
        isFocused={isFocused}
        isInClipboard={isInClipboard}
      />
    </div>
  );
}
