"use client";

import { useEffect } from "react";
import { Logo } from "@/components/Logo";
import { applyIcon, applyTheme, resetTheme, ShownBrand } from "@/lib/me";

/** The owner's mark in a screen's bar: the school's logo and name, or the Quizplayo logo. */
export function OwnerBrandMark({ brand, size = 28 }: { brand: ShownBrand | null | undefined; size?: number }) {
  if (!brand || brand.owner !== "school") {
    return <span className="brand"><Logo size={size} /></span>;
  }
  return (
    <span className="brand">
      {brand.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="school-logo" src={brand.logoUrl} alt="" />
      ) : null}
      <span>{brand.name}</span>
    </span>
  );
}

/** Uses the owner's colours and browser icon while this screen is open (Quizplayo's own for "quizplayo"). */
export function useOwnerBrand(brand: ShownBrand | null | undefined) {
  useEffect(() => {
    if (!brand) return;
    if (brand.owner === "school") {
      applyTheme(brand.theme ?? {});
      applyIcon(brand.iconUrl);
    } else {
      resetTheme();
      applyIcon(null);
    }
  }, [brand]);
}
