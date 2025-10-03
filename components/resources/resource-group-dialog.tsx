"use client";

import { BookmarkPlus } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ResourceGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (name: string, description: string) => void;
  mode: "create" | "edit";
  initialName?: string;
  initialDescription?: string;
}

export function ResourceGroupDialog({
  open,
  onOpenChange,
  onConfirm,
  mode,
  initialName = "",
  initialDescription = "",
}: ResourceGroupDialogProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);

  const nameId = useId();
  const descriptionId = useId();

  // Reset form when dialog opens/closes or mode changes
  useEffect(() => {
    if (open) {
      setName(initialName);
      setDescription(initialDescription);
    }
  }, [open, initialName, initialDescription]);

  const handleConfirm = () => {
    if (name.trim()) {
      onConfirm(name.trim(), description.trim());
      onOpenChange(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
  };

  const title =
    mode === "create" ? "Create Resource Group" : "Edit Resource Group";
  const dialogDescription =
    mode === "create"
      ? "Create a new group to organize your resources."
      : "Edit the group name and description.";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <BookmarkPlus className="h-4 w-4 text-primary" />
            </div>
            {title}
          </DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="space-y-2">
            <Label htmlFor={nameId} className="text-sm font-medium">
              Group Name *
            </Label>
            <Input
              id={nameId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Work Projects, Research, Personal"
              className="w-full"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={descriptionId} className="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id={descriptionId}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Briefly describe what this group is for (optional)"
              className="w-full resize-none"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Help others understand the purpose of this resource group
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="gap-2"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!name.trim()}
            className="gap-2"
          >
            {mode === "edit" ? (
              <>
                <BookmarkPlus className="h-4 w-4" />
                Save Changes
              </>
            ) : (
              <>
                <BookmarkPlus className="h-4 w-4" />
                Create Group
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
