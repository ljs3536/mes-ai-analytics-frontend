"use client";

import { useEffect, useRef } from "react";

export function LineChart({
  values,
  color = "#7dd3fc",
}: {
  values: number[];
  color?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    if (values.length < 2) return;
    const step = Math.max(1, Math.floor(values.length / 700));
    const points: number[] = [];
    for (let i = 0; i < values.length; i += step) points.push(values[i]);
    let min = Infinity;
    let max = -Infinity;
    for (const value of points) {
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
    if (max - min < 1e-9) {
      min -= 1;
      max += 1;
    }
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    points.forEach((value, index) => {
      const x = (index / (points.length - 1)) * (width - 12) + 6;
      const y = height - 8 - ((value - min) / (max - min)) * (height - 16);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [values, color]);

  return <canvas ref={ref} width={960} height={220} className="h-56 w-full rounded-xl bg-[#0c1117]" />;
}
