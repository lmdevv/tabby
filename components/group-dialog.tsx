import { useLiveQuery } from "dexie-react-hooks";
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
import { db } from "@/entrypoints/background/db";
import {
  browserColorToHex,
  getDefaultTabGroupColor,
  TAB_GROUP_COLORS,
} from "@/lib/tab-group-colors";

interface GroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (name: string, color: string) => void;
  groupId?: number;
  title: string;
  description: string;
}

export function GroupDialog({
  open,
  onOpenChange,
  onConfirm,
  groupId,
  title,
  description,
}: GroupDialogProps) {
  const nameId = useId();
  // Fetch group data directly from database
  const group = useLiveQuery(() => {
    if (!groupId || !open) return undefined;
    return db.tabGroups.get(groupId);
  }, [groupId]);

  // Initialize form values from database or defaults
  const initialName = group?.title || "";
  const initialColor = group?.color
    ? browserColorToHex(group.color)
    : getDefaultTabGroupColor().value;

  const [name, setName] = useState(initialName);
  const [selectedColor, setSelectedColor] = useState(initialColor);

  // Sync form state when dialog opens or group data changes
  useEffect(() => {
    if (open && group) {
      setName(group.title || "");
      setSelectedColor(
        group.color
          ? browserColorToHex(group.color)
          : getDefaultTabGroupColor().value,
      );
    }
  }, [open, group]);

  const handleConfirm = () => {
    if (name.trim()) {
      onConfirm(name.trim(), selectedColor);
      onOpenChange(false);
      setName("");
      setSelectedColor(getDefaultTabGroupColor().value);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      setName(initialName);
      setSelectedColor(initialColor);
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
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Color</Label>
            <div className="col-span-3 flex flex-wrap gap-2">
              {TAB_GROUP_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  className={`h-8 w-8 rounded-full border-2 transition-all ${
                    selectedColor === color.value
                      ? "scale-110 border-foreground"
                      : "border-muted"
                  }`}
                  style={{ backgroundColor: color.value }}
                  onClick={() => setSelectedColor(color.value)}
                  title={color.name}
                />
              ))}
            </div>
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
