import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";

import { AuthProvider } from "./context/auth";
import { ToastProvider } from "./components/ToastProvider";

import { router } from "./app/router";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ToastProvider>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
    </ToastProvider>
  </React.StrictMode>
);