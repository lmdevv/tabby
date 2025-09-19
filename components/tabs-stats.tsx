interface TabsStatsProps {
  filteredTabsCount: number;
  totalTabsCount: number;
  activeFilter: string;
  selectedTags: string[];
}

export function TabsStats({
  filteredTabsCount,
  totalTabsCount,
  activeFilter,
  selectedTags,
}: TabsStatsProps) {
  return (
    <p className="text-muted-foreground text-sm">
      Showing {filteredTabsCount} of {totalTabsCount} tabs
      {activeFilter !== "all" && ` (filtered by: ${activeFilter})`}
      {selectedTags.length > 0 && ` with tags: ${selectedTags.join(", ")}`}
    </p>
  );
}
