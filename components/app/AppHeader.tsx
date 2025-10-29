import { useLiveQuery } from "dexie-react-hooks";
import { Columns2, Keyboard, Search } from "lucide-react";
import { useState } from "react";
import { CommandMenu } from "@/components/command-menu/command-menu";
import { KeybindingsDialog } from "@/components/dialogs/keybindings-dialog";
import { ModeToggle } from "@/components/theme/mode-toggle";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAppState, useUpdateState } from "@/hooks/use-state";
import {
  type CachedWorkspaceData,
  workspaceCache,
} from "@/lib/db/cache-manager";
import { db } from "@/lib/db/db";

interface AppHeaderProps {
  previewWorkspaceId: number | null;
  onOpenWorkspace: () => void;
}

export function AppHeader({
  previewWorkspaceId,
  onOpenWorkspace,
}: AppHeaderProps) {
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [keybindingsDialogOpen, setKeybindingsDialogOpen] = useState(false);

  // Get settings directly in the component
  const { data: showResourcesData } = useAppState("showResources");
  const { updateState } = useUpdateState();

  const showResources = (showResourcesData ?? true) as boolean;
  const _toggleShowResources = () =>
    updateState("showResources", !showResources);

  // Get cached workspace data for instant warm reload
  const cachedWorkspaceData = workspaceCache.getCachedData();

  // Get workspace data directly using Dexie with cached default for instant loading
  const workspaceData = useLiveQuery(
    async () => {
      const activeWorkspace = await db.workspaces
        .where("active")
        .equals(1)
        .first();
      const shownWorkspaceId =
        previewWorkspaceId !== null ? previewWorkspaceId : activeWorkspace?.id;
      const shownWorkspace =
        shownWorkspaceId === -1
          ? undefined
          : shownWorkspaceId
            ? await db.workspaces.get(shownWorkspaceId)
            : undefined;

      const workspaceGroup = shownWorkspace?.groupId
        ? await db.workspaceGroups.get(shownWorkspace.groupId)
        : undefined;

      const result = {
        activeWorkspace,
        shownWorkspace,
        workspaceGroup,
        shownWorkspaceId,
      };

      // Update cache with fresh data for instant reloads
      workspaceCache.setCachedData(result as CachedWorkspaceData);

      return result;
    },
    [previewWorkspaceId],
    cachedWorkspaceData || undefined,
  );
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
      <div className="flex items-center gap-2 p-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        {workspaceData?.shownWorkspaceId === -1 ? (
          <span className="flex items-center gap-2 font-medium">
            Undefined Workspace
            {previewWorkspaceId !== null &&
              previewWorkspaceId !== workspaceData?.activeWorkspace?.id && (
                <Badge variant="outline">Preview</Badge>
              )}
          </span>
        ) : workspaceData?.shownWorkspace ? (
          <Breadcrumb>
            <BreadcrumbList>
              {workspaceData.workspaceGroup && (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbLink>
                      {workspaceData.workspaceGroup.name}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </>
              )}
              <BreadcrumbItem>
                <span className="flex items-center gap-2">
                  <BreadcrumbPage>
                    {workspaceData.shownWorkspace.name}
                  </BreadcrumbPage>
                  {previewWorkspaceId !== null &&
                    previewWorkspaceId !==
                      workspaceData.activeWorkspace?.id && (
                      <Badge variant="secondary">Preview</Badge>
                    )}
                </span>
              </BreadcrumbItem>
              {previewWorkspaceId !== null &&
                previewWorkspaceId !== workspaceData.activeWorkspace?.id &&
                previewWorkspaceId !== -1 && (
                  <BreadcrumbItem>
                    <Button size="sm" onClick={onOpenWorkspace}>
                      Open
                    </Button>
                  </BreadcrumbItem>
                )}
            </BreadcrumbList>
          </Breadcrumb>
        ) : (
          <span className="text-muted-foreground">No workspace selected</span>
        )}
      </div>
      <div className="flex items-center gap-2 p-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showResources ? "default" : "ghost"}
                size="icon"
                onClick={_toggleShowResources}
                className={showResources ? "" : "hover:bg-accent"}
              >
                <Columns2 className="h-[1.2rem] w-[1.2rem]" />
                <span className="sr-only">
                  {showResources ? "Hide Resources" : "Show Resources"}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {showResources
                  ? "Hide Resources Panel"
                  : "Show Resources Panel"}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCommandMenuOpen(true)}
              >
                <Search className="h-[1.2rem] w-[1.2rem]" />
                <span className="sr-only">Open Command Menu</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Open Command Menu</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setKeybindingsDialogOpen(true)}
              >
                <Keyboard className="h-[1.2rem] w-[1.2rem]" />
                <span className="sr-only">Show Keybindings</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Show Keybindings</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <ModeToggle />
      </div>
      <CommandMenu
        workspaceId={workspaceData?.activeWorkspace?.id ?? null}
        open={commandMenuOpen}
        onOpenChange={setCommandMenuOpen}
      />
      <KeybindingsDialog
        open={keybindingsDialogOpen}
        onOpenChange={setKeybindingsDialogOpen}
      />
    </header>
  );
}
