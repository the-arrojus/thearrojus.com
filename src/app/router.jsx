import React from "react";
import { createBrowserRouter, Outlet } from "react-router-dom";
import PublicLayout from "../layouts/PublicLayout";
import AdminLayout from "../layouts/AdminLayout";
import Home from "../pages/public/Home";
import TestimonialSubmit from "../pages/public/TestimonialSubmit";
import AdminLogin from "../pages/admin/Login";
import AdminProfile from "../pages/admin/Profile";
import AdminTestimonials from "../pages/admin/Testimonials";
import { RequireAdmin } from "../routes/guards";
import AdminCarousel from "../pages/admin/Carousel";
import AdminMasonry from "../pages/admin/Masonry";

const publicRoutes = {
  element: <PublicLayout />,
  children: [
    { index: true, element: <Home /> },
    { path: "t/:token", element: <TestimonialSubmit /> },
    { path: "*", element: <div className="p-6">Not found</div> },
  ],
};

const adminRoutes = {
  path: "/admin",
  children: [
    { path: "login", element: <AdminLogin /> },
    {
      element: (
        <RequireAdmin>
          <AdminLayout />
        </RequireAdmin>
      ),
      children: [
        { index: true, element: <AdminProfile /> },          // /admin
        { path: "testimonials", element: <AdminTestimonials /> }, // /admin/testimonials
        { path: "carousel", element: <AdminCarousel /> },
        { path: "masonry", element: <AdminMasonry /> }
      ],
    },
  ],
};

export const router = createBrowserRouter([publicRoutes, adminRoutes]);
export default router;