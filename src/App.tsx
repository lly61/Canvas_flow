/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from "react";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsCanvasRef = useRef<HTMLCanvasElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const skyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const starsCanvas = starsCanvasRef.current;
    const sCtx = starsCanvas?.getContext("2d");
    const flashDiv = flashRef.current;
    const skyDiv = skyRef.current;

    let cw = window.innerWidth;
    let ch = window.innerHeight;
    canvas.width = cw;
    canvas.height = ch;
    if (starsCanvas) {
      starsCanvas.width = cw;
      starsCanvas.height = ch;
    }

    const drawStars = () => {
      if (!sCtx || !starsCanvas) return;
      sCtx.clearRect(0, 0, cw, ch);
      for (let i = 0; i < 150; i++) {
        sCtx.beginPath();
        sCtx.arc(
          Math.random() * cw,
          Math.random() * ch,
          Math.random() * 1.5,
          0,
          Math.PI * 2
        );
        sCtx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.8 + 0.2})`;
        sCtx.fill();
      }
    };
    drawStars();

    let fireworks: Firework[] = [];
    let particles: Particle[] = [];
    let pendingExplosions: PendingExplosion[] = [];
    let globalHue = 120;
    let flashAlpha = 0;
    let flashHue = 0;
    let limiterTotal = 5;
    let limiterTick = 0;
    let timerTotal = 80;
    let timerTick = 0;
    let mousedown = false;
    let mx: number;
    let my: number;

    const random = (min: number, max: number) =>
      Math.random() * (max - min) + min;

    const calculateDistance = (
      p1x: number,
      p1y: number,
      p2x: number,
      p2y: number
    ) => {
      const xDistance = p1x - p2x;
      const yDistance = p1y - p2y;
      return Math.sqrt(Math.pow(xDistance, 2) + Math.pow(yDistance, 2));
    };

    interface PendingExplosion {
      x: number;
      y: number;
      delay: number;
      hue: number;
      count: number;
      speed: number;
    }

    class Firework {
      x: number;
      y: number;
      sx: number;
      sy: number;
      tx: number;
      ty: number;
      distanceToTarget: number;
      distanceTraveled: number;
      coordinates: [number, number][];
      coordinateCount: number;
      angle: number;
      speed: number;
      acceleration: number;
      brightness: number;
      targetRadius: number;
      hue: number;

      constructor(sx: number, sy: number, tx: number, ty: number) {
        this.x = sx;
        this.y = sy;
        this.sx = sx;
        this.sy = sy;
        this.tx = sx + (tx - sx) * random(0.8, 1.2); // Add some randomness to target
        this.ty = ty;
        this.distanceToTarget = calculateDistance(sx, sy, this.tx, this.ty);
        this.distanceTraveled = 0;
        this.coordinates = [];
        this.coordinateCount = 3;
        while (this.coordinateCount--) {
          this.coordinates.push([this.x, this.y]);
        }
        this.angle = Math.atan2(this.ty - sy, this.tx - sx);
        this.speed = 2;
        this.acceleration = 1.05;
        this.brightness = random(50, 70);
        this.targetRadius = 1;
        this.hue = globalHue;
      }

      update(index: number) {
        this.coordinates.pop();
        this.coordinates.unshift([this.x, this.y]);

        if (this.targetRadius < 8) {
          this.targetRadius += 0.3;
        } else {
          this.targetRadius = 1;
        }

        this.speed *= this.acceleration;
        const vx = Math.cos(this.angle) * this.speed;
        const vy = Math.sin(this.angle) * this.speed;
        this.distanceTraveled = calculateDistance(
          this.sx,
          this.sy,
          this.x + vx,
          this.y + vy
        );

        if (this.distanceTraveled >= this.distanceToTarget) {
          // Main explosion: Red Rose
          createRoseParticles(this.tx, this.ty);
          flashAlpha = 0.6;
          flashHue = 350; // Crimson Red

          // Wave-like secondary explosions
          const secondaryCount = Math.floor(random(6, 10));
          const radius = random(100, 180);
          for (let i = 0; i < secondaryCount; i++) {
            const angle = ((Math.PI * 2) / secondaryCount) * i;
            const offsetX = Math.cos(angle) * radius;
            const offsetY = Math.sin(angle) * radius;
            pendingExplosions.push({
              x: this.tx + offsetX,
              y: this.ty + offsetY,
              delay: 25 + i * 5, // Sequential delay for a circular wave effect, slightly longer delay to let rose bloom
              hue: this.hue + random(-30, 30),
              count: 60,
              speed: 8,
            });
          }

          fireworks.splice(index, 1);
        } else {
          this.x += vx;
          this.y += vy;
        }
      }

      draw() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.moveTo(
          this.coordinates[this.coordinates.length - 1][0],
          this.coordinates[this.coordinates.length - 1][1]
        );
        ctx.lineTo(this.x, this.y);
        ctx.strokeStyle = `hsl(${this.hue}, 100%, ${this.brightness}%)`;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.arc(this.tx, this.ty, this.targetRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    class Particle {
      x: number;
      y: number;
      coordinates: [number, number][];
      coordinateCount: number;
      angle: number;
      speed: number;
      friction: number;
      gravity: number;
      hue: number;
      brightness: number;
      alpha: number;
      decay: number;

      constructor(
        x: number,
        y: number,
        baseHue: number,
        maxSpeed: number,
        angle?: number,
        speed?: number,
        gravity: number = 0.8
      ) {
        this.x = x;
        this.y = y;
        this.coordinates = [];
        this.coordinateCount = 5;
        while (this.coordinateCount--) {
          this.coordinates.push([this.x, this.y]);
        }
        this.angle = angle !== undefined ? angle : random(0, Math.PI * 2);
        this.speed = speed !== undefined ? speed : random(1, maxSpeed);
        this.friction = 0.94;
        this.gravity = gravity;
        this.hue = random(baseHue - 20, baseHue + 20);
        this.brightness = random(60, 100);
        this.alpha = 1;
        this.decay = random(0.01, 0.02);
      }

      update(index: number) {
        this.coordinates.pop();
        this.coordinates.unshift([this.x, this.y]);
        this.speed *= this.friction;
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed + this.gravity;
        this.alpha -= this.decay;

        if (this.alpha <= this.decay) {
          particles.splice(index, 1);
        }
      }

      draw() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.moveTo(
          this.coordinates[this.coordinates.length - 1][0],
          this.coordinates[this.coordinates.length - 1][1]
        );
        ctx.lineTo(this.x, this.y);
        ctx.lineWidth = random(1, 3);
        ctx.strokeStyle = `hsla(${this.hue}, 100%, ${this.brightness}%, ${this.alpha})`;
        ctx.stroke();
        ctx.lineWidth = 1;
      }
    }

    const createParticles = (
      x: number,
      y: number,
      count: number,
      baseHue: number,
      maxSpeed: number
    ) => {
      while (count--) {
        particles.push(new Particle(x, y, baseHue, maxSpeed));
      }
    };

    const createRoseParticles = (x: number, y: number) => {
      const baseHue = 350; // Crimson Red
      const roseGravity = 0.3; // Less gravity to hold the shape

      // Layer 1: Large outer petals
      for (let i = 0; i < 200; i++) {
        const theta = random(0, Math.PI * 2);
        const petal = Math.abs(Math.sin(theta * 2.5));
        const speed = 8 + petal * 6;
        particles.push(
          new Particle(x, y, baseHue, 0, theta, speed, roseGravity)
        );
      }

      // Layer 2: Mid petals, offset by some angle
      for (let i = 0; i < 150; i++) {
        const theta = random(0, Math.PI * 2);
        const petal = Math.abs(Math.sin((theta + 0.5) * 2.5));
        const speed = 4 + petal * 4;
        particles.push(
          new Particle(x, y, baseHue - 10, 0, theta, speed, roseGravity)
        );
      }

      // Layer 3: Inner petals, offset again
      for (let i = 0; i < 100; i++) {
        const theta = random(0, Math.PI * 2);
        const petal = Math.abs(Math.sin((theta + 1.0) * 2.5));
        const speed = 1 + petal * 3;
        particles.push(
          new Particle(x, y, baseHue + 10, 0, theta, speed, roseGravity)
        );
      }

      // Center core
      for (let i = 0; i < 50; i++) {
        const theta = random(0, Math.PI * 2);
        const speed = random(0, 1.5);
        particles.push(
          new Particle(x, y, baseHue, 0, theta, speed, roseGravity)
        );
      }
    };

    let animationFrameId: number;

    const loop = () => {
      animationFrameId = requestAnimationFrame(loop);
      globalHue += 0.5;

      if (flashAlpha > 0.01) {
        flashAlpha *= 0.92;
      } else {
        flashAlpha = 0;
      }

      if (skyDiv) {
        // Base lightness is 4%, it increases up to ~15% when flashAlpha is high
        const lightness = 4 + flashAlpha * 18;
        skyDiv.style.backgroundColor = `hsl(240, 50%, ${lightness}%)`;
      }

      if (flashDiv) {
        flashDiv.style.backgroundColor = `hsla(${flashHue}, 100%, 70%, ${
          flashAlpha * 0.3
        })`;
      }

      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0, 0, 0, 0.2)"; // Longer trails
      ctx.fillRect(0, 0, cw, ch);
      ctx.globalCompositeOperation = "lighter";

      let i = fireworks.length;
      while (i--) {
        fireworks[i].draw();
        fireworks[i].update(i);
      }

      let j = particles.length;
      while (j--) {
        particles[j].draw();
        particles[j].update(j);
      }

      let p = pendingExplosions.length;
      while (p--) {
        const pe = pendingExplosions[p];
        pe.delay--;
        if (pe.delay <= 0) {
          createParticles(pe.x, pe.y, pe.count, pe.hue, pe.speed);
          flashAlpha = Math.max(flashAlpha, 0.3);
          flashHue = pe.hue;
          pendingExplosions.splice(p, 1);
        }
      }

      if (timerTick >= timerTotal) {
        if (!mousedown) {
          // 自动发射烟花特效（已注释）：仅保留手动按压/拖拽触发
          // fireworks.push(
          //   new Firework(cw / 2, ch, random(0, cw), random(0, ch / 2))
          // );
          timerTick = 0;
        }
      } else {
        timerTick++;
      }

      if (limiterTick >= limiterTotal) {
        if (mousedown) {
          fireworks.push(new Firework(cw / 2, ch, mx, my));
          limiterTick = 0;
        }
      } else {
        limiterTick++;
      }
    };

    const handleResize = () => {
      cw = window.innerWidth;
      ch = window.innerHeight;
      canvas.width = cw;
      canvas.height = ch;
      if (starsCanvas) {
        starsCanvas.width = cw;
        starsCanvas.height = ch;
        drawStars();
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      e.preventDefault();
      mousedown = true;
      mx = e.clientX;
      my = e.clientY;
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (mousedown) {
        mx = e.clientX;
        my = e.clientY;
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      e.preventDefault();
      mousedown = false;
    };

    window.addEventListener("resize", handleResize);
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);

    loop();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  return (
    <div
      ref={skyRef}
      className="fixed inset-0 bg-[#050510] overflow-hidden touch-none"
    >
      {/* Stars Background */}
      <canvas
        ref={starsCanvasRef}
        className="absolute inset-0 block w-full h-full pointer-events-none"
      />

      {/* Realistic Moon */}
      <div className="absolute top-12 right-12 md:top-20 md:right-24 w-28 h-28 md:w-40 md:h-40 pointer-events-none">
        {/* Moon Glow */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            boxShadow:
              "0 0 60px 20px rgba(255, 255, 220, 0.3), 0 0 100px 40px rgba(255, 255, 255, 0.1)",
          }}
        ></div>
        {/* Moon Image */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            backgroundImage:
              'url("https://images.unsplash.com/photo-1522030299830-16b8d3d049fe?q=80&w=400&auto=format&fit=crop")',
            backgroundSize: "140%",
            backgroundPosition: "center",
            mixBlendMode: "screen",
            filter: "contrast(1.2) brightness(1.1)",
          }}
        ></div>
      </div>

      {/* Dynamic Flash Overlay */}
      <div
        ref={flashRef}
        className="absolute inset-0 pointer-events-none mix-blend-screen"
      />

      {/* Fireworks Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block w-full h-full pointer-events-auto touch-none"
      />

      <div className="absolute top-12 left-0 right-0 text-center pointer-events-none select-none z-10">
        <h1 className="text-white/40 text-2xl font-light tracking-[0.3em] uppercase">
          花花 World
        </h1>
        <p className="text-white text-sm mt-2 tracking-widest">记得点我</p>
      </div>
    </div>
  );
}
