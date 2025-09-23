import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type FilterType =
  | "all"
  | "pinned"
  | "audible"
  | "muted"
  | "highlighted"
  | "discarded";

interface FilterDropdownProps {
  activeFilter: FilterType;
  selectedTags: string[];
  allTags: string[];
  onFilterChange: (filter: FilterType) => void;
  onToggleTag: (tag: string) => void;
}

export function FilterDropdown({
  activeFilter,
  selectedTags,
  allTags,
  onFilterChange,
  onToggleTag,
}: FilterDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          Filter
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Filter Tabs</DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={activeFilter === "all"}
          onCheckedChange={() => onFilterChange("all")}
        >
          All Tabs
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={activeFilter === "pinned"}
          onCheckedChange={() => onFilterChange("pinned")}
        >
          Pinned
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={activeFilter === "audible"}
          onCheckedChange={() => onFilterChange("audible")}
        >
          Audible
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={activeFilter === "muted"}
          onCheckedChange={() => onFilterChange("muted")}
        >
          Muted
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={activeFilter === "highlighted"}
          onCheckedChange={() => onFilterChange("highlighted")}
        >
          Highlighted
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={activeFilter === "discarded"}
          onCheckedChange={() => onFilterChange("discarded")}
        >
          Discarded
        </DropdownMenuCheckboxItem>

        {allTags.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Filter by Tags</DropdownMenuLabel>
            {allTags.map((tag) => (
              <DropdownMenuCheckboxItem
                key={tag}
                checked={selectedTags.includes(tag)}
                onCheckedChange={() => onToggleTag(tag)}
              >
                {tag}
              </DropdownMenuCheckboxItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
