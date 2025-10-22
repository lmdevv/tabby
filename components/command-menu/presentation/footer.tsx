import { Kbd } from "@/components/ui/kbd";
import type { FooterProps } from "../types";

export function Footer({ enterText, shortcuts }: FooterProps) {
  return (
    <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Kbd>↵</Kbd>
          <span>{enterText}</span>
        </div>
        <div className="flex items-center gap-3">
          {shortcuts.map((shortcut) => (
            <div key={shortcut.key} className="flex items-center gap-1">
              <Kbd>{shortcut.key}</Kbd>
              <span>{shortcut.action}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
