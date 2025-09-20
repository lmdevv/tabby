"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { PlusCircle } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/entrypoints/background/db";
import type { Workspace } from "@/lib/types";

interface CreateWorkspaceProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onWorkspaceCreated?: (workspaceId: number) => void;
  trigger?: React.ReactNode;
  showDefaultTrigger?: boolean;
}

export function CreateWorkspace({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onWorkspaceCreated,
  trigger,
  showDefaultTrigger = true,
}: CreateWorkspaceProps) {
  const nameId = useId();
  const descriptionId = useId();
  const groupSelectId = useId();
  const newGroupInputId = useId();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceDescription, setWorkspaceDescription] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("none");
  const [newGroupName, setNewGroupName] = useState("");

  const groups = useLiveQuery(() =>
    db.workspaceGroups.orderBy("name").toArray(),
  );
  if (groups === undefined) return null;

  // Use controlled or uncontrolled state based on props
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const onOpenChange = isControlled
    ? controlledOnOpenChange
    : setUncontrolledOpen;

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setWorkspaceName("");
      setWorkspaceDescription("");
      setNewGroupName("");
      setSelectedGroupId("none");
    }
    onOpenChange?.(newOpen);
  };

  const createWorkspace = async (
    workspaceData: Pick<Workspace, "name" | "description" | "groupId">,
  ) => {
    return db.workspaces.add({
      ...workspaceData,
      createdAt: Date.now(),
      lastOpened: Date.now(),
      active: 0,
      resourceGroupIds: [],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceName.trim()) return;

    try {
      let workspaceId: number | undefined;

      if (selectedGroupId === "new") {
        if (!newGroupName.trim()) return;
        await db.transaction(
          "rw",
          db.workspaceGroups,
          db.workspaces,
          async () => {
            const newGroupId = await db.workspaceGroups.add({
              name: newGroupName,
              collapsed: 1,
            });
            const id = await createWorkspace({
              name: workspaceName,
              description: workspaceDescription,
              groupId: newGroupId,
            });
            workspaceId = id;
          },
        );
      } else {
        const id = await createWorkspace({
          name: workspaceName,
          description: workspaceDescription,
          groupId:
            selectedGroupId !== "none" ? Number(selectedGroupId) : undefined,
        });
        workspaceId = id;
      }

      if (workspaceId !== undefined) {
        onWorkspaceCreated?.(workspaceId);
        handleOpenChange(false);
      } else {
        throw new Error("Failed to create workspace");
      }
    } catch (error) {
      console.error("Error creating workspace:", error);
    }
  };

  const defaultTrigger = showDefaultTrigger ? (
    <Button>Create Workspace</Button>
  ) : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {(trigger || defaultTrigger) && (
        <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Create Workspace</DialogTitle>
          <DialogDescription>
            Create a new workspace to organize your tabs and resources.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={nameId}>
              Name<span className="text-destructive">*</span>
            </Label>
            <Input
              id={nameId}
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="My Workspace"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={descriptionId}>Description</Label>
            <Textarea
              id={descriptionId}
              value={workspaceDescription}
              onChange={(e) => setWorkspaceDescription(e.target.value)}
              className="max-h-8 resize-none"
              placeholder="Describe your workspace"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={groupSelectId}>Group</Label>
            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger id={groupSelectId}>
                <SelectValue placeholder="Select a group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id.toString()}>
                    {group.name}
                  </SelectItem>
                ))}
                <SelectItem value="new" className="text-primary">
                  <div className="flex items-center">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create new group
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {selectedGroupId === "new" && (
            <div className="space-y-2">
              <Label
                htmlFor={newGroupInputId}
                className="after:ml-0.5 after:text-red-500 after:content-['*']"
              >
                New Group Name
              </Label>
              <Input
                id={newGroupInputId}
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Group Name"
                required={selectedGroupId === "new"}
              />
            </div>
          )}
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
