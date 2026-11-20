"use client";

import dynamic from "next/dynamic";

export const HeroOrb = dynamic(() => import("./hero-orb"), { ssr: false });
export const RingBand = dynamic(() => import("./ring-band"), { ssr: false });
