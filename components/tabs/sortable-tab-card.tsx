import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type React from "react";
import { TabCard } from "./tab-card";

interface SortableTabCardProps {
  id: string;
  data: Parameters<typeof TabCard>[0]["data"];
  onClick: () => void;
  ariaLabel: string;
  className?: string;
  style?: React.CSSProperties;
  beforeFavicon?: React.ReactNode;
  afterTitle?: React.ReactNode;
  afterInfo?: React.ReactNode;
  renderActions?: () => React.ReactNode;
  renderContextMenu?: () => React.ReactNode;
  isInteractive?: boolean;
}

export function SortableTabCard({
  id,
  data,
  onClick,
  ariaLabel,
  className,
  style,
  beforeFavicon,
  afterTitle,
  afterInfo,
  renderActions,
  renderContextMenu,
  isInteractive,
}: SortableTabCardProps) {
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
    ...style,
  };

  return (
    <div
      ref={setNodeRef}
      className={className}
      style={sortableStyle}
      {...attributes}
      {...listeners}
    >
      <TabCard
        data={data}
        onClick={onClick}
        ariaLabel={ariaLabel}
        beforeFavicon={beforeFavicon}
        afterTitle={afterTitle}
        afterInfo={afterInfo}
        renderActions={renderActions}
        renderContextMenu={renderContextMenu}
        isInteractive={isInteractive}
      />
    </div>
  );
}
