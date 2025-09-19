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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ResourceGroup } from "@/lib/types";

interface AddResourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (
    title: string,
    url: string,
    groupId: number,
    description: string,
    tags: string[],
  ) => void;
  resourceGroups: ResourceGroup[];
  title?: string;
}

export function AddResourceDialog({
  open,
  onOpenChange,
  onConfirm,
  resourceGroups,
  title = "Add Resource",
}: AddResourceDialogProps) {
  const titleId = useId();
  const urlId = useId();
  const groupSelectId = useId();
  const tagsId = useId();
  const descriptionId = useId();
  const [resourceTitle, setResourceTitle] = useState("");
  const [url, setUrl] = useState("");
  const [groupId, setGroupId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const handleConfirm = () => {
    if (resourceTitle.trim() && url.trim() && groupId) {
      const tags = tagsInput
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      onConfirm(
        resourceTitle.trim(),
        url.trim(),
        Number.parseInt(groupId, 10),
        description.trim(),
        tags,
      );
      resetForm();
      onOpenChange(false);
    }
  };

  const resetForm = () => {
    setResourceTitle("");
    setUrl("");
    setGroupId("");
    setDescription("");
    setTagsInput("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      resetForm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Add a new resource to your collection.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor={titleId} className="text-right">
              Title
            </Label>
            <Input
              id={titleId}
              value={resourceTitle}
              onChange={(e) => setResourceTitle(e.target.value)}
              className="col-span-3"
              placeholder="Resource title"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor={urlId} className="text-right">
              URL
            </Label>
            <Input
              id={urlId}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="col-span-3"
              placeholder="https://example.com"
              type="url"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor={groupSelectId} className="text-right">
              Group
            </Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger id={groupSelectId} className="col-span-3">
                <SelectValue placeholder="Select a group" />
              </SelectTrigger>
              <SelectContent>
                {resourceGroups.map((group) => (
                  <SelectItem key={group.id} value={group.id.toString()}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor={tagsId} className="text-right">
              Tags
            </Label>
            <Input
              id={tagsId}
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="col-span-3"
              placeholder="tag1, tag2, tag3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor={descriptionId} className="text-right">
              Description
            </Label>
            <Textarea
              id={descriptionId}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="col-span-3"
              placeholder="Resource description (optional)"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!resourceTitle.trim() || !url.trim() || !groupId}
          >
            Add Resource
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
