"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";

type ReservationData = {
  id: string;
  qty: number;
  status: "PENDING" | "CONFIRMED" | "RELEASED";
  expiresAt: string;
  product: { id: string; name: string; sku: string; price: number };
  warehouse: { id: string; name: string; location: string };
};

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    function tick() {
      const diff = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      setRemaining(Math.floor(diff / 1000));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const isUrgent = remaining < 60;

  if (remaining === 0) {
    return (
      <span className="text-red-500 dark:text-red-400 font-mono font-semibold">
        Expired
      </span>
    );
  }

  return (
    <span
      className={`font-mono font-semibold tabular-nums ${
        isUrgent ? "text-red-500 dark:text-red-400" : "text-gray-900 dark:text-gray-100"
      }`}
    >
      {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
    </span>
  );
}

export default function ReservationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [reservation, setReservation] = useState<ReservationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<"confirm" | "release" | null>(null);
  const [flash, setFlash] = useState<{ type: "error" | "success"; msg: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/reservations/${id}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to load reservation");
      }
      setReservation(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Poll every 15s to catch server-side expiry
  useEffect(() => {
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  async function confirm() {
    setActionLoading("confirm");
    setFlash(null);
    try {
      const res = await fetch(`/api/reservations/${id}/confirm`, { method: "POST" });
      const data = await res.json();
      if (res.status === 410) {
        setFlash({ type: "error", msg: "Reservation expired — the hold has been released." });
        await load();
        return;
      }
      if (!res.ok) {
        setFlash({ type: "error", msg: data.error ?? "Confirmation failed" });
        return;
      }
      await load();
      setFlash({ type: "success", msg: "Purchase confirmed! Your order is placed." });
    } catch {
      setFlash({ type: "error", msg: "Network error — please try again" });
    } finally {
      setActionLoading(null);
    }
  }

  async function release() {
    setActionLoading("release");
    setFlash(null);
    try {
      const res = await fetch(`/api/reservations/${id}/release`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setFlash({ type: "error", msg: data.error ?? "Cancellation failed" });
        return;
      }
      await load();
      setFlash({ type: "success", msg: "Reservation cancelled. Stock returned." });
    } catch {
      setFlash({ type: "error", msg: "Network error — please try again" });
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        Loading reservation…
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800 p-4 text-red-700 dark:text-red-300">
        {error ?? "Reservation not found"}
      </div>
    );
  }

  const isPending = reservation.status === "PENDING";
  const isConfirmed = reservation.status === "CONFIRMED";
  const isReleased = reservation.status === "RELEASED";
  const isExpired =
    reservation.status === "PENDING" && new Date(reservation.expiresAt) < new Date();

  const statusBadge: Record<string, string> = {
    PENDING: "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    CONFIRMED: "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800",
    RELEASED: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700",
  };

  return (
    <div className="max-w-lg mx-auto">
      <button
        onClick={() => router.push("/")}
        className="mb-6 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        ← Back to products
      </button>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h1 className="text-xl font-semibold">{reservation.product.name}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {reservation.warehouse.name} · {reservation.warehouse.location}
            </p>
          </div>
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadge[reservation.status]}`}
          >
            {reservation.status.toLowerCase()}
          </span>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2.5 border-b border-gray-100 dark:border-gray-800">
            <span className="text-gray-500 dark:text-gray-400">Quantity</span>
            <span className="font-medium">{reservation.qty}</span>
          </div>
          <div className="flex justify-between py-2.5 border-b border-gray-100 dark:border-gray-800">
            <span className="text-gray-500 dark:text-gray-400">Unit price</span>
            <span className="font-medium">£{reservation.product.price.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-2.5 border-b border-gray-100 dark:border-gray-800">
            <span className="text-gray-500 dark:text-gray-400">Total</span>
            <span className="font-semibold text-base">
              £{(reservation.product.price * reservation.qty).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between py-2.5 border-b border-gray-100 dark:border-gray-800">
            <span className="text-gray-500 dark:text-gray-400">Reservation ID</span>
            <span className="font-mono text-xs text-gray-600 dark:text-gray-400">{reservation.id}</span>
          </div>
          {isPending && (
            <div className="flex justify-between py-2.5">
              <span className="text-gray-500 dark:text-gray-400">Time remaining</span>
              <Countdown expiresAt={reservation.expiresAt} />
            </div>
          )}
          {(isConfirmed || isReleased) && (
            <div className="flex justify-between py-2.5">
              <span className="text-gray-500 dark:text-gray-400">Expired at</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {new Date(reservation.expiresAt).toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>

        {flash && (
          <div
            className={`mt-4 rounded-lg px-4 py-3 text-sm ${
              flash.type === "error"
                ? "bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
                : "bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
            }`}
          >
            {flash.msg}
          </div>
        )}

        {(isPending && !isExpired) && (
          <div className="mt-6 flex gap-3">
            <button
              onClick={confirm}
              disabled={!!actionLoading}
              className="flex-1 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-2.5 text-sm font-medium hover:bg-gray-700 dark:hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {actionLoading === "confirm" ? "Confirming…" : "Confirm purchase"}
            </button>
            <button
              onClick={release}
              disabled={!!actionLoading}
              className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {actionLoading === "release" ? "Cancelling…" : "Cancel"}
            </button>
          </div>
        )}

        {isConfirmed && (
          <div className="mt-6 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-4 text-center">
            <div className="text-green-700 dark:text-green-300 font-medium">Order confirmed</div>
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">
              Your purchase is complete. Thank you!
            </p>
            <button
              onClick={() => router.push("/")}
              className="mt-3 text-sm text-green-700 dark:text-green-300 underline underline-offset-2"
            >
              Browse more products
            </button>
          </div>
        )}

        {(isReleased || isExpired) && (
          <div className="mt-6 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 text-center">
            <div className="text-gray-700 dark:text-gray-300 font-medium">
              {isExpired ? "Reservation expired" : "Reservation cancelled"}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              The units have been returned to stock.
            </p>
            <button
              onClick={() => router.push("/")}
              className="mt-3 text-sm text-gray-600 dark:text-gray-300 underline underline-offset-2"
            >
              Back to products
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
