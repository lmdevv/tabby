import { db } from "@/entrypoints/background/db";
import { useLiveQuery } from "dexie-react-hooks";

function App() {
  const activeTabs = useLiveQuery(() => db.activeTabs.toArray());
  if (!activeTabs) return null;

  function handleRefresh(): void {
    browser.runtime.sendMessage("Refresh tabs");
  }

  return (
    <div className="flex flex-1 flex-col gap-4 px-32 pt-4">
      <button type="button" onClick={handleRefresh}>
        Refresh table
      </button>

      <div>
        {Object.entries(
          activeTabs?.reduce(
            (acc, tab) => {
              acc[tab.windowId] = acc[tab.windowId] || [];
              acc[tab.windowId].push(tab);
              return acc;
            },
            {} as Record<number, typeof activeTabs>,
          ),
        )
          .sort(([aId], [bId]) => Number(aId) - Number(bId))
          .map(([windowId, windowTabs]) => (
            <div key={windowId} className="mb-8">
              <h3 className="font-semibold text-lg">Window {windowId}</h3>
              <hr className="my-4 border-t" />
              <ol className="space-y-2">
                {windowTabs
                  .sort((a, b) => a.index - b.index)
                  .map((tab) => (
                    <li
                      key={tab.id}
                      className="flex items-center gap-2 rounded-lg border p-3 hover:bg-accent"
                    >
                      {tab.favIconUrl && (
                        <img src={tab.favIconUrl} className="h-4 w-4" alt="" />
                      )}
                      <span className="font-medium">{tab.title}</span>
                      <a
                        href={tab.url}
                        target="_blank"
                        rel="noreferrer"
                        className="max-w-[200px] truncate text-primary transition-colors hover:text-primary/80"
                        title={tab.url}
                      >
                        {tab.url?.slice(0, 40)}
                      </a>
                      <div className="ml-auto flex items-center gap-3">
                        <span className="text-muted-foreground text-sm">
                          Index: {tab.index}
                        </span>
                        <span className="text-sm" title="Pinned">
                          {tab.pinned ? "✅" : "❌"}
                        </span>
                        <span
                          className={`rounded px-2 py-1 text-sm ${
                            tab.status === "complete"
                              ? "bg-success/20 text-success-foreground"
                              : "bg-warning/20 text-warning-foreground"
                          }`}
                        >
                          {tab.status}
                        </span>
                      </div>
                    </li>
                  ))}
              </ol>
            </div>
          ))}
      </div>
    </div>
  );
}

export default App;
