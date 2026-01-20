import RequireAuth from "@/components/RequireAuth";
import AppHeader from "@/components/AppHeader";

export default function PosPage() {
  return (
    <RequireAuth allowedRoles={["EMPLOYEE", "ADMIN"]}>
      <div>
        <AppHeader title="POS Mode" />

        <main style={{ padding: 24 }}>
          <p>Next: Phase 2 (Open shift → Create order → Kitchen → Payment)</p>
        </main>
      </div>
    </RequireAuth>
  );
}
