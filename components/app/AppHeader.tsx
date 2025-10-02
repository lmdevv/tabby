import { useLiveQuery } from "dexie-react-hooks";
import { Columns2 } from "lucide-react";
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
import { useSetting, useUpdateSetting } from "@/hooks/use-settings";
import { db } from "@/lib/db";

interface AppHeaderProps {
  previewWorkspaceId: number | null;
  onOpenWorkspace: () => void;
}

export function AppHeader({
  previewWorkspaceId,
  onOpenWorkspace,
}: AppHeaderProps) {
  // Get settings directly in the component
  const { data: showResourcesData } = useSetting("showResources");
  const { updateSetting } = useUpdateSetting();

  const showResources = (showResourcesData ?? true) as boolean;
  const _toggleShowResources = () =>
    updateSetting("showResources", !showResources);

  // Get workspace data directly using Dexie
  const workspaceData = useLiveQuery(async () => {
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

    return {
      activeWorkspace,
      shownWorkspace,
      workspaceGroup,
      shownWorkspaceId,
    };
  }, [previewWorkspaceId]);
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
        <ModeToggle />
      </div>
    </header>
  );
}
