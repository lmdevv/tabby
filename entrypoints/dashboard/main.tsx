import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "@/components/theme-provider";
import App from "./App.tsx";
import "@/assets/tailwind.css";

const container = document.getElementById("root");

if (!container) throw new Error('Cannot find <div id="root"> in the HTML');

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
