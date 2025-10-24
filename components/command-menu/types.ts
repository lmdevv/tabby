export type MenuMode = "main" | "workspaces" | "snapshots" | "resourceGroups";

export interface CommandMenuProps {
  workspaceId: number | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onOpenSettings?: () => void;
  onOpenCreateWorkspace?: () => void;
  onOpenAICleanReview?: (tabIds: number[], instructions: string) => void;
  onOpenCreateResourceGroup?: () => void;
  onSelectResourceGroup?: (groupId: number) => void;
  onMoveToResourceGroup?: (groupId: number) => void;
  initialMenuMode?: MenuMode;
}

export interface FooterProps {
  enterText: string;
  shortcuts: Array<{
    key: string;
    action: string;
  }>;
}
