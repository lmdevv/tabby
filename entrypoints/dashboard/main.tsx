import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "@/components/theme/theme-provider";
import App from "./App.tsx";
import "@/assets/tailwind.css";
import { Toaster } from "sonner";

const container = document.getElementById("root");

if (!container) throw new Error('Cannot find <div id="root"> in the HTML');

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <App />
      <Toaster richColors position="bottom-right" closeButton />
    </ThemeProvider>
  </React.StrictMode>,
);
