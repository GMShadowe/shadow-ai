"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { BAND_ROWS } from "@/lib/facts";
import { useFrameloop } from "./use-in-view";


const RING_TEXT = "shadow  ·  local-first  ·  runs on your computer  ·  ";

function textTexture(text: string, family: string, fg: string, bg: string, height = 96) {
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  const font = `500 ${height * 0.5}px ${family}`;
  ctx.font = font;
  c.width = Math.ceil(ctx.measureText(text).width);
  c.height = height;
  ctx.font = font;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = fg;
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, height / 2);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function Band({ family }: { family: string }) {
  const { viewport } = useThree();
  const rowH = 0.36;
  const width = viewport.width + 2;
  const maps = useMemo(
    () => BAND_ROWS.map((row) => {
      const t = textTexture(row, family, "#1b1915", "#6f8fe8");
      const img = t.image as HTMLCanvasElement;
      t.repeat.x = width / (rowH * (img.width / img.height));
      return t;
    }),
    [family, width],
  );

  useFrame((_, dt) => {
    maps.forEach((m, i) => { m.offset.x += dt * 0.025 * (i % 2 ? -1 : 1); });
  });

  return (
    <group>
      {maps.map((map, i) => (
        <mesh key={i} position={[0, (1.5 - i) * rowH, 0]}>
          <planeGeometry args={[width, rowH]} />
          <meshBasicMaterial map={map} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function Ring({ family }: { family: string }) {
  const spin = useRef<THREE.Mesh>(null);
  const tilt = useRef<THREE.Group>(null);
  const { pointer } = useThree();
  const map = useMemo(() => {
    const t = textTexture(RING_TEXT, family, "#292521", "#fbf7f0", 128);
    t.repeat.x = 3;
    return t;
  }, [family]);

  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += dt * 0.35;
    if (tilt.current) {
      tilt.current.rotation.z = THREE.MathUtils.damp(tilt.current.rotation.z, -0.55 + pointer.x * 0.25, 3, dt);
      tilt.current.rotation.x = THREE.MathUtils.damp(tilt.current.rotation.x, 1.15 + pointer.y * 0.2, 3, dt);
    }
  });

  return (
    <group ref={tilt} rotation={[1.15, 0, -0.55]}>
      <mesh ref={spin}>
        <cylinderGeometry args={[1.5, 1.5, 0.52, 160, 1, true]} />
        <meshStandardMaterial map={map} side={THREE.DoubleSide} roughness={0.42} metalness={0.05} />
      </mesh>
    </group>
  );
}

export default function RingBand() {
  const ref = useRef<HTMLDivElement>(null);
  const frameloop = useFrameloop(ref);
  const [family, setFamily] = useState<string | null>(null);

  useEffect(() => {
    // The canvas textures need the real Geist Mono face, so wait for it.
    const fam = getComputedStyle(document.documentElement).getPropertyValue("--font-geist-mono").trim() || "monospace";
    document.fonts.load(`500 48px ${fam}`).finally(() => setFamily(fam));
  }, []);

  return (
    <div ref={ref} className="absolute inset-0">
      {family && (
        <Canvas frameloop={frameloop} dpr={[1, 1.5]} camera={{ position: [0, 0, 6], fov: 32 }}
          gl={{ antialias: true, alpha: true }} aria-hidden="true">
          <ambientLight intensity={1.5} />
          <directionalLight position={[-3, 4, 5]} intensity={2.2} />
          <directionalLight position={[4, -2, 3]} intensity={0.6} color="#b4c6f0" />
          <Band family={family} />
          <Ring family={family} />
        </Canvas>
      )}
    </div>
  );
}
