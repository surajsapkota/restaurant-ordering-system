"use client";

import Image from "next/image";
import LoginForm from "@/components/LoginForm";
import "./login.css";
import { motion } from "framer-motion";

export default function LoginPage() {
  return (
    <main className="shell">
      {/* LEFT SIDE */}
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
          Bombay to Mumbai POS
        </motion.h1>

        <motion.p
          className="subtitle"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1 }}
        >
          Staff login for POS + secure admin dashboard — built for Indian & Hakka service.
        </motion.p>

        {/* Card animation */}
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, delay: 0.15 }}
          whileHover={{ y: -2 }}
        >
          <LoginForm />
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

      {/* RIGHT SIDE */}
      <section className="right">
        <Image src="/branding/hero.jpg" alt="Food" fill priority className="heroImg" />

        <motion.div
          className="heroContent"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="heroBadge">BOMBAY TO MUMBAI</div>
          <h2 className="heroTitle">Fast ordering. Smooth service.</h2>
          <p className="heroText">
            Built for high-energy kitchens — quick PIN sign-in, clean order flow, and secure admin tools.
          </p>
          <div className="chips">
            <span className="chip">POS Mode</span>
            <span className="chip">Admin Mode</span>
            <span className="chip">Online Ordering (later)</span>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
