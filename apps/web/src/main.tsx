import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";

import { App } from "@/app";
import { queryClient } from "@/lib/query-client";
import "@/styles/globals.css";
import { Toaster } from "./components/ui/sonner";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Orbit root element not found");
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
