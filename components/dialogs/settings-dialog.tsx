import { FileDown, FileJson, FileUp, Settings2, Trash2 } from "lucide-react";
import * as React from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import { checkAIModelAvailability } from "@/lib/ai/ai-availability";
import { db } from "@/lib/db/db";
import type {
  Resource,
  ResourceGroup,
  SnapshotTab,
  SnapshotTabGroup,
  StateEntry,
  Tab,
  TabGroup,
  Workspace,
  WorkspaceGroup,
  WorkspaceSnapshot,
} from "@/lib/types/types";

interface SettingsDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface ExportData {
  version: string;
  exportedAt: string;
  data: {
    workspaceGroups: WorkspaceGroup[];
    workspaces: Workspace[];
    activeTabs: Tab[];
    tabGroups: TabGroup[];
    resourceGroups: ResourceGroup[];
    resources: Resource[];
    state: StateEntry[];
    workspaceSnapshots: WorkspaceSnapshot[];
    snapshotTabs: SnapshotTab[];
    snapshotTabGroups: SnapshotTabGroup[];
  };
}

const data = {
  nav: [
    { name: "Preferences", icon: Settings2 },
    { name: "Import/Export", icon: FileJson },
  ],
};

export function SettingsDialog({
  open: externalOpen,
  onOpenChange,
}: SettingsDialogProps = {}) {
  const [internalOpen, setInternalOpen] = React.useState(false);

  const isControlled = externalOpen !== undefined && onOpenChange !== undefined;
  const open = isControlled ? externalOpen : internalOpen;
  const setOpen = isControlled ? onOpenChange : setInternalOpen;
  const [activeTab, setActiveTab] = React.useState("Preferences");
  const [useLocalAI, setUseLocalAI] = React.useState(true);
  const [isModelAvailable, setIsModelAvailable] = React.useState(false);
  const localAiId = React.useId();

  // Check AI model availability on component mount
  React.useEffect(() => {
    checkAIModelAvailability()
      .then((availability) => {
        setIsModelAvailable(
          availability === "available" ||
            availability === "downloadable" ||
            availability === "downloading",
        );
      })
      .catch(() => {
        setIsModelAvailable(false);
      });
  }, []);

  const handleExport = async () => {
    try {
      const exportData: ExportData = await db.transaction(
        "r",
        [
          db.workspaceGroups,
          db.workspaces,
          db.activeTabs,
          db.tabGroups,
          db.resourceGroups,
          db.resources,
          db.state,
          db.workspaceSnapshots,
          db.snapshotTabs,
          db.snapshotTabGroups,
        ],
        async () => {
          const [
            workspaceGroups,
            workspaces,
            activeTabs,
            tabGroups,
            resourceGroups,
            resources,
            state,
            workspaceSnapshots,
            snapshotTabs,
            snapshotTabGroups,
          ] = await Promise.all([
            db.workspaceGroups.toArray(),
            db.workspaces.toArray(),
            db.activeTabs.toArray(),
            db.tabGroups.toArray(),
            db.resourceGroups.toArray(),
            db.resources.toArray(),
            db.state.toArray(),
            db.workspaceSnapshots.toArray(),
            db.snapshotTabs.toArray(),
            db.snapshotTabGroups.toArray(),
          ]);

          return {
            version: "1.0",
            exportedAt: new Date().toISOString(),
            data: {
              workspaceGroups,
              workspaces,
              activeTabs,
              tabGroups,
              resourceGroups,
              resources,
              state,
              workspaceSnapshots,
              snapshotTabs,
              snapshotTabGroups,
            },
          };
        },
      );

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tabby-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      console.log("Export completed successfully");
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const parsed = JSON.parse(
            event.target?.result as string,
          ) as ExportData;

          // Basic validation
          if (!parsed.version || !parsed.data) {
            throw new Error("Invalid export file format");
          }

          // Clear all tables and import new data
          await db.transaction(
            "rw",
            [
              db.workspaceGroups,
              db.workspaces,
              db.activeTabs,
              db.tabGroups,
              db.resourceGroups,
              db.resources,
              db.state,
              db.workspaceSnapshots,
              db.snapshotTabs,
              db.snapshotTabGroups,
            ],
            async () => {
              // Clear all tables
              await Promise.all([
                db.workspaceGroups.clear(),
                db.workspaces.clear(),
                db.activeTabs.clear(),
                db.tabGroups.clear(),
                db.resourceGroups.clear(),
                db.resources.clear(),
                db.state.clear(),
                db.workspaceSnapshots.clear(),
                db.snapshotTabs.clear(),
                db.snapshotTabGroups.clear(),
              ]);

              // Bulk insert new data
              await Promise.all([
                db.workspaceGroups.bulkPut(parsed.data.workspaceGroups),
                db.workspaces.bulkPut(parsed.data.workspaces),
                db.activeTabs.bulkPut(parsed.data.activeTabs),
                db.tabGroups.bulkPut(parsed.data.tabGroups),
                db.resourceGroups.bulkPut(parsed.data.resourceGroups),
                db.resources.bulkPut(parsed.data.resources),
                db.state.bulkPut(parsed.data.state),
                db.workspaceSnapshots.bulkPut(parsed.data.workspaceSnapshots),
                db.snapshotTabs.bulkPut(parsed.data.snapshotTabs),
                db.snapshotTabGroups.bulkPut(parsed.data.snapshotTabGroups),
              ]);
            },
          );

          console.log("Import completed successfully");
          // Optionally reload the page or refresh state
          window.location.reload();
        } catch (error) {
          console.error("Import failed:", error);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleDeleteEverything = async () => {
    try {
      await db.transaction(
        "rw",
        [
          db.workspaceGroups,
          db.workspaces,
          db.activeTabs,
          db.tabGroups,
          db.resourceGroups,
          db.resources,
          db.state,
          db.workspaceSnapshots,
          db.snapshotTabs,
          db.snapshotTabGroups,
        ],
        async () => {
          await Promise.all([
            db.workspaceGroups.clear(),
            db.workspaces.clear(),
            db.activeTabs.clear(),
            db.tabGroups.clear(),
            db.resourceGroups.clear(),
            db.resources.clear(),
            db.state.clear(),
            db.workspaceSnapshots.clear(),
            db.snapshotTabs.clear(),
            db.snapshotTabGroups.clear(),
          ]);
        },
      );

      console.log("All data deleted successfully");
      // Reset local state
      setUseLocalAI(true);
      // Optionally reload the page
      window.location.reload();
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost">
          <Settings2 />
          Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="overflow-hidden p-0 md:max-h-[500px] md:max-w-[700px] lg:max-w-[800px]">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Customize your settings here.
        </DialogDescription>
        <SidebarProvider className="items-start">
          <Sidebar collapsible="none" className="hidden md:flex">
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {data.nav.map((item) => (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton
                          asChild
                          isActive={item.name === activeTab}
                          onClick={() => setActiveTab(item.name)}
                        >
                          <button type="button">
                            <item.icon />
                            <span>{item.name}</span>
                          </button>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
          <main className="flex h-[480px] flex-1 flex-col overflow-hidden">
            <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
              <div className="flex items-center gap-2 px-4">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink href="#">Settings</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{activeTab}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </header>
            <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
              {activeTab === "Preferences" && (
                <div className="flex gap-4 items-center">
                  <div className="flex-1">
                    <div className="text-sm font-medium">Use Local AI</div>
                    <div className="text-sm text-muted-foreground">
                      Enable local AI processing for enhanced privacy (
                      {isModelAvailable ? "available" : "unavailable"})
                    </div>
                  </div>
                  <div className="flex-none self-center">
                    <Switch
                      id={localAiId}
                      checked={useLocalAI}
                      onCheckedChange={setUseLocalAI}
                    />
                  </div>
                </div>
              )}

              {activeTab === "Import/Export" && (
                <div className="space-y-3">
                  <Button
                    onClick={handleExport}
                    className="w-full justify-start"
                  >
                    <FileDown className="mr-2 h-4 w-4" />
                    Export App Data
                  </Button>

                  <Button
                    onClick={handleImport}
                    variant="outline"
                    className="w-full justify-start bg-transparent"
                  >
                    <FileUp className="mr-2 h-4 w-4" />
                    Import App Data
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        className="w-full justify-start"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Everything
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Are you absolutely sure?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete all your app data
                          including preferences, settings, and any stored
                          information. This action cannot be undone and
                          everything will be lost.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteEverything}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete Everything
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  );
}
