import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Allo Inventory",
  description: "Multi-warehouse inventory and reservation platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-8">
                <Link href="/" className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">A</span>
                  </div>
                  <span className="font-semibold text-gray-900 text-lg">
                    Allo Inventory
                  </span>
                </Link>
                <div className="hidden md:flex items-center gap-6">
                  <Link
                    href="/"
                    className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Products
                  </Link>
                  <Link
                    href="/reservations"
                    className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Reservations
                  </Link>
                </div>
              </div>
              <div className="text-xs text-gray-400 font-mono hidden sm:block">
                v1.0.0
              </div>
            </div>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
