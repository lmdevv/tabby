"use client";

import { Loader2, Sparkles } from "lucide-react";
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
import { generateWorkspaceTitle } from "@/lib/ai/workspace-ai";
import { db } from "@/lib/db/db";

interface WorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (name: string) => void;
  workspaceId?: number;
  title: string;
  description: string;
  tabIds?: number[]; // For AI generation - IDs of tabs in the workspace
}

export function WorkspaceDialog({
  open,
  onOpenChange,
  onConfirm,
  workspaceId,
  title,
  description,
  tabIds = [],
}: WorkspaceDialogProps) {
  const nameId = useId();
  const [name, setName] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open && workspaceId) {
      // Get current workspace name from database
      const loadWorkspaceName = async () => {
        try {
          const workspace = await db.workspaces.get(workspaceId);
          if (workspace) {
            setName(workspace.name);
          }
        } catch (error) {
          console.error("Failed to load workspace:", error);
        }
      };
      loadWorkspaceName();
    }
  }, [open, workspaceId]);

  const handleConfirm = () => {
    if (name.trim()) {
      onConfirm(name.trim());
      onOpenChange(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
  };

  const handleGenerateWithAI = async () => {
    if (tabIds.length === 0) return;

    setIsGenerating(true);
    try {
      const suggestion = await generateWorkspaceTitle(tabIds);
      if (suggestion) {
        setName(suggestion.title);
      }
    } catch (error) {
      console.error("Failed to generate with Tabby:", error);
    } finally {
      setIsGenerating(false);
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
            <div className="col-span-3 flex items-center gap-2">
              <Input
                id={nameId}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1"
                placeholder="Enter workspace name"
              />
              {tabIds.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateWithAI}
                  disabled={isGenerating}
                  className="h-10 gap-1.5 text-xs shrink-0"
                >
                  {isGenerating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  {isGenerating ? "Thinking..." : "Tabby"}
                </Button>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!name.trim() || isGenerating}
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
