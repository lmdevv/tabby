import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DeleteActionProps {
  onDelete: () => void;
  tooltip?: string;
  className?: string;
  size?: "sm" | "icon";
  variant?: "ghost" | "destructive";
}

export function DeleteAction({
  onDelete,
  tooltip = "Delete",
  className = "h-6 w-6 rounded-full opacity-0 transition-all hover:bg-muted group-hover:opacity-100",
  size = "icon",
  variant = "ghost",
}: DeleteActionProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size={size}
            className={className}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title={tooltip}
          >
            <X className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}