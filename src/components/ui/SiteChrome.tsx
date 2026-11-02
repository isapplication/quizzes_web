"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { BRAND } from "@/lib/brand";

/** The public header: logo, product links, Sign in and Sign up; folds into a menu on phones. */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="site-header-in">
        <Link href="/" className="site-logo" aria-label={BRAND.name + " home"}>
          <Logo size={34} />
        </Link>
        <button type="button" className="site-menu-button" aria-expanded={open} aria-controls="site-nav"
                onClick={() => setOpen((o) => !o)}>
          <span aria-hidden="true">☰</span><span className="sr-only">Menu</span>
        </button>
        <nav id="site-nav" aria-label="Main" className={open ? "site-nav open" : "site-nav"}>
          <Link href="/#features">Features</Link>
          <Link href="/help">Help</Link>
          <Link href="/sign-up/school">For schools</Link>
          <Link href="/sign-in">Sign in</Link>
          <Link className="btn btn-light" href="/sign-up/teacher">Sign up free</Link>
        </nav>
      </div>
    </header>
  );
}

/** The public footer: product and company links, copyright and the location-data credit. */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-in">
        <div className="site-footer-brand">
          <Logo size={28} />
          <p>Quizzes and live games for schools.</p>
        </div>
        <nav aria-label="Product" className="site-footer-col">
          <strong>Product</strong>
          <Link href="/#features">Features</Link>
          <Link href="/sign-up/teacher">Sign up as a teacher</Link>
          <Link href="/sign-up/school">Sign up your school</Link>
          <Link href="/sign-in">Sign in</Link>
          <Link href="/play">Join a game</Link>
        </nav>
        <nav aria-label="Company" className="site-footer-col">
          <strong>Company</strong>
          <Link href="/help">Help &amp; contact</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
        </nav>
      </div>
      <div className="site-footer-bottom">
        <span>© {BRAND.year} {BRAND.name}. All rights reserved.</span>
        <span>
          Location data:{" "}
          <a href="https://github.com/dr5hn/countries-states-cities-database" target="_blank" rel="noopener">
            countries-states-cities-database
          </a>{" "}
          (ODbL)
        </span>
      </div>
    </footer>
  );
}

/** Public header + page body + footer. */
export function PublicShell({ children, narrow = false }: { children: React.ReactNode; narrow?: boolean }) {
  return (
    <div className="site">
      <SiteHeader />
      <main className={narrow ? "site-main narrow" : "site-main"}>{children}</main>
      <SiteFooter />
    </div>
  );
}
