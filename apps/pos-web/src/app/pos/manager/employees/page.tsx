"use client";

import "./employees.css";
import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/lib/auth/authstore";
import { useRouter } from "next/navigation";

type Role = "ADMIN" | "MANAGER" | "EMPLOYEE" | "CUSTOMER";
type StaffRole = "EMPLOYEE" | "MANAGER";

type Emp = {
  id: string;
  name: string;
  role: StaffRole;
  isActive: boolean;
  phone?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export default function EmployeesPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const managerAccessToken = useAuthStore((s) => s.managerAccessToken);
  const managerAccessUser = useAuthStore((s) => s.managerAccessUser);
  const clearManagerAccess = useAuthStore((s) => s.clearManagerAccess);
  const isLoggedInManager = user?.role === "MANAGER" || user?.role === "ADMIN";
  const authorizationToken = isLoggedInManager ? token : managerAccessToken;
  const myRole = ((isLoggedInManager ? user?.role : managerAccessUser?.role) ?? "EMPLOYEE") as Role;
  const isAdmin = myRole === "ADMIN";
  const isManager = myRole === "MANAGER";

  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_URL, []);
  const authHeader = useMemo(
    () => ({
      Authorization: `Bearer ${authorizationToken}`,
    }),
    [authorizationToken]
  );

  const [items, setItems] = useState<Emp[]>([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [name, setName] = useState("");
  const [role, setRole] = useState<StaffRole>("EMPLOYEE");
  const [pin, setPin] = useState("");
  const [phone, setPhone] = useState("");

  const [saving, setSaving] = useState(false);

  function setErr(msg: string | null) {
    setError(msg);
    if (msg) {
      // auto-clear after a bit so UI feels clean
      setTimeout(() => setError(null), 4500);
    }
  }

  async function loadEmployees() {
    if (!apiBase) return setErr("API URL missing (NEXT_PUBLIC_API_URL).");
    if (!authorizationToken) return setErr("Manager authorization is required.");

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBase}/employees`, {
        headers: { ...authHeader },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || "Failed to load employees");

      setItems(data.items ?? []);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, authorizationToken]);

  async function createEmployee() {
    setError(null);

    if (!name.trim()) return setErr("Name is required.");
    if (!/^\d{4}$/.test(pin.trim())) return setErr("PIN must be exactly 4 digits.");

    if (isManager && role === "MANAGER") {
      return setErr("Only ADMIN can create managers.");
    }

    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/employees`, {
        method: "POST",
        headers: {
          ...authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          role,
          pin: pin.trim(),
          phone: phone.trim() || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.message || "Failed to create employee");
      }

      setName("");
      setPin("");
      setPhone("");
      setRole("EMPLOYEE");

      await loadEmployees();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(emp: Emp) {
    setError(null);
    try {
      const res = await fetch(`${apiBase}/employees/${emp.id}`, {
        method: "PATCH",
        headers: {
          ...authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive: !emp.isActive }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || "Failed to update employee");

      await loadEmployees();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error");
    }
  }

  async function resetPin(emp: Emp) {
    const newPin = prompt(`Reset PIN for ${emp.name}\nEnter NEW 4-digit PIN:`) ?? "";
    const clean = newPin.trim();

    if (!clean) return;
    if (!/^\d{4}$/.test(clean)) return setErr("PIN must be exactly 4 digits.");

    setError(null);
    try {
      const res = await fetch(`${apiBase}/employees/${emp.id}`, {
        method: "PATCH",
        headers: {
          ...authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pin: clean }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || "Failed to reset PIN");

      await loadEmployees();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error");
    }
  }

  async function deleteEmployee(emp: Emp) {
    if (!isAdmin) return setErr("Only ADMIN can delete employees.");

    const ok = confirm(`Delete ${emp.name}? This cannot be undone.`);
    if (!ok) return;

    setError(null);
    try {
      const res = await fetch(`${apiBase}/employees/${emp.id}`, {
        method: "DELETE",
        headers: { ...authHeader },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || "Failed to delete employee");

      await loadEmployees();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error");
    }
  }

  if (!authorizationToken) {
    return (
      <main className="posWrap">
        <div className="summaryError">Manager authorization is required.</div>
        <button
          className="posModalBtnGhost"
          onClick={() => {
            clearManagerAccess();
            router.push("/pos");
          }}
          type="button"
        >
          Back to POS
        </button>
      </main>
    );
  }

  return (
    <main className="posWrap">
      {/* Header row */}
      <div className="mgrTopRow">
        <div>
          <div className="mgrTitle">Employees</div>
          <div className="mgrSub">
            Create staff with unique 4-digit PIN login. Disable staff anytime.
          </div>
        </div>

        <div className="mgrTopActions">
          <button
            className="posModalBtnGhost"
            onClick={() => {
              clearManagerAccess();
              router.push("/pos");
            }}
            type="button"
          >
            ← Back to POS
          </button>
          <button className="posModalBtnGhost" onClick={loadEmployees} type="button">
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && <div className="summaryError">{error}</div>}

      {/* Create card */}
      <section className="summaryCard">
        <div className="summaryHeader">
          <div className="summaryTitle">Add Staff</div>
        </div>

        <div className="empFormGrid">
          <div className="empField">
            <label className="empLabel">Name</label>
            <input
              className="posModalInput"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="empField">
            <label className="empLabel">Role</label>
            <select
              className="posModalInput"
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
              disabled={isManager}
              title={isManager ? "Managers cannot create MANAGER accounts" : ""}
            >
              <option value="EMPLOYEE">EMPLOYEE</option>
              <option value="MANAGER">MANAGER</option>
            </select>
          </div>

          <div className="empField">
            <label className="empLabel">4-digit PIN</label>
            <input
              className="posModalInput"
              placeholder="1234"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          </div>

          <div className="empField">
            <label className="empLabel">Phone (optional)</label>
            <input
              className="posModalInput"
              placeholder="905-xxx-xxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="empCreateBtnWrap">
            <button
              className="posModalBtnPrimary empCreateBtn"
              onClick={createEmployee}
              type="button"
              disabled={saving}
            >
              {saving ? "Saving..." : "Create Staff"}
            </button>

            <div className="empHint">
              {isAdmin
                ? "Admin can create employees + managers, reset PIN, disable or delete."
                : "Manager can create employees, disable employees, reset employee PIN."}
            </div>
          </div>
        </div>
      </section>

      {/* List card */}
      <section className="summaryCard">
        <div className="summaryHeader">
          <div className="summaryTitle">Staff List</div>
          <div className="empCountPill">{loading ? "…" : items.length}</div>
        </div>

        {loading ? (
          <div className="summaryLoading">Loading staff…</div>
        ) : items.length === 0 ? (
          <div className="summaryLoading">No staff found.</div>
        ) : (
          <div className="empList">
            {items.map((emp) => (
              <div key={emp.id} className={`empRow ${emp.isActive ? "" : "empRowDisabled"}`}>
                <div className="empMain">
                  <div className="empNameRow">
                    <div className="empName">{emp.name}</div>
                    <span className={`empRoleBadge empRole_${emp.role}`}>{emp.role}</span>
                    <span className={`empStatusBadge ${emp.isActive ? "on" : "off"}`}>
                      {emp.isActive ? "Active" : "Disabled"}
                    </span>
                  </div>

                  <div className="empMeta">
                    {emp.phone ? <span>📞 {emp.phone}</span> : <span className="empMetaDim">No phone</span>}
                    {emp.updatedAt ? (
                      <span className="empMetaDim">Updated: {new Date(emp.updatedAt).toLocaleString()}</span>
                    ) : (
                      <span className="empMetaDim">—</span>
                    )}
                  </div>
                </div>

                <div className="empActions">
                  <button
                    className="posModalBtnGhost"
                    onClick={() => toggleActive(emp)}
                    type="button"
                  >
                    {emp.isActive ? "Disable" : "Enable"}
                  </button>

                  <button
                    className="posModalBtnGhost"
                    onClick={() => resetPin(emp)}
                    type="button"
                    disabled={isManager && emp.role !== "EMPLOYEE"}
                    title={isManager && emp.role !== "EMPLOYEE" ? "Managers can only reset EMPLOYEE PIN" : ""}
                  >
                    Reset PIN
                  </button>

                  <button
                    className="posModalBtnGhost empDeleteBtn"
                    onClick={() => deleteEmployee(emp)}
                    type="button"
                    disabled={!isAdmin}
                    title={!isAdmin ? "Only ADMIN can delete users" : "Delete user"}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
