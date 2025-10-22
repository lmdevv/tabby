import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface WorkspaceBreadcrumbProps {
  workspace: {
    id: number;
    name: string;
    groupId?: number;
  };
  workspaceGroups:
    | Array<{
        id: number;
        name: string;
      }>
    | undefined;
}

export function WorkspaceBreadcrumb({
  workspace,
  workspaceGroups,
}: WorkspaceBreadcrumbProps) {
  if (workspace.groupId && workspaceGroups) {
    const group = workspaceGroups.find((g) => g.id === workspace.groupId);
    if (group) {
      return (
        <Breadcrumb>
          <BreadcrumbList className="gap-1">
            <BreadcrumbItem>
              <BreadcrumbLink className="text-muted-foreground hover:text-muted-foreground">
                {group.name}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-foreground">
                {workspace.name}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      );
    }
  }
  return <span>{workspace.name}</span>;
}
