export type MenuMode = "main" | "workspaces" | "snapshots";

export interface CommandMenuProps {
  workspaceId: number | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onOpenSettings?: () => void;
  onOpenCreateWorkspace?: () => void;
  onOpenAICleanReview?: (tabIds: number[], instructions: string) => void;
  onOpenCreateResourceGroup?: () => void;
}

export interface FooterProps {
  enterText: string;
  shortcuts: Array<{
    key: string;
    action: string;
  }>;
}
