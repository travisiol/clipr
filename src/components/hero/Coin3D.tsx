"use client";

import { useEffect, useRef } from "react";
// Type-only: erased at compile time, so the runtime import below stays dynamic.
import type * as ThreeTypes from "three";

/**
 * The hero object: a chrome coin stamped with a play button, three glass
 * clips orbiting it. The coin is the currency, the play button is the view,
 * the clips are what earns it — the whole product in one object.
 *
 * Lit by an environment painted into a canvas at runtime (a warm sun low
 * left, a white one high right, a cool band behind), so the chrome reflects
 * something real without a single asset being downloaded. three is imported
 * inside the effect: the page stays server rendered and the renderer never
 * reaches a visitor who bounces before it paints.
 */
export function Coin3D({ className }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    let disposed = false;
    let frame = 0;
    let teardown = () => {};

    (async () => {
      const THREE = await import("three");
      if (disposed) return;

      const width = el.clientWidth || 520;
      const height = el.clientHeight || 520;

      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      } catch {
        return; // No WebGL: the CSS glow underneath is the whole hero.
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height, false);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.02;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";
      el.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);
      camera.position.set(0, 0.35, 8.0);
      camera.lookAt(0, 0, 0);

      /* The environment, painted rather than loaded. */
      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 512;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const sky = ctx.createLinearGradient(0, 0, 0, 512);
        sky.addColorStop(0, "#2a2733");
        sky.addColorStop(0.42, "#4a4452");
        sky.addColorStop(0.56, "#17151d");
        sky.addColorStop(1, "#08080c");
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, 1024, 512);
        const blob = (x: number, y: number, r: number, colour: string) => {
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, colour);
          g.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, 1024, 512);
        };
        // A bright horizon band: this is what makes chrome read as chrome.
        const band = ctx.createLinearGradient(0, 230, 0, 290);
        band.addColorStop(0, "rgba(255,255,255,0)");
        band.addColorStop(0.5, "rgba(255,244,232,0.95)");
        band.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = band;
        ctx.fillRect(0, 230, 1024, 60);
        blob(210, 340, 280, "rgba(255,106,43,0.95)");
        blob(800, 120, 260, "rgba(255,235,210,0.9)");
        // Straight behind the camera (u = .75): what the front face mirrors
        // when it looks at you. Without it the face reads as dark bronze.
        blob(768, 256, 210, "rgba(255,250,244,0.85)");
        blob(560, 420, 220, "rgba(90,110,255,0.45)");
        blob(950, 400, 160, "rgba(255,179,71,0.5)");
      }
      const envTexture = new THREE.CanvasTexture(canvas);
      envTexture.mapping = THREE.EquirectangularReflectionMapping;
      envTexture.colorSpace = THREE.SRGBColorSpace;
      scene.environment = envTexture;

      const group = new THREE.Group();
      scene.add(group);

      const chrome = new THREE.MeshPhysicalMaterial({
        color: 0xe3e2ea,
        metalness: 1,
        roughness: 0.16,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        envMapIntensity: 1.6,
      });
      const chromeDark = chrome.clone();
      chromeDark.color = new THREE.Color(0xaeadb8);
      chromeDark.roughness = 0.28;

      /* The coin: a fat cylinder facing the camera, a torus rim for the
         bevel, and a slightly recessed inner face so the edge catches light. */
      const R = 1.55;
      const T = 0.26;
      const coin = new THREE.Group();
      coin.rotation.x = Math.PI / 2;
      group.add(coin);

      const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, T, 128, 1, false), chrome);
      coin.add(body);

      const rim = new THREE.Mesh(new THREE.TorusGeometry(R - 0.02, 0.09, 24, 200), chromeDark);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = T / 2;
      coin.add(rim);
      const rimBack = rim.clone();
      rimBack.position.y = -T / 2;
      coin.add(rimBack);

      // A brushed ring track inside the rim, on both faces.
      const track = new THREE.Mesh(new THREE.RingGeometry(R - 0.34, R - 0.16, 128), chromeDark);
      track.rotation.x = -Math.PI / 2;
      track.position.y = T / 2 + 0.002;
      coin.add(track);
      const trackBack = track.clone();
      trackBack.rotation.x = Math.PI / 2;
      trackBack.position.y = -T / 2 - 0.002;
      coin.add(trackBack);

      /* The play button: a rounded triangle, extruded, lit from within.
         The only thing in the scene that emits — the record light. */
      const tri = new THREE.Shape();
      const s = 0.86;
      const r = 0.12;
      const pts = [
        new THREE.Vector2(-s * 0.55, s * 0.62),
        new THREE.Vector2(s * 0.7, 0),
        new THREE.Vector2(-s * 0.55, -s * 0.62),
      ];
      // Rounded corners by shortening each edge and bridging with a curve.
      const seg = (a: ThreeTypes.Vector2, b: ThreeTypes.Vector2, d: number) =>
        a.clone().add(b.clone().sub(a).normalize().multiplyScalar(d));
      for (let i = 0; i < 3; i++) {
        const p = pts[i];
        const prev = pts[(i + 2) % 3];
        const next = pts[(i + 1) % 3];
        const a = seg(p, prev, r);
        const b = seg(p, next, r);
        if (i === 0) tri.moveTo(a.x, a.y);
        else tri.lineTo(a.x, a.y);
        tri.quadraticCurveTo(p.x, p.y, b.x, b.y);
      }
      tri.closePath();
      const playGeo = new THREE.ExtrudeGeometry(tri, {
        depth: 0.09,
        bevelEnabled: true,
        bevelThickness: 0.03,
        bevelSize: 0.03,
        bevelSegments: 6,
        curveSegments: 24,
      });
      const playMat = new THREE.MeshPhysicalMaterial({
        color: 0xff7a3a,
        emissive: 0xff5a1e,
        emissiveIntensity: 0.55,
        metalness: 0.2,
        roughness: 0.32,
        clearcoat: 1,
        clearcoatRoughness: 0.15,
        envMapIntensity: 0.9,
      });
      const play = new THREE.Mesh(playGeo, playMat);
      play.rotation.x = -Math.PI / 2;
      play.position.set(0.05, T / 2 + 0.004, 0);
      coin.add(play);
      const playBack = new THREE.Mesh(playGeo, playMat);
      playBack.rotation.x = Math.PI / 2;
      playBack.rotation.z = Math.PI; // mirrored so it points right from behind too
      playBack.position.set(-0.05, -T / 2 - 0.004, 0);
      coin.add(playBack);

      /* Three clips — 9:16 panes of glass — orbiting on a tilted ring. */
      const clipGeo = new THREE.BoxGeometry(0.46, 0.82, 0.035);
      const clipMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0,
        roughness: 0.08,
        transmission: 1,
        thickness: 0.6,
        ior: 1.5,
        attenuationColor: new THREE.Color(0xffc9a8),
        attenuationDistance: 2.2,
        clearcoat: 1,
        envMapIntensity: 1.3,
      });
      const orbit = new THREE.Group();
      orbit.rotation.x = 0.42;
      orbit.rotation.z = -0.18;
      group.add(orbit);
      const clips: ThreeTypes.Mesh[] = [];
      for (let i = 0; i < 3; i++) {
        const clip = new THREE.Mesh(clipGeo, clipMat);
        const a = (i / 3) * Math.PI * 2;
        clip.position.set(Math.cos(a) * 2.45, 0, Math.sin(a) * 2.45);
        clip.userData.angle = a;
        orbit.add(clip);
        clips.push(clip);
      }
      // The orbit itself, a hair of ember.
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.45, 0.006, 8, 240),
        new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.5 }),
      );
      ring.rotation.x = Math.PI / 2;
      orbit.add(ring);

      scene.add(new THREE.AmbientLight(0xffffff, 0.25));
      const key = new THREE.PointLight(0xfff1e0, 70, 40, 2);
      key.position.set(4, 4, 5);
      scene.add(key);
      const ember = new THREE.PointLight(0xff6a2b, 55, 40, 2);
      ember.position.set(-4.5, -1.5, 3.5);
      scene.add(ember);

      /* Pointer parallax, damped: the coin leans toward the cursor. */
      let targetX = 0;
      let targetY = 0;
      const onPointer = (e: PointerEvent) => {
        const rect = el.getBoundingClientRect();
        targetX = ((e.clientX - rect.left) / rect.width - 0.5) * 0.7;
        targetY = ((e.clientY - rect.top) / rect.height - 0.5) * 0.45;
      };
      window.addEventListener("pointermove", onPointer, { passive: true });

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
      const clock = new THREE.Clock();
      let visible = true;
      const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting), { threshold: 0.05 });
      io.observe(el);

      const tick = () => {
        frame = requestAnimationFrame(tick);
        if (!visible) return;
        const t = clock.getElapsedTime();
        if (!reduced.matches) {
          coin.rotation.z = t * 0.42; // spin around the coin's own axis
          group.position.y = Math.sin(t * 0.9) * 0.06;
          orbit.rotation.y = -t * 0.22;
          for (const clip of clips) {
            clip.rotation.y = t * 0.6 + (clip.userData.angle as number);
            clip.position.y = Math.sin(t * 1.1 + (clip.userData.angle as number)) * 0.18;
          }
          playMat.emissiveIntensity = 0.5 + Math.sin(t * 2.4) * 0.12;
        }
        group.rotation.y += (targetX - group.rotation.y) * 0.05;
        group.rotation.x += (targetY - group.rotation.x) * 0.05;
        renderer.render(scene, camera);
      };
      tick();

      const resize = () => {
        const w = el.clientWidth;
        const h = el.clientHeight;
        if (!w || !h) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(el);
      window.addEventListener("resize", resize);

      teardown = () => {
        io.disconnect();
        observer.disconnect();
        window.removeEventListener("resize", resize);
        window.removeEventListener("pointermove", onPointer);
        scene.traverse((o) => {
          const m = o as ThreeTypes.Mesh;
          if (m.geometry) m.geometry.dispose();
        });
        chrome.dispose();
        chromeDark.dispose();
        playMat.dispose();
        clipMat.dispose();
        envTexture.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      teardown();
    };
  }, []);

  return <div ref={host} className={className} aria-hidden />;
}
