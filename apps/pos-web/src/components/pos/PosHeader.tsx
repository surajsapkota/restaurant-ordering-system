"use client";

import { useAuthStore } from "@/lib/auth/authstore";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type ModalStep = "CLOSED" | "MANAGER_PIN" | "MANAGER_PANEL" | "ADMIN_PIN" | "MY_REPORT" | "CLOCK_OUT_CONFIRM" | "CLOCK_OUT_PREVIEW";
type Role = "ADMIN" | "MANAGER" | "EMPLOYEE";

export default function PosHeader() {
  const router = useRouter();
  const { user, clearAuth, token } = useAuthStore() as any;

  const role = (user?.role ?? "EMPLOYEE") as Role;
  const isAdminLoggedIn = role === "ADMIN";
  const isManagerLoggedIn = role === "MANAGER";

  const [time, setTime] = useState("");
  const [step, setStep] = useState<ModalStep>("CLOSED");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinLoading, setPinLoading] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);

  const [clockOutCode, setClockOutCode] = useState("");
  const [clockOutError, setClockOutError] = useState<string | null>(null);
  const [clockOutLoading, setClockOutLoading] = useState(false);
  const [clockOutSession, setClockOutSession] = useState<any>(null);

  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_URL, []);

  useEffect(() => {
    const update = () =>
      setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);

  function resetPinState() {
    setPin("");
    setPinError(null);
    setPinLoading(false);
  }

  function closeModal() {
    setStep("CLOSED");
    resetPinState();
  }

  function openManager() {
    resetPinState();
    if (isAdminLoggedIn || isManagerLoggedIn) {
      setStep("MANAGER_PANEL");
      return;
    }
    setStep("MANAGER_PIN");
  }

  async function verifyPin(requiredRole: "MANAGER" | "ADMIN") {
    setPinError(null);
    const clean = pin.trim();
    if (!clean) { setPinError("Please enter the code."); return; }
    if (!apiBase) { setPinError("API URL not configured."); return; }

    setPinLoading(true);
    try {
      const res = await fetch(`${apiBase}/auth/verify-pin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ pin: clean, requiredRole }),
      });

      if (!res.ok) { setPinError("Invalid code."); return; }

      if (requiredRole === "MANAGER") {
        resetPinState();
        setStep("MANAGER_PANEL");
      } else {
        setAdminUnlocked(true);
        resetPinState();
        setStep("MANAGER_PANEL");
      }
    } catch {
      setPinError("Network error. Try again.");
    } finally {
      setPinLoading(false);
    }
  }

  async function downloadTimesheet() {
    if (!clockOutSession) return;

    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: [80, 120] });

    const loginTime = new Date(clockOutSession.loginAt).toLocaleString();
    const logoutTime = new Date(clockOutSession.logoutAt).toLocaleString();
    const hours = Math.floor(clockOutSession.workedMinutes / 60);
    const mins = clockOutSession.workedMinutes % 60;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Bombay to Mumbai", 40, 12, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Employee Timesheet", 40, 20, { align: "center" });

    doc.setLineWidth(0.3);
    doc.line(5, 24, 75, 24);

    doc.setFont("helvetica", "bold");
    doc.text("Employee:", 5, 32);
    doc.setFont("helvetica", "normal");
    doc.text(user?.name ?? "Unknown", 35, 32);

    doc.setFont("helvetica", "bold");
    doc.text("Date:", 5, 40);
    doc.setFont("helvetica", "normal");
    doc.text(new Date().toLocaleDateString(), 35, 40);

    doc.setFont("helvetica", "bold");
    doc.text("Clock In:", 5, 48);
    doc.setFont("helvetica", "normal");
    doc.text(loginTime, 35, 48);

    doc.setFont("helvetica", "bold");
    doc.text("Clock Out:", 5, 56);
    doc.setFont("helvetica", "normal");
    doc.text(logoutTime, 35, 56);

    doc.line(5, 62, 75, 62);

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Total Hours:", 5, 70);
    doc.text(`${hours}h ${mins}m`, 50, 70);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Thank you for your work today!", 40, 82, { align: "center" });

    doc.save(`timesheet-${user?.name}-${new Date().toLocaleDateString()}.pdf`);
  }

  return (
    <header className="posHeader">
      <div>
        <div className="posTitle">Bombay to Mumbai — POS</div>
        <div className="posUser">Logged in as <b>{role ?? "USER"}</b></div>
      </div>

      <div className="posHeaderRight">
        <div className="posTime">
          <span>LOCAL TIME</span>
          <strong>{time}</strong>
        </div>

        {(isAdminLoggedIn || isManagerLoggedIn) && (
          <button className="managerBtn" onClick={openManager} type="button">
            Manager
          </button>
        )}

        <button className="reportBtn" onClick={() => setStep("MY_REPORT")} type="button">
          My Report
        </button>

        <button
          className="logoutBtn"
          onClick={async () => {
            try {
              await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
              });
            } catch { }
            clearAuth();
            router.push("/login");
          }}
          type="button"
        >
          Logout
        </button>
      </div>

      {/* ===== MODAL OVERLAY ===== */}
      {step !== "CLOSED" && (
        <div
          className="posModalOverlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="posModalCard">

            {/* MODAL TITLE */}
            <div className="posModalHeader">
              <div className="posModalTitle">
                {step === "MANAGER_PIN" && "Manager Access"}
                {step === "ADMIN_PIN" && "Admin Access"}
                {step === "MANAGER_PANEL" && "Manager Control Panel"}
                {step === "MY_REPORT" && "My Report"}
                {step === "CLOCK_OUT_CONFIRM" && "Clock Out"}
                {step === "CLOCK_OUT_PREVIEW" && "Timesheet Preview"}
              </div>
              <button className="posModalClose" onClick={closeModal} type="button">✕</button>
            </div>

            {/* MANAGER PIN */}
            {step === "MANAGER_PIN" && (
              <>
                <p className="posModalText">Enter the manager code to open controls.</p>
                <input
                  className="posModalInput"
                  inputMode="numeric"
                  placeholder="Enter manager code"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") verifyPin("MANAGER"); }}
                  autoFocus
                />
                {pinError && <div className="posModalError">{pinError}</div>}
                <div className="posModalActions">
                  <button className="posModalBtnGhost" onClick={closeModal} type="button">Cancel</button>
                  <button className="posModalBtnPrimary" onClick={() => verifyPin("MANAGER")} type="button" disabled={pinLoading}>
                    {pinLoading ? "Checking..." : "Continue"}
                  </button>
                </div>
              </>
            )}

            {/* ADMIN PIN */}
            {step === "ADMIN_PIN" && (
              <>
                <p className="posModalText">Admin features need a separate admin code.</p>
                <input
                  className="posModalInput"
                  inputMode="numeric"
                  placeholder="Enter admin code"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") verifyPin("ADMIN"); }}
                  autoFocus
                />
                {pinError && <div className="posModalError">{pinError}</div>}
                <div className="posModalActions">
                  <button className="posModalBtnGhost" onClick={() => { resetPinState(); setStep("MANAGER_PANEL"); }} type="button">Back</button>
                  <button className="posModalBtnPrimary" onClick={() => verifyPin("ADMIN")} type="button" disabled={pinLoading}>
                    {pinLoading ? "Checking..." : "Unlock Admin"}
                  </button>
                </div>
              </>
            )}

            {/* MANAGER PANEL */}
            {step === "MANAGER_PANEL" && (
              <>
                <div className="posModalGrid">
                  <button className="posModalTile" onClick={() => { closeModal(); router.push("/pos/manager/shift"); }} type="button">
                    <div className="tileTitle">Shift</div>
                    <div className="tileSub">Open / close shift, cash in/out</div>
                  </button>
                  <button className="posModalTile" onClick={() => { closeModal(); router.push("/pos/manager/employees"); }} type="button">
                    <div className="tileTitle">Employees</div>
                    <div className="tileSub">Add / remove employees, login codes</div>
                  </button>
                  <button className="posModalTile" onClick={() => { closeModal(); router.push("/pos/manager/menu"); }} type="button">
                    <div className="tileTitle">Menu</div>
                    <div className="tileSub">Add / update items, price, picture, description</div>
                  </button>
                  <button className="posModalTile" onClick={() => { closeModal(); router.push("/pos/manager/reports"); }} type="button">
                    <div className="tileTitle">Sales History</div>
                    <div className="tileSub">Date range totals, taxes, net, gross</div>
                  </button>
                  {!adminUnlocked && !isAdminLoggedIn ? (
                    <button className="posModalTile" onClick={() => { setPin(""); setPinError(null); setStep("ADMIN_PIN"); }} type="button">
                      <div className="tileTitle">Admin Access</div>
                      <div className="tileSub">Requires admin code</div>
                    </button>
                  ) : (
                    <button className="posModalTile" onClick={() => { closeModal(); router.push("/admin"); }} type="button">
                      <div className="tileTitle">Admin Dashboard</div>
                      <div className="tileSub">Full controls (admin-only)</div>
                    </button>
                  )}
                </div>
                <div className="posModalActions">
                  <button className="posModalBtnGhost" onClick={closeModal} type="button">Close</button>
                </div>
              </>
            )}

            {/* MY REPORT PANEL */}
            {step === "MY_REPORT" && (
              <>
                <div className="posModalGrid">
                  <button className="posModalTile" type="button">
                    <div className="tileTitle">My Transactions</div>
                    <div className="tileSub">Orders I took today</div>
                  </button>

                  <button
                    className="posModalTile"
                    type="button"
                    onClick={() => {
                      setClockOutCode("");
                      setClockOutError(null);
                      setClockOutSession(null);
                      setStep("CLOCK_OUT_CONFIRM");
                    }}
                  >
                    <div className="tileTitle">Clock Out</div>
                    <div className="tileSub">Logout and print timesheet</div>
                  </button>

                  <button className="posModalTile" type="button">
                    <div className="tileTitle">Tips Took Today</div>
                    <div className="tileSub">Tips earned today</div>
                  </button>

                  <button className="posModalTile" type="button">
                    <div className="tileTitle">Reservation</div>
                    <div className="tileSub">View reservations</div>
                  </button>

                  <button className="posModalTile" type="button">
                    <div className="tileTitle">Transfer All</div>
                    <div className="tileSub">Transfer all my tables</div>
                  </button>

                  <button className="posModalTile" type="button">
                    <div className="tileTitle">My View</div>
                    <div className="tileSub">My active tables</div>
                  </button>

                  <button className="posModalTile" type="button">
                    <div className="tileTitle">My Shift Report</div>
                    <div className="tileSub">Summary of my shift</div>
                  </button>

                  <button className="posModalTile" type="button">
                    <div className="tileTitle">Print Split / Combine Check</div>
                    <div className="tileSub">Split or combine bills</div>
                  </button>
                </div>
                <div className="posModalActions">
                  <button className="posModalBtnGhost" onClick={closeModal} type="button">Close</button>
                </div>
              </>
            )}

            {/* CLOCK OUT CONFIRM */}
            {step === "CLOCK_OUT_CONFIRM" && (
              <>
                <p className="posModalText">Enter your employee code to confirm clock out.</p>
                <input
                  className="posModalInput"
                  inputMode="numeric"
                  placeholder="e.g. 2001"
                  value={clockOutCode}
                  onChange={(e) => setClockOutCode(e.target.value)}
                  autoFocus
                />
                {clockOutError && <div className="posModalError">{clockOutError}</div>}
                <div className="posModalActions">
                  <button className="posModalBtnGhost" onClick={() => setStep("MY_REPORT")} type="button">
                    Back
                  </button>
                  <button
                    className="posModalBtnPrimary"
                    type="button"
                    disabled={clockOutLoading}
                    onClick={async () => {
                      setClockOutError(null);
                      if (!clockOutCode.trim()) {
                        setClockOutError("Please enter your employee code.");
                        return;
                      }
                      if (clockOutCode.trim() !== user?.employeeCode) {
                        setClockOutError("Employee code does not match.");
                        return;
                      }
                      setClockOutLoading(true);
                      try {
                        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
                          method: "POST",
                          headers: { Authorization: `Bearer ${token}` },
                        });
                        if (!res.ok) throw new Error("Logout failed");
                        const data = await res.json();
                        setClockOutSession(data.session);
                        setStep("CLOCK_OUT_PREVIEW");
                      } catch {
                        setClockOutError("Could not clock out. Try again.");
                      } finally {
                        setClockOutLoading(false);
                      }
                    }}
                  >
                    {clockOutLoading ? "Checking..." : "Continue"}
                  </button>
                </div>
              </>
            )}

            {/* CLOCK OUT PREVIEW */}
            {step === "CLOCK_OUT_PREVIEW" && clockOutSession && (
              <>
                <p className="posModalText">Review your timesheet before downloading.</p>
                <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 800 }}>
                    <span style={{ color: "rgba(0,0,0,0.6)" }}>Employee</span>
                    <span>{user?.name}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 800 }}>
                    <span style={{ color: "rgba(0,0,0,0.6)" }}>Date</span>
                    <span>{new Date().toLocaleDateString()}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 800 }}>
                    <span style={{ color: "rgba(0,0,0,0.6)" }}>Clock In</span>
                    <span>{new Date(clockOutSession.loginAt).toLocaleTimeString()}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 800 }}>
                    <span style={{ color: "rgba(0,0,0,0.6)" }}>Clock Out</span>
                    <span>{new Date(clockOutSession.logoutAt).toLocaleTimeString()}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 950, borderTop: "1px solid rgba(0,0,0,0.1)", paddingTop: 8, marginTop: 4 }}>
                    <span>Total Hours</span>
                    <span>{Math.floor(clockOutSession.workedMinutes / 60)}h {clockOutSession.workedMinutes % 60}m</span>
                  </div>
                </div>
                <div className="posModalActions">
                  <button
                    className="posModalBtnPrimary"
                    type="button"
                    onClick={async () => {
                      await downloadTimesheet();
                      clearAuth();
                      router.push("/login");
                    }}
                  >
                    Download & Clock Out
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </header>
  );
}