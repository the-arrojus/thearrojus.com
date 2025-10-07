import { Outlet } from "react-router-dom";
import AdminHeader from "../components/AdminHeader";

export default function AdminLayout() {
  return (
    <>
      <AdminHeader />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </>
  );
}