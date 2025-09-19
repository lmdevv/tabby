"use client";

import { useId, useState } from "react";
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
  initialName?: string;
  initialDescription?: string;
  title: string;
  description: string;
}

export function ResourceGroupDialog({
  open,
  onOpenChange,
  onConfirm,
  initialName = "",
  initialDescription = "",
  title,
  description,
}: ResourceGroupDialogProps) {
  const nameId = useId();
  const descriptionId = useId();
  const [name, setName] = useState(initialName);
  const [groupDescription, setGroupDescription] = useState(initialDescription);

  const handleConfirm = () => {
    if (name.trim()) {
      onConfirm(name.trim(), groupDescription.trim());
      onOpenChange(false);
      setName("");
      setGroupDescription("");
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      setName(initialName);
      setGroupDescription(initialDescription);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor={nameId} className="text-right">
              Name
            </Label>
            <Input
              id={nameId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              placeholder="Enter group name"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleConfirm();
                }
              }}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor={descriptionId} className="text-right">
              Description
            </Label>
            <Textarea
              id={descriptionId}
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              className="col-span-3"
              placeholder="Enter group description (optional)"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!name.trim()}>
            {title.includes("Edit") ? "Save Changes" : "Create Group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
