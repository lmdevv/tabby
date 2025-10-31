import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  webExt: {
    disabled: true,
  },
  modules: ["@wxt-dev/module-react"],
  manifest: {
    permissions: ["tabs", "storage", "tabGroups", "alarms", "nativeMessaging"],
    commands: {
      "open-command-menu": {
        suggested_key: {
          default: "Ctrl+Space",
        },
        description: "Open Tabby command menu",
      },
    },
    action: {
      default_title: "Tabby",
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./"),
      },
    },
  }),
});
