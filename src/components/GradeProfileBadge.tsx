"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export interface GradeProfile {
  grade: string;
  defaults: {
    timerSeconds?: number;
    maxItems?: number;
    maxCategories?: number;
  };
  notRecommended: { feature: string; reason: string }[];
}

export function useGradeProfile(gradeBand: string | null): GradeProfile | null {
  const [profile, setProfile] = useState<GradeProfile | null>(null);
  useEffect(() => {
    if (!gradeBand) return;
    api<GradeProfile>(`/api/grade-profiles?grade=${encodeURIComponent(gradeBand)}`)
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [gradeBand]);
  return profile;
}

export function gradeBandOf(grade: number | null): string | null {
  if (grade === null) return null;
  if (grade <= 2) return "K-2";
  if (grade <= 5) return "3-5";
  if (grade <= 8) return "6-8";
  return "9-12";
}

export function GradeProfileBadge({ feature, profile }: { feature: string; profile: GradeProfile | null }) {
  if (!profile) return null;
  const warning = profile.notRecommended.find((nr) => nr.feature === feature);
  if (!warning) return null;

  return (
    <span className="grade-badge" title={warning.reason} role="note">
      <span className="grade-badge-icon" aria-hidden="true">⚠</span>
      <span className="sr-only">Not recommended for {profile.grade}: {warning.reason}</span>
    </span>
  );
}
