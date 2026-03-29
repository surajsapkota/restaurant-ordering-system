"use client";

import Image from "next/image";
import "./login.css";
import { motion } from "framer-motion";
import EmployeeLoginForm from "@/components/auth/EmployeeLoginForm";
import AdminLoginForm from "@/components/auth/AdminLoginForm";

export default function LoginPage() {
  return (
    <main className="shell">

      {/* ── LEFT — Employee ── */}
      <section className="left">

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

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08 }}
        >
          <div className="eyebrow">Staff Portal</div>
          <h1 className="title">Employee<br />Login</h1>
          <p className="subtitle">Enter your code and PIN to start taking orders.</p>
        </motion.div>

        <motion.div
          className="card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.15 }}
        >
          <EmployeeLoginForm />
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