import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

interface Keybinding {
  keys: string[];
  description: string;
}

interface KeybindingCategory {
  category: string;
  bindings: Keybinding[];
}

const keybindings: KeybindingCategory[] = [
  {
    category: "Navigation",
    bindings: [
      { keys: ["j", "↓"], description: "Move to next tab/group" },
      { keys: ["k", "↑"], description: "Move to previous tab/group" },
      { keys: ["h", "←"], description: "Move to previous window" },
      { keys: ["l", "→"], description: "Move to next window" },
      { keys: ["gg"], description: "Go to first tab/group" },
      { keys: ["G"], description: "Go to last tab/group" },
      { keys: ["z"], description: "Center focused tab in view" },
    ],
  },
  {
    category: "Selection",
    bindings: [
      { keys: ["Space"], description: "Toggle selection of focused tab" },
      { keys: ["v"], description: "Toggle visual selection mode" },
      { keys: ["a"], description: "Select/unselect all tabs" },
      { keys: ["Esc"], description: "Clear focus and exit visual mode" },
    ],
  },
  {
    category: "Actions",
    bindings: [
      { keys: ["Enter"], description: "Activate tab or toggle group collapse" },
      { keys: ["x"], description: "Delete selected tabs (or focused tab)" },
      { keys: ["r"], description: "Refresh all tabs" },
      { keys: ["R"], description: "Toggle resources panel" },
      { keys: ["P"], description: "Pin/unpin focused tab" },
    ],
  },
  {
    category: "Clipboard",
    bindings: [
      { keys: ["dd"], description: "Cut focused tab" },
      { keys: ["p"], description: "Paste tab at focused position" },
      { keys: ["yy"], description: "Copy focused tab link" },
      { keys: ["y"], description: "Copy selected tabs links" },
    ],
  },
  {
    category: "Grouping",
    bindings: [
      {
        keys: ["g"],
        description: "Group selected tabs (if multiple selected)",
      },
    ],
  },
  {
    category: "Quick Actions",
    bindings: [
      {
        keys: ["e"],
        description: "Add selected tabs to resource group",
      },
      {
        keys: ["w"],
        description: "Add selected tabs to workspace",
      },
    ],
  },
  {
    category: "Global",
    bindings: [
      { keys: ["Ctrl", "Space"], description: "Open command menu" },
      { keys: ["?"], description: "Show keybindings" },
    ],
  },
];

interface KeybindingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeybindingsDialog({
  open,
  onOpenChange,
}: KeybindingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-[1000px] lg:max-w-[1200px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use these keyboard shortcuts to navigate and manage your tabs
            efficiently.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-8">
          {keybindings.map((category) => (
            <div key={category.category} className="space-y-4">
              <h3 className="text-lg font-semibold">{category.category}</h3>
              <div className="space-y-3">
                {category.bindings.map((binding) => (
                  <div
                    key={binding.description}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm text-muted-foreground flex-1 mr-4">
                      {binding.description}
                    </span>
                    <KbdGroup>
                      {binding.keys.map((key) => (
                        <Kbd key={key}>{key}</Kbd>
                      ))}
                    </KbdGroup>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
