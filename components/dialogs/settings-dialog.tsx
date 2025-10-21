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

const data = {
  nav: [
    { name: "Preferences", icon: Settings2 },
    { name: "Import/Export", icon: FileJson },
  ],
};

export function SettingsDialog() {
  const [open, setOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("Preferences");
  const [useLocalAI, setUseLocalAI] = React.useState(true);
  const [isModelAvailable] = React.useState(true);
  const localAiId = React.useId();

  const handleExport = () => {
    const data = {
      preferences: {
        useLocalAI,
      },
      appData: {
        // Placeholder for actual app data
      },
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "app-export.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = JSON.parse(event.target?.result as string);
            if (data.preferences?.useLocalAI !== undefined) {
              setUseLocalAI(data.preferences.useLocalAI);
            }
            // Handle other app data restoration here
          } catch (error) {
            console.error("Failed to parse JSON:", error);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleDeleteEverything = () => {
    // Reset all state to defaults
    setUseLocalAI(true);
    // Clear any stored data here
    console.log("[v0] All data deleted");
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
