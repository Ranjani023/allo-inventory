import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Allo — Inventory",
  description: "Multi-warehouse inventory with race-condition-safe reservations",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
            <span className="text-xl font-semibold tracking-tight">Allo</span>
            <span className="text-gray-400 dark:text-gray-600">|</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">Inventory</span>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
