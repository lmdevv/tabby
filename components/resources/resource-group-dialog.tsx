"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { generateResourceGroupTitleAndDescription } from "@/lib/ai/resource-group-ai";

interface ResourceGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (name: string, description: string) => void;
  mode: "create" | "edit";
  initialName?: string;
  initialDescription?: string;
  resourceIds?: string[]; // For AI generation - IDs of resources in the group
}

export function ResourceGroupDialog({
  open,
  onOpenChange,
  onConfirm,
  mode,
  initialName = "",
  initialDescription = "",
  resourceIds = [],
}: ResourceGroupDialogProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [isGenerating, setIsGenerating] = useState(false);

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

  const handleGenerateWithAI = async () => {
    if (resourceIds.length === 0) return;

    setIsGenerating(true);
    try {
      const suggestion =
        await generateResourceGroupTitleAndDescription(resourceIds);
      if (suggestion) {
        setName(suggestion.title);
        setDescription(suggestion.description);
      }
    } catch (error) {
      console.error("Failed to generate with AI:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const title =
    mode === "create" ? "Create Resource Group" : "Edit Resource Group";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-[525px] p-0"
        aria-describedby={undefined}
      >
        <div className="p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 mt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor={nameId} className="text-sm font-medium">
                  Group Name *
                </Label>
                {resourceIds.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateWithAI}
                    disabled={isGenerating}
                    className="h-8 gap-1.5 text-xs"
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
              <Input
                id={nameId}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Work Projects, Research, Personal"
                className="w-full h-10"
                autoFocus
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor={descriptionId} className="text-sm font-medium">
                Description
              </Label>
              <Textarea
                id={descriptionId}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe what this group is for (optional)"
                className="w-full resize-none min-h-[80px]"
                rows={3}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!name.trim() || isGenerating}
          >
            {mode === "edit" ? (
              <>
                Save Changes
              </>
            ) : (
              <>
                Create Group
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
