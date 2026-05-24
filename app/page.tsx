"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type StockEntry = {
  warehouseId: string;
  warehouseName: string;
  warehouseLocation: string;
  total: number;
  reserved: number;
  available: number;
};

type Product = {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  price: number;
  stock: StockEntry[];
};

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reserving, setReserving] = useState<string | null>(null); // "productId:warehouseId"
  const [flash, setFlash] = useState<{ type: "error" | "success"; msg: string } | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to load products");
      setProducts(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function reserve(productId: string, warehouseId: string) {
    const key = `${productId}:${warehouseId}`;
    setReserving(key);
    setFlash(null);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, warehouseId, qty: 1 }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setFlash({ type: "error", msg: `Not enough stock — ${data.error}` });
        await load();
        return;
      }
      if (!res.ok) {
        setFlash({ type: "error", msg: data.error ?? "Reservation failed" });
        return;
      }
      router.push(`/reservations/${data.id}`);
    } catch {
      setFlash({ type: "error", msg: "Network error — please try again" });
    } finally {
      setReserving(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        Loading products…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800 p-4 text-red-700 dark:text-red-300">
        {error}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Products</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Reserve a unit to hold it for 10 minutes while you check out.
          </p>
        </div>
        <button
          onClick={load}
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          ↻ Refresh
        </button>
      </div>

      {flash && (
        <div
          className={`mb-4 rounded-lg px-4 py-3 text-sm ${
            flash.type === "error"
              ? "bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
              : "bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
          }`}
        >
          {flash.msg}
        </div>
      )}

      <div className="grid gap-4">
        {products.map((product) => (
          <div
            key={product.id}
            className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-medium text-lg">{product.name}</h2>
                  <span className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-xs text-gray-500 dark:text-gray-400 font-mono">
                    {product.sku}
                  </span>
                </div>
                {product.description && (
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {product.description}
                  </p>
                )}
              </div>
              <div className="text-right">
                <span className="text-xl font-semibold">£{product.price.toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              {product.stock.length === 0 ? (
                <p className="text-sm text-gray-400">No stock information</p>
              ) : (
                product.stock.map((s) => {
                  const key = `${product.id}:${s.warehouseId}`;
                  const isReserving = reserving === key;
                  const outOfStock = s.available <= 0;
                  return (
                    <div
                      key={s.warehouseId}
                      className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-800/50 px-4 py-2.5"
                    >
                      <div>
                        <span className="text-sm font-medium">{s.warehouseName}</span>
                        <span className="ml-2 text-xs text-gray-400">{s.warehouseLocation}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span
                            className={`text-sm font-medium ${
                              outOfStock
                                ? "text-red-500 dark:text-red-400"
                                : s.available <= 5
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-green-600 dark:text-green-400"
                            }`}
                          >
                            {outOfStock ? "Out of stock" : `${s.available} available`}
                          </span>
                          {s.reserved > 0 && (
                            <div className="text-xs text-gray-400">{s.reserved} reserved</div>
                          )}
                        </div>
                        <button
                          disabled={outOfStock || isReserving}
                          onClick={() => reserve(product.id, s.warehouseId)}
                          className="rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-3 py-1.5 text-sm font-medium hover:bg-gray-700 dark:hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-w-[80px] text-center"
                        >
                          {isReserving ? "…" : "Reserve"}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
