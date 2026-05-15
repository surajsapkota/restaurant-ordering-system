"use client";

import Image from "next/image";
import "./login.css";
import { motion } from "framer-motion";
import { useState } from "react";
import EmployeeLoginForm from "@/components/auth/EmployeeLoginForm";
import AdminLoginForm from "@/components/auth/AdminLoginForm";

export default function LoginPage() {
  const [mobileMode, setMobileMode] = useState<"staff" | "admin">("staff");
  const isAdminMobile = mobileMode === "admin";

  return (
    <main className="shell">

      {/* ── LEFT — Employee ── */}
      <section className={`left ${isAdminMobile ? "adminMobile" : ""}`}>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="logoBox">
            <Image
              src="/branding/logo.png"
              alt="Bombay to Mumbai"
              width={180}
              height={58}
              priority
              className="logoImg"
            />
          </div>
        </motion.div>

        <div className="mobileLoginSwitch" aria-label="Login type">
          <button
            type="button"
            className={mobileMode === "staff" ? "active" : ""}
            onClick={() => setMobileMode("staff")}
          >
            Staff
          </button>
          <button
            type="button"
            className={mobileMode === "admin" ? "active" : ""}
            onClick={() => setMobileMode("admin")}
          >
            Admin
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08 }}
        >
          <div className="eyebrow">{isAdminMobile ? "Admin Portal" : "Staff Portal"}</div>
          <h1 className="title">
            {isAdminMobile ? (
              <>
                Admin
                <br />
                Login
              </>
            ) : (
              <>
                Employee
                <br />
                Login
              </>
            )}
          </h1>
          <p className="subtitle">
            {isAdminMobile
              ? "Use your admin credentials for reports, staff, and menu controls."
              : "Enter your code and PIN to start taking orders."}
          </p>
        </motion.div>

        <motion.div
          className="card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.15 }}
        >
          {isAdminMobile ? <AdminLoginForm /> : <EmployeeLoginForm />}
        </motion.div>

        <motion.p
          className="footer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          © {new Date().getFullYear()} Bombay to Mumbai · POS & Ordering System
        </motion.p>
      </section>

      {/* ── RIGHT — Admin ── */}
      <section className="right">

        {/* Decorative spice circles */}
        <div className="deco deco1" />
        <div className="deco deco2" />
        <div className="deco deco3" />

        <motion.div
          className="adminPanel"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="adminTop">
            <div className="lockIcon">🔐</div>
            <div className="heroBadge">ADMIN ACCESS</div>
          </div>

          <h2 className="heroTitle">Admin Login</h2>
          <p className="heroText">
            Restricted access for managers & administrators.<br />
            Use your email and password.
          </p>

          <div className="adminDivider" />

          <div className="adminCardWrap">
            <AdminLoginForm />
          </div>

          <div className="chips">
            <span className="chip">📊 Reports</span>
            <span className="chip">🍽 Menu Control</span>
            <span className="chip">👥 Staff Access</span>
          </div>
        </motion.div>
      </section>

    </main>
  );
}
