import type React from "react";
import { Badge } from "@/components/ui/badge";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  type CardData,
  formatDisplayUrl,
  getDomainInitial,
  truncateText,
} from "@/lib/card-helpers";

interface TabCardProps {
  data: CardData;
  showUrl?: boolean;
  showTags?: boolean;
  maxTitleLength?: number;
  maxUrlLength?: number;
  onClick: () => void;
  ariaLabel: string;
  className?: string;
  style?: React.CSSProperties; // For custom styling like tab group colors
  beforeFavicon?: React.ReactNode; // For checkbox, etc.
  afterTitle?: React.ReactNode; // For active indicator, etc.
  afterInfo?: React.ReactNode; // For description, status indicators, etc.
  renderActions?: () => React.ReactNode;
  renderContextMenu?: () => React.ReactNode;
}

const DEFAULT_MAX_TITLE_CHARS = 90;
const DEFAULT_MAX_URL_CHARS = 80;

export function TabCard({
  data,
  showUrl = true,
  showTags = true,
  maxTitleLength = DEFAULT_MAX_TITLE_CHARS,
  maxUrlLength = DEFAULT_MAX_URL_CHARS,
  onClick,
  ariaLabel,
  className = "",
  style,
  beforeFavicon,
  afterTitle,
  afterInfo,
  renderActions,
  renderContextMenu,
}: TabCardProps) {
  const { title, url, favIconUrl, tags } = data;

  // Format and truncate display values
  const displayTitle = title || "Untitled";
  const displayUrl = formatDisplayUrl(url);
  const displayTitleTruncated = truncateText(displayTitle, maxTitleLength);
  const displayUrlTruncated = truncateText(displayUrl, maxUrlLength);
  const domainInitial = getDomainInitial(url);

  const content = (
    <div
      role="button"
      tabIndex={0}
      className={`flex h-auto w-full items-center justify-start rounded-lg border border-transparent p-2 text-left transition-all duration-200 hover:border-accent hover:bg-accent/50 hover:shadow-sm group relative cursor-pointer select-none gap-3 ${className}`}
      style={style}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={ariaLabel}
    >
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
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3
                className="truncate font-medium text-sm leading-tight"
                title={displayTitle}
              >
                {displayTitleTruncated}
              </h3>
              {/* Custom content after title (e.g., active indicator) */}
              {afterTitle}
            </div>
            {showUrl && (
              <p
                className="mt-1 truncate text-muted-foreground text-xs"
                title={url}
              >
                {displayUrlTruncated}
              </p>
            )}
            {/* Custom content after info (e.g., description, status indicators) */}
            {afterInfo}
          </div>

          {/* Tags */}
          {showTags && tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-1 sm:justify-end">
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
    </div>
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
