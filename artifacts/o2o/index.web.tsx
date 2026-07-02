import React from "react";
import { createRoot } from "react-dom/client";
import RootLayout from "./app/_layout";

const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <RootLayout />
  </React.StrictMode>
);
