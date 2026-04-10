"use client";

import Link from "next/link";
import Header from "@/components/Header";

export default function NotFound() {
  return (
    <div>
      <Header />
      <div className="container">
        <div className="notFoundWrap">
          <p className="notFoundCode">404</p>
          <h1 className="notFoundTitle">Page not found</h1>
          <p className="notFoundSub">
            This page doesn&apos;t exist or may have been moved.
          </p>
          <div className="notFoundActions">
            <Link href="/" className="btn btnPrimary">Go Home</Link>
            <Link href="/items" className="btn btnGhost">Browse Items</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
