"use client";

import { useRouter } from "next/navigation";
import AdminMenuPage from "@/app/admin/menu/page";
import { useAuthStore } from "@/lib/auth/authstore";
import "@/app/admin/admin.css";
import "./managerMenu.css";

export default function ManagerMenuPage() {
  const router = useRouter();
  const clearManagerAccess = useAuthStore((state) => state.clearManagerAccess);

  return (
    <div className="adminMain">
      <div className="managerMenuReturn">
        <button
          className="managerMenuReturnBtn"
          type="button"
          onClick={() => {
            clearManagerAccess();
            router.push("/pos");
          }}
        >
          Back to POS
        </button>
      </div>
      <AdminMenuPage />
    </div>
  );
}
