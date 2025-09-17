import { AppSidebar } from "@/components/sidebar/app-sidebar";
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
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useCallback, useMemo, useState } from "react";

import { db } from "@/entrypoints/background/db";
import type { Tab } from "@/lib/types";
import { useLiveQuery } from "dexie-react-hooks";
import { browser } from "wxt/browser";

export default function App() {
  const [previewWorkspaceId, setPreviewWorkspaceId] = useState<number | null>(
    null,
  );

  // Combine workspace queries to reduce re-renders
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

  // Memoize the shown workspace ID to prevent unnecessary re-renders
  const shownWorkspaceId = useMemo(
    () =>
      previewWorkspaceId !== null
        ? previewWorkspaceId
        : workspaceData?.activeWorkspace?.id,
    [previewWorkspaceId, workspaceData?.activeWorkspace?.id],
  );

  // Optimize tabs query to only fetch when needed
  const shownTabs = useLiveQuery(() => {
    if (!shownWorkspaceId) return [];
    return db.activeTabs
      .where("workspaceId")
      .equals(shownWorkspaceId)
      .toArray();
  }, [shownWorkspaceId]);

  const handleRefresh = useCallback((): void => {
    browser.runtime.sendMessage({ type: "refreshTabs" });
  }, []);

  const handleOpenWorkspace = useCallback(async () => {
    if (
      shownWorkspaceId &&
      shownWorkspaceId !== workspaceData?.activeWorkspace?.id &&
      shownWorkspaceId !== -1
    ) {
      try {
        await browser.runtime.sendMessage({
          type: "openWorkspace",
          workspaceId: shownWorkspaceId,
        });
        setPreviewWorkspaceId(null);
      } catch (error) {
        console.error("Failed to switch workspace:", error);
      }
    }
  }, [shownWorkspaceId, workspaceData?.activeWorkspace?.id]);

  const handleCloseWorkspace = useCallback(async () => {
    if (workspaceData?.activeWorkspace) {
      try {
        await browser.runtime.sendMessage({
          type: "closeWorkspace",
        });
        setPreviewWorkspaceId(null);
      } catch (error) {
        console.error("Failed to close workspace:", error);
      }
    }
  }, [workspaceData?.activeWorkspace]);

  // Memoize the window tabs grouping to prevent recalculation on every render
  const windowTabs = useMemo(() => {
    if (!shownTabs?.length) return [];

    return Object.entries(
      shownTabs.reduce(
        (acc, tab) => {
          acc[tab.windowId] = acc[tab.windowId] || [];
          acc[tab.windowId].push(tab);
          return acc;
        },
        {} as Record<number, Tab[]>,
      ),
    ).sort(([aId], [bId]) => Number(aId) - Number(bId));
  }, [shownTabs]);

  return (
    <SidebarProvider>
      <AppSidebar
        previewWorkspaceId={previewWorkspaceId}
        setPreviewWorkspaceId={setPreviewWorkspaceId}
      />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            {shownWorkspaceId === -1 ? (
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
                </BreadcrumbList>
              </Breadcrumb>
            ) : (
              <span className="text-muted-foreground">
                No workspace selected
              </span>
            )}
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleRefresh}>
              Refresh
            </Button>
            {previewWorkspaceId !== null &&
              previewWorkspaceId !== workspaceData?.activeWorkspace?.id &&
              previewWorkspaceId !== -1 && (
                <Button variant="default" onClick={handleOpenWorkspace}>
                  Open
                </Button>
              )}
            {/* Close workspace button - only show if there's an active workspace and we're not previewing */}
            {workspaceData?.activeWorkspace &&
              previewWorkspaceId === null &&
              shownWorkspaceId !== -1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCloseWorkspace}
                  title="Close workspace and switch to undefined workspace"
                >
                  Close Workspace
                </Button>
              )}
          </div>

          {windowTabs.length > 0 ? (
            <div>
              {windowTabs.map(([windowId, windowTabs]) => (
                <div key={windowId} className="mb-8">
                  <h3 className="font-semibold text-lg">Window {windowId}</h3>
                  <hr className="my-4 border-t" />
                  <ol className="space-y-2">
                    {windowTabs
                      .sort((a, b) => a.index - b.index)
                      .map((tab) => (
                        <li
                          key={tab.id}
                          className="flex items-center gap-2 rounded-lg border p-3 hover:bg-accent"
                        >
                          {tab.favIconUrl && (
                            <img
                              src={tab.favIconUrl}
                              className="h-4 w-4"
                              alt=""
                            />
                          )}
                          <span className="font-medium">{tab.title}</span>
                          <a
                            href={tab.url}
                            target="_blank"
                            rel="noreferrer"
                            className="max-w-[200px] truncate text-primary transition-colors hover:text-primary/80"
                            title={tab.url}
                          >
                            {tab.url?.slice(0, 40)}
                          </a>
                          <div className="ml-auto flex items-center gap-3">
                            <span className="text-muted-foreground text-sm">
                              Index: {tab.index}
                            </span>
                            <span className="text-sm" title="Pinned">
                              {tab.pinned ? "✅" : "❌"}
                            </span>
                            <span
                              className={`rounded px-2 py-1 text-sm ${
                                tab.status === "complete"
                                  ? "bg-success/20 text-success-foreground"
                                  : "bg-warning/20 text-warning-foreground"
                              }`}
                            >
                              {tab.status}
                            </span>
                          </div>
                        </li>
                      ))}
                  </ol>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
              <div className="text-center">
                <h2 className="font-semibold text-2xl">No Tabs</h2>
                <p className="mt-2 text-muted-foreground">
                  Select a workspace from the sidebar to view its tabs
                </p>
              </div>
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
