"use client";

import Image from "next/image";
import "./login.css";
import { motion } from "framer-motion";

import EmployeeLoginForm from "@/components/auth/EmployeeLoginForm";
import AdminLoginForm from "@/components/auth/AdminLoginForm";

export default function LoginPage() {
  return (
    <main className="shell">
      {/* LEFT SIDE = EMPLOYEE */}
      <section className="left">
        <motion.div
          className="brandRow"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="logoBox">
            <Image
              src="/branding/logo.png"
              alt="Bombay to Mumbai"
              width={210}
              height={70}
              priority
              className="logoImg"
            />
          </div>
        </motion.div>

        <motion.h1
          className="title"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05 }}
        >
          Employee Login
        </motion.h1>

        <motion.p
          className="subtitle"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1 }}
        >
          Enter your PIN to start taking orders.
        </motion.p>

        {/* Employee card */}
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, delay: 0.15 }}
          whileHover={{ y: -2 }}
        >
          <EmployeeLoginForm />
        </motion.div>

        <motion.p
          className="footer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          © {new Date().getFullYear()} Bombay to Mumbai • POS & Ordering System
        </motion.p>
      </section>

      {/* RIGHT SIDE = ADMIN */}
      <section className="right">
        <Image src="/branding/hero.jpg" alt="Food" fill priority className="heroImg" />

        <motion.div
          className="heroContent"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="heroBadge">ADMIN ACCESS</div>
          <h2 className="heroTitle">Admin Login</h2>
          <p className="heroText">
            Restricted access for managers & administrators. Use your email and password.
          </p>

          {/* Admin form card inside the hero */}
          <div className="adminCardWrap">
            <AdminLoginForm />
          </div>

          <div className="chips">
            <span className="chip">Reports</span>
            <span className="chip">Menu Control</span>
            <span className="chip">Staff Access</span>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
