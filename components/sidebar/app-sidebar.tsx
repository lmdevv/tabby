import type * as React from "react";
import { SettingsDialog } from "@/components/dialogs/settings-dialog";
import { CreateWorkspace } from "@/components/sidebar/create-workspace";
import { Workspaces } from "@/components/sidebar/workspaces";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
} from "@/components/ui/sidebar";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  previewWorkspaceId: number | null;
  setPreviewWorkspaceId: (id: number | null) => void;
  onEditWorkspace?: (id: number) => void;
}

export function AppSidebar({
  previewWorkspaceId,
  setPreviewWorkspaceId,
  onEditWorkspace,
  ...props
}: AppSidebarProps) {
  return (
    <Sidebar {...props}>
      <SidebarContent>
        <Workspaces
          previewWorkspaceId={previewWorkspaceId}
          setPreviewWorkspaceId={setPreviewWorkspaceId}
          onEditWorkspace={onEditWorkspace}
        />
      </SidebarContent>
      <SidebarFooter>
        <CreateWorkspace />
        <SettingsDialog />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
