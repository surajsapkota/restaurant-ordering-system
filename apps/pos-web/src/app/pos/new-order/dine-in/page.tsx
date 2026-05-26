"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import DineInTablePanel from "@/components/pos/DineInTablePanel";
import "./dineIn.css";

export default function DineInPage() {
  const router = useRouter();

  return (
    <main className="dineShell">
      <div className="dineWrap">
        <header className="dineHeader">
          <div>
            <div className="dineKicker">DINE-IN</div>
            <h1 className="dineTitle">Select Table</h1>
            <p className="dineSub">Choose a table and guest count to continue</p>
          </div>

          <button className="dineBackBtn" onClick={() => router.push("/pos")}>
            <ArrowLeft size={16} />
            Back
          </button>
        </header>

        <DineInTablePanel />
      </div>
    </main>
  );
}
