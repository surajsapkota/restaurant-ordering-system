"use client";

import { useRouter } from "next/navigation";
import "./newOrder.css";
import { ArrowLeft, ArrowRight, Utensils, ShoppingBag, Bike } from "lucide-react";

export default function NewOrderTypePage() {
  const router = useRouter();

  return (
    <main className="newOrderShell">
      <div className="newOrderWrap">
        {/* Header */}
        <header className="newOrderHeader">
          <div className="newOrderHeaderLeft">
            <div className="newOrderKicker">ORDER FLOW</div>
            <h1 className="newOrderTitle">New Order</h1>
            <p className="newOrderSub">Choose order type to continue</p>
          </div>

          <button
            type="button"
            className="backBtn"
            onClick={() => router.push("/pos")}
            aria-label="Back to POS Home"
          >
            <ArrowLeft size={16} />
            Back
          </button>
        </header>

        {/* Cards */}
        <section className="typeGrid">
          <button
            type="button"
            className="typeCard typeCardPrimary"
            onClick={() => router.push("/pos/new-order/dine-in")}
          >
            <div className="typeIcon typeIconPrimary">
              <Utensils size={20} />
            </div>

            <div className="typeText">
              <div className="typeName">Dine-In</div>
              <div className="typeDesc">Table + guests required</div>
            </div>

            <div className="typeArrowWrap">
              <ArrowRight className="typeArrow" size={18} />
            </div>
          </button>

          <button
            type="button"
            className="typeCard"
            onClick={() => router.push("/pos/new-order/takeout")}
          >
            <div className="typeIcon">
              <ShoppingBag size={20} />
            </div>

            <div className="typeText">
              <div className="typeName">Takeout</div>
              <div className="typeDesc">Customer phone required</div>
            </div>

            <div className="typeArrowWrap">
              <ArrowRight className="typeArrow" size={18} />
            </div>
          </button>

          <button
            type="button"
            className="typeCard"
            onClick={() => router.push("/pos/new-order/delivery")}
          >
            <div className="typeIcon">
              <Bike size={20} />
            </div>

            <div className="typeText">
              <div className="typeName">Delivery</div>
              <div className="typeDesc">Phone + address required</div>
            </div>

            <div className="typeArrowWrap">
              <ArrowRight className="typeArrow" size={18} />
            </div>
          </button>
        </section>
      </div>
    </main>
  );
}
