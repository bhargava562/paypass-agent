"use client";

import React, { useEffect, useState } from "react";
import {
  AlertOctagon,
  CheckCircle2,
  CreditCard,
  Lock,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  X,
} from "lucide-react";
import { Product, SimulationRunState } from "@/data/catalog";

export type CheckoutDriver =
  | { type: "human"; items: Product[]; source: "cart" | "buy_now" }
  | { type: "agent"; simulation: SimulationRunState };

interface StoreCheckoutModalProps {
  driver: CheckoutDriver | null;
  onClose: () => void;
  onHumanPaySuccess: (
    items: Product[],
    method: "paypal" | "card",
    source: "cart" | "buy_now",
    orderId: string
  ) => void;
  isSettlingOverride: boolean;
  onApproveOverride: () => void;
  onRejectOverride: () => void;
}

export function StoreCheckoutModal(props: StoreCheckoutModalProps) {
  if (!props.driver) return null;
  const modalKey =
    props.driver.type === "human"
      ? `human-${props.driver.items.map((i) => i.id).join("-")}`
      : `agent-${props.driver.simulation.prompt}-${props.driver.simulation.mode}`;
  return <StoreCheckoutModalContent key={modalKey} {...props} driver={props.driver} />;
}

function StoreCheckoutModalContent({
  driver,
  onClose,
  onHumanPaySuccess,
  isSettlingOverride,
  onApproveOverride,
  onRejectOverride,
}: Omit<StoreCheckoutModalProps, "driver"> & { driver: CheckoutDriver }) {
  const [humanName, setHumanName] = useState("Alex Rivera");
  const [humanEmail, setHumanEmail] = useState("alex.rivera@example.com");
  const [humanAddress, setHumanAddress] = useState(
    "742 Evergreen Terrace, Austin, TX 78701"
  );
  const [humanConfirmedOrderId, setHumanConfirmedOrderId] = useState<
    string | null
  >(null);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  if (driver.type === "human") {
    const total = driver.items.reduce((s, item) => s + item.price, 0);

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-modal-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4 backdrop-blur-xs"
        onClick={onClose}
      >
        <div
          className="w-full max-w-lg rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                NovaTech Secure Checkout
              </span>
              <h2
                id="checkout-modal-title"
                className="font-display text-lg font-bold text-[#09090B]"
              >
                Complete Your Order
              </h2>
            </div>
            <button
              type="button"
              aria-label="Close checkout"
              onClick={onClose}
              className="cursor-pointer rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {humanConfirmedOrderId ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
              <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" />
              <h3 className="mt-2 font-display text-base font-bold text-emerald-950">
                Order Confirmed
              </h3>
              <p className="mt-1 text-xs text-emerald-800">
                Shipping to {humanName} · {humanAddress}
              </p>
              <p className="mt-2 font-mono text-xs font-semibold text-emerald-900">
                Order ID: {humanConfirmedOrderId}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 cursor-pointer rounded-xl bg-[#09090B] px-5 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
              >
                Continue Shopping
              </button>
            </div>
          ) : (
            <>
              <div className="mb-4 space-y-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-3.5">
                {driver.items.map((item, idx) => (
                  <div
                    key={`${item.id}-${idx}`}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="font-medium text-[#09090B]">
                      {item.name}
                    </span>
                    <span className="font-mono font-semibold text-[#09090B]">
                      ${item.price.toFixed(2)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-zinc-200 pt-2 text-sm font-bold">
                  <span>Total</span>
                  <span className="font-mono">${total.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-2.5">
                <div>
                  <label
                    htmlFor="human-name"
                    className="mb-1 block text-[11px] font-medium text-zinc-600"
                  >
                    Full Name
                  </label>
                  <input
                    id="human-name"
                    type="text"
                    value={humanName}
                    onChange={(e) => setHumanName(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-xs text-[#09090B]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="human-email"
                    className="mb-1 block text-[11px] font-medium text-zinc-600"
                  >
                    Email Address
                  </label>
                  <input
                    id="human-email"
                    type="email"
                    value={humanEmail}
                    onChange={(e) => setHumanEmail(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-xs text-[#09090B]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="human-address"
                    className="mb-1 block text-[11px] font-medium text-zinc-600"
                  >
                    Shipping Address
                  </label>
                  <input
                    id="human-address"
                    type="text"
                    value={humanAddress}
                    onChange={(e) => setHumanAddress(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-xs text-[#09090B]"
                  />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const id = `NT-PAY-${Date.now().toString().slice(-6)}`;
                    setHumanConfirmedOrderId(id);
                    onHumanPaySuccess(driver.items, "paypal", driver.source, id);
                  }}
                  className="cursor-pointer rounded-xl bg-[#0070E0] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#003087]"
                >
                  Pay with PayPal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const id = `NT-CRD-${Date.now().toString().slice(-6)}`;
                    setHumanConfirmedOrderId(id);
                    onHumanPaySuccess(driver.items, "card", driver.source, id);
                  }}
                  className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#09090B] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-zinc-800"
                >
                  <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
                  Pay with Card
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // External Agent Driving NovaTech's Store Checkout Modal
  const { simulation } = driver;
  const isGhostPass = simulation.mode === "ghostpass";
  const isPending = simulation.stage !== "complete";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="agent-checkout-title"
      className="fixed inset-0 z-35 flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              <Lock className="h-3 w-3" />
              NovaTech Checkout · Automated Session
            </span>
            <h2
              id="agent-checkout-title"
              className="font-display text-lg font-bold text-[#09090B]"
            >
              {simulation.selectedProduct?.name ?? "Preparing Order"}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close checkout modal"
            onClick={onClose}
            className="cursor-pointer rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Cart Summary Inside Store Modal */}
        <div className="mb-4 space-y-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-3.5 text-xs">
          {simulation.selectedProduct && (
            <div className="flex items-center justify-between">
              <span className="font-medium text-[#09090B]">
                {simulation.selectedProduct.name}
              </span>
              <span className="font-mono font-semibold text-[#09090B]">
                ${simulation.selectedProduct.price.toFixed(2)}
              </span>
            </div>
          )}
          {simulation.injectedProduct && (
            <div className="flex items-center justify-between rounded-lg bg-rose-50 px-2 py-1 text-rose-700">
              <span className="font-medium">
                + Injected: {simulation.injectedProduct.name}
              </span>
              <span className="font-mono font-semibold">
                ${simulation.injectedProduct.price.toFixed(2)}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-zinc-200 pt-2 font-bold">
            <span>Checkout Total</span>
            <span className="font-mono text-sm">
              ${simulation.proposedTotal.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Shipping & Identity Fields Received by Store */}
        <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-3.5 text-xs">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold text-zinc-700">
              Buyer &amp; Shipping Payload
            </span>
            {isGhostPass ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#0070E0]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#003087]">
                <ShieldCheck className="h-3 w-3 text-[#0070E0]" />
                X-PayPal-GhostPass
              </span>
            ) : (
              <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700">
                Unverified Bot Scraper
              </span>
            )}
          </div>
          <div className="space-y-1 font-mono text-[11px] text-zinc-600">
            <p>
              Buyer: {simulation.agentContextPreview.buyerName} (
              {simulation.agentContextPreview.buyerEmail})
            </p>
            <p>Ship To: {simulation.agentContextPreview.shippingAddr}</p>
          </div>
        </div>

        {/* Live Store Guard / Settlement Status */}
        {isPending ? (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-center text-xs font-medium text-sky-900">
            Executing cross-boundary checkout verification...
          </div>
        ) : simulation.verdict === "403_REJECTED" ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <div className="flex items-start gap-2.5">
              <AlertOctagon className="h-5 w-5 shrink-0 text-rose-600" />
              <div>
                <h3 className="text-xs font-bold text-rose-900">
                  HTTP 403 Forbidden · Unverified AI Scraper Blocked
                </h3>
                <p className="mt-1 text-xs text-rose-700">
                  NovaTech anti-bot defense rejected this session because it
                  carried raw user PII without a verified PayPal Human Mandate
                  signature.
                </p>
              </div>
            </div>
          </div>
        ) : simulation.verdict === "BLOCKED" ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="h-5 w-5 shrink-0 text-rose-600" />
              <div>
                <h3 className="text-xs font-bold text-rose-900">
                  GhostPass Blocked Checkout ($0.00 Moved)
                </h3>
                <p className="mt-1 text-xs text-rose-700">
                  {simulation.gatekeeperNotes[0]}
                </p>
              </div>
            </div>
          </div>
        ) : simulation.verdict === "NEEDS_APPROVAL" ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-2.5">
              <UserCheck className="h-5 w-5 shrink-0 text-amber-600" />
              <div className="flex-1">
                <h3 className="text-xs font-bold text-amber-950">
                  Paused for 1-Click Human Override
                </h3>
                <p className="mt-1 text-xs text-amber-800">
                  Order exceeds your spending rule cap, but passed all safety
                  and prompt-injection checks.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={isSettlingOverride}
                    onClick={onApproveOverride}
                    className="flex-1 cursor-pointer rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Approve ${simulation.proposedTotal.toFixed(2)}
                  </button>
                  <button
                    type="button"
                    disabled={isSettlingOverride}
                    onClick={onRejectOverride}
                    className="cursor-pointer rounded-xl border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <h3 className="text-xs font-bold text-emerald-950">
                  Verified &amp; Settled via PayPal GhostPass
                </h3>
                <p className="mt-1 text-xs text-emerald-800">
                  Shipping address relayed directly from PayPal Vault to
                  NovaTech. 0% PII exposed to the AI agent.
                </p>
                {simulation.paypalOrderId && (
                  <p className="mt-2 font-mono text-xs font-semibold text-emerald-900">
                    Receipt / Order ID: {simulation.paypalOrderId}
                    {simulation.verificationHash
                      ? ` · Hash ${simulation.verificationHash}`
                      : ""}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
