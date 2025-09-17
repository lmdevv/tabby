import { Workspaces } from "@/components/sidebar/workspaces";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Settings } from "lucide-react";
import type * as React from "react";
import { CreateWorkspace } from "./create-workspace";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  previewWorkspaceId: number | null;
  setPreviewWorkspaceId: (id: number | null) => void;
}

export function AppSidebar({
  previewWorkspaceId,
  setPreviewWorkspaceId,
  ...props
}: AppSidebarProps) {
  return (
    <Sidebar {...props}>
      <SidebarContent>
        <Workspaces
          previewWorkspaceId={previewWorkspaceId}
          setPreviewWorkspaceId={setPreviewWorkspaceId}
        />
      </SidebarContent>
      <SidebarFooter>
        <CreateWorkspace />
        <Button variant="ghost">
          <Settings />
          Settings
        </Button>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
