import type React from "react";
import { Badge } from "@/components/ui/badge";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useAppState } from "@/hooks/use-state";
import {
  type CardData,
  formatDisplayUrl,
  getDomainInitial,
  truncateText,
} from "@/lib/helpers/card-helpers";

interface TabCardProps {
  data: CardData;
  onClick: () => void;
  ariaLabel: string;
  className?: string;
  style?: React.CSSProperties; // For custom styling like tab group colors
  handle?: React.ReactNode; // Drag handle
  beforeFavicon?: React.ReactNode; // For checkbox, etc.
  afterTitle?: React.ReactNode; // For active indicator, etc.
  afterInfo?: React.ReactNode; // For description, status indicators, etc.
  renderActions?: () => React.ReactNode;
  renderContextMenu?: () => React.ReactNode;
  isInteractive?: boolean; // Whether the card contains interactive elements that would conflict with button wrapper
  isFocused?: boolean; // Whether this tab is currently focused for keyboard navigation
  isInClipboard?: boolean; // Whether this tab is currently cut/copied for moving
}

export function TabCard({
  data,
  onClick,
  ariaLabel,
  style,
  handle,
  beforeFavicon,
  afterTitle,
  afterInfo,
  renderActions,
  renderContextMenu,
  isInteractive = false,
  isFocused = false,
  isInClipboard = false,
}: TabCardProps) {
  // Fetch global state for display preferences
  const { data: showTagsGlobal } = useAppState("showTags");
  const { data: showUrlGlobal } = useAppState("showUrls");

  const showTags = showTagsGlobal ?? true;
  const showUrl = showUrlGlobal ?? true;

  const { title, url, favIconUrl, tags } = data;

  // Format display values (no truncation - let CSS handle it)
  const rawTitle = title || "Untitled";
  const displayTitle = truncateText(rawTitle, 140);
  const displayUrl = truncateText(formatDisplayUrl(url), 120);
  const domainInitial = getDomainInitial(url);

  const baseClasses = `flex h-auto w-full min-w-0 max-w-full items-center justify-start rounded-lg border p-2 text-left transition-all duration-200 hover:border-accent hover:bg-accent/50 hover:shadow-sm group relative cursor-pointer select-none gap-1 sm:gap-3 overflow-hidden ${
    isInClipboard
      ? "border-destructive bg-destructive/10 shadow-md ring-2 ring-destructive/20 opacity-60"
      : isFocused
        ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/20"
        : "border-transparent"
  }`;

  const innerContent = (
    <>
      {/* Drag handle */}
      {handle}

      {/* Custom content before favicon (e.g., checkbox) */}
      {beforeFavicon}

      {/* Favicon */}
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted shadow-sm">
        {favIconUrl ? (
          <img
            src={favIconUrl}
            alt=""
            className="h-full w-full object-contain"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
              const nextSibling = target.nextElementSibling as HTMLElement;
              if (nextSibling) {
                nextSibling.style.display = "flex";
              }
            }}
          />
        ) : null}
        <div
          className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/10 font-semibold text-primary text-sm ${favIconUrl ? "hidden" : ""}`}
        >
          {domainInitial}
        </div>
      </div>

      {/* Card info */}
      <div className="min-w-0 flex-1 max-w-full w-0">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-2 min-w-0 w-full">
          <div className="min-w-0 basis-0 flex-1 w-0">
            <div className="flex items-center gap-2 min-w-0 overflow-hidden w-full">
              <h3
                className="truncate font-medium text-xs leading-tight min-w-0"
                title={displayTitle}
              >
                {displayTitle}
              </h3>
              {/* Custom content after title (e.g., active indicator) */}
              {afterTitle}
            </div>
            {showUrl && (
              <p
                className="mt-1 truncate text-muted-foreground text-xs min-w-0"
                title={url}
              >
                {displayUrl}
              </p>
            )}
            {/* Custom content after info (e.g., description, status indicators) */}
            {afterInfo}
          </div>

          {/* Tags */}
          {showTags && tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-1 sm:justify-end flex-shrink-0">
              {tags.slice(0, 2).map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="h-5 px-1.5 py-0.5 text-xs"
                >
                  {tag}
                </Badge>
              ))}
              {tags.length > 2 && (
                <Badge
                  variant="secondary"
                  className="h-5 px-1.5 py-0.5 text-xs"
                >
                  +{tags.length - 2}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {renderActions && (
        <div className="ml-auto flex flex-shrink-0 items-center gap-1">
          {renderActions()}
        </div>
      )}
    </>
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  const content = isInteractive ? (
    // Use div when nested interactive elements are present
    // biome-ignore lint/a11y/useSemanticElements: Need div due to nested button constraints
    <div
      className={baseClasses}
      style={style}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      {innerContent}
    </div>
  ) : (
    <button
      type="button"
      className={baseClasses}
      style={style}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      aria-label={ariaLabel}
    >
      {innerContent}
    </button>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{content}</ContextMenuTrigger>
      {renderContextMenu && (
        <ContextMenuContent>{renderContextMenu()}</ContextMenuContent>
      )}
    </ContextMenu>
  );
}
