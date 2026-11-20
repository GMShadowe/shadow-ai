"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useReality, type Reality } from "@/lib/reality";
import { useFrameloop } from "./use-in-view";


// paper must equal the hero's ground colour in that reality, or the sphere shows as a disc.
const LOOKS: Record<Reality, { ink: string; paper: string; invert: number }> = {
  paper: { ink: "#292521", paper: "#f5ede1", invert: 0 },
  blueprint: { ink: "#3f5fcf", paper: "#f5ede1", invert: 0 },
  night: { ink: "#f5ede1", paper: "#292521", invert: 1 },
};

const halftone = {
  vertexShader: `
    varying vec3 vNormal;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform vec3 uInk;
    uniform vec3 uPaper;
    uniform vec3 uLight;
    uniform float uCell;
    uniform float uInvert;
    varying vec3 vNormal;
    void main() {
      float light = max(dot(normalize(vNormal), normalize(uLight)), 0.0);
      float lit = 0.08 + 0.92 * light;
      float tone = mix(1.0 - lit, lit * 0.9, uInvert);
      vec2 p = gl_FragCoord.xy / uCell;
      p = mat2(0.7071, -0.7071, 0.7071, 0.7071) * p;
      float d = length(fract(p) - 0.5);
      float r = sqrt(tone) * 0.62 + 0.04;
      float dotMask = 1.0 - smoothstep(r - 0.06, r, d);
      gl_FragColor = vec4(mix(uPaper, uInk, dotMask), 1.0);
    }`,
};

function latLongLines(radius: number, meridians = 18, parallels = 11, seg = 64) {
  const pts: number[] = [];
  for (let m = 0; m < meridians; m++) {
    const a = (m / meridians) * Math.PI * 2;
    for (let i = 0; i < seg; i++) {
      const t0 = (i / seg) * Math.PI, t1 = ((i + 1) / seg) * Math.PI;
      pts.push(
        radius * Math.sin(t0) * Math.cos(a), radius * Math.cos(t0), radius * Math.sin(t0) * Math.sin(a),
        radius * Math.sin(t1) * Math.cos(a), radius * Math.cos(t1), radius * Math.sin(t1) * Math.sin(a),
      );
    }
  }
  for (let p = 1; p < parallels; p++) {
    const t = (p / parallels) * Math.PI, y = radius * Math.cos(t), r = radius * Math.sin(t);
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      pts.push(r * Math.cos(a0), y, r * Math.sin(a0), r * Math.cos(a1), y, r * Math.sin(a1));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

// Module-level state: assumes a single HeroOrb on the page.
const uniforms = {
  uInk: { value: new THREE.Color(LOOKS.paper.ink) },
  uPaper: { value: new THREE.Color(LOOKS.paper.paper) },
  uInvert: { value: 0 },
  uLight: { value: new THREE.Vector3(-0.6, 0.8, 0.7) },
  uCell: { value: 6.5 },
};
const target = { ink: new THREE.Color(), paper: new THREE.Color() };

function Scene({ reality }: { reality: Reality }) {
  const group = useRef<THREE.Group>(null);
  const wire = useRef<THREE.LineSegments>(null);
  const dots = useRef<THREE.Points>(null);
  const { pointer, viewport, invalidate } = useThree();
  const r = Math.min(1.25, viewport.width * 0.2);

  const lines = useMemo(() => latLongLines(r), [r]);

  // Under reduced motion the canvas only draws on demand, so ask for frames.
  useEffect(() => {
    let n = 0;
    const id = setInterval(() => { invalidate(); if (++n > 40) clearInterval(id); }, 16);
    return () => clearInterval(id);
  }, [reality, invalidate]);

  useFrame((state, dt) => {
    if (!group.current || !wire.current || !dots.current) return;
    uniforms.uCell.value = 6.5 * state.gl.getPixelRatio();
    const look = LOOKS[reality];
    const k = 1 - Math.exp(-dt * 6);
    target.ink.set(look.ink);
    target.paper.set(look.paper);
    uniforms.uInk.value.lerp(target.ink, k);
    uniforms.uPaper.value.lerp(target.paper, k);
    uniforms.uInvert.value += (look.invert - uniforms.uInvert.value) * k;
    const lineMat = wire.current.material as THREE.LineBasicMaterial;
    const dotMat = dots.current.material as THREE.PointsMaterial;
    lineMat.color.lerp(target.ink, k);
    dotMat.color.lerp(target.ink, k);
    lineMat.opacity += ((reality === "blueprint" ? 0 : 0.8) - lineMat.opacity) * k;
    dotMat.opacity += ((reality === "blueprint" ? 1 : 0) - dotMat.opacity) * k;

    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, pointer.x * 0.35, 4, dt);
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, -pointer.y * 0.25, 4, dt);
    wire.current.rotation.y += dt * 0.25;
    dots.current.rotation.y = wire.current.rotation.y;
    const y = -r * 0.42 + Math.sin(state.clock.elapsedTime * 0.8) * 0.05;
    wire.current.position.y = y;
    dots.current.position.y = y;
    uniforms.uLight.value.set(-0.6 + pointer.x * 0.5, 0.8 + pointer.y * 0.4, 0.7);
  });

  return (
    <group ref={group}>
      <mesh position={[-r * 0.38, r * 0.3, 0]}>
        <sphereGeometry args={[r, 96, 64]} />
        <shaderMaterial args={[{ ...halftone, uniforms }]} />
      </mesh>
      <lineSegments ref={wire} geometry={lines} position={[r * 0.48, -r * 0.42, 0.2]} renderOrder={1}>
        <lineBasicMaterial color={LOOKS.paper.ink} transparent opacity={0.8} depthTest={false} />
      </lineSegments>
      <points ref={dots} geometry={lines} position={[r * 0.48, -r * 0.42, 0.2]} renderOrder={1}>
        <pointsMaterial color={LOOKS.blueprint.ink} size={2.2} sizeAttenuation={false} transparent opacity={0} depthTest={false} />
      </points>
    </group>
  );
}

export default function HeroOrb() {
  const ref = useRef<HTMLDivElement>(null);
  const frameloop = useFrameloop(ref);
  const reality = useReality();
  return (
    <div ref={ref} className="absolute inset-0">
      <Canvas frameloop={frameloop} dpr={[1, 1.5]} camera={{ position: [0, 0, 5], fov: 40 }}
        gl={{ antialias: true, alpha: true }} aria-hidden="true">
        <Scene reality={reality} />
      </Canvas>
    </div>
  );
}
