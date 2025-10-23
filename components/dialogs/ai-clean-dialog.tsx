import { useLiveQuery } from "dexie-react-hooks";
import { Trash2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { TabCard } from "@/components/tabs/tab-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { db } from "@/lib/db/db";
import type { CardData } from "@/lib/helpers/card-helpers";

interface AICleanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (tabIds: number[], dontAskAgain: boolean) => void;
  workspaceId: number | null;
  proposedTabIds: number[];
  instructions: string;
}

interface TabWithSelection {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
  selected: boolean;
}

export function AICleanDialog({
  open,
  onOpenChange,
  onConfirm,
  workspaceId,
  proposedTabIds,
  instructions,
}: AICleanDialogProps) {
  const selectAllId = useId();
  const dontAskAgainId = useId();
  const [tabsWithSelection, setTabsWithSelection] = useState<
    TabWithSelection[]
  >([]);
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch tab details from database
  const tabs = useLiveQuery(() => {
    if (!workspaceId || !open || proposedTabIds.length === 0) return [];
    return db.activeTabs
      .where("workspaceId")
      .equals(workspaceId)
      .and((tab) => tab.id !== undefined && proposedTabIds.includes(tab.id))
      .toArray();
  }, [workspaceId, open, proposedTabIds]);

  // Initialize tabs with selection when tabs are loaded
  useEffect(() => {
    if (tabs && tabs.length > 0) {
      const initialTabsWithSelection: TabWithSelection[] = tabs
        .filter(
          (tab): tab is typeof tab & { id: number } => tab.id !== undefined,
        )
        .map((tab) => ({
          id: tab.id,
          title: tab.title || "Untitled",
          url: tab.url || "",
          favIconUrl: tab.favIconUrl,
          selected: true, // Default to selected
        }));
      setTabsWithSelection(initialTabsWithSelection);
    } else if (!tabs || tabs.length === 0) {
      setTabsWithSelection([]);
    }
  }, [tabs]);

  const handleTabSelectionChange = (tabId: number, selected: boolean) => {
    setTabsWithSelection((prev) =>
      prev.map((tab) => (tab.id === tabId ? { ...tab, selected } : tab)),
    );
  };

  const handleSelectAll = (checked: boolean | "indeterminate") => {
    const selected = checked === true;
    setTabsWithSelection((prev) => prev.map((tab) => ({ ...tab, selected })));
  };

  const selectedCount = tabsWithSelection.filter((tab) => tab.selected).length;
  const allSelected =
    tabsWithSelection.length > 0 && selectedCount === tabsWithSelection.length;
  const someSelected =
    selectedCount > 0 && selectedCount < tabsWithSelection.length;

  const handleConfirm = async () => {
    const selectedTabIds = tabsWithSelection
      .filter((tab) => tab.selected)
      .map((tab) => tab.id);

    if (selectedTabIds.length === 0) {
      toast.error("No tabs selected for cleaning");
      return;
    }

    setIsLoading(true);
    try {
      await onConfirm(selectedTabIds, dontAskAgain);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to clean tabs:", error);
      toast.error("Failed to clean tabs");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Confirm Tab Cleaning
          </DialogTitle>
          <DialogDescription>
            Tabby analyzed your tabs with the instruction: "{instructions}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              {selectedCount} of {tabsWithSelection.length} tabs selected
            </Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id={selectAllId}
                checked={
                  allSelected ? true : someSelected ? "indeterminate" : false
                }
                onCheckedChange={handleSelectAll}
              />
              <Label htmlFor={selectAllId} className="text-sm">
                Select all
              </Label>
            </div>
          </div>

          <ScrollArea className="max-h-96 border rounded-md p-4">
            <div className="space-y-3">
              {tabsWithSelection.map((tab) => {
                const cardData: CardData = {
                  title: tab.title,
                  url: tab.url,
                  favIconUrl: tab.favIconUrl,
                };

                return (
                  <TabCard
                    key={tab.id}
                    data={cardData}
                    onClick={() => {}}
                    ariaLabel={`Tab: ${tab.title}`}
                    isInteractive={true}
                    beforeFavicon={
                      <Checkbox
                        id={`tab-${tab.id}`}
                        checked={tab.selected}
                        onCheckedChange={(checked) =>
                          handleTabSelectionChange(tab.id, checked as boolean)
                        }
                      />
                    }
                  />
                );
              })}
            </div>
          </ScrollArea>

          <div className="flex items-center space-x-2">
            <Checkbox
              id={dontAskAgainId}
              checked={dontAskAgain}
              onCheckedChange={(checked) => setDontAskAgain(checked === true)}
            />
            <Label htmlFor={dontAskAgainId} className="text-sm">
              Don't ask again
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={selectedCount === 0 || isLoading}
          >
            {isLoading ? (
              <>
                <Trash2 className="mr-2 h-4 w-4 animate-spin" />
                Cleaning...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Clean {selectedCount} Tab{selectedCount !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
