import { CommandInput } from "@/components/ui/command";
import type { MenuMode } from "../types";

interface SearchInputProps {
  menuMode: MenuMode;
  searchValue: string;
  setSearchValue: (value: string) => void;
}

export function SearchInput({
  menuMode,
  searchValue,
  setSearchValue,
}: SearchInputProps) {
  return (
    <CommandInput
      placeholder={
        menuMode === "workspaces"
          ? "Search workspaces..."
          : menuMode === "snapshots"
            ? "Search snapshots..."
            : "Type a command..."
      }
      value={searchValue}
      onValueChange={setSearchValue}
    />
  );
}
