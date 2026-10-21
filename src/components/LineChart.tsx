"use client";

import { useEffect, useRef } from "react";

function niceStep(span: number) {
  if (!Number.isFinite(span) || span <= 0) return 1;
  const raw = span / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const err = raw / pow;
  const nice = err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1;
  return nice * pow;
}

function tickLabel(value: number) {
  const abs = Math.abs(value);
  if (abs !== 0 && (abs >= 10000 || abs < 0.01)) return value.toExponential(1);
  return String(Math.round(value * 1000) / 1000);
}

export function LineChart({
  values,
  xs,
  color = "#7dd3fc",
  xMin,
  xMax,
  yMin,
  yMax,
  xLabel,
  yLabel,
}: {
  values: number[];
  xs?: number[];
  color?: string;
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  xLabel?: string;
  yLabel?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const xKey = xs?.join(",") ?? "";

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    const left = 58;
    const right = 12;
    const top = 12;
    const bottom = 32;
    const plotW = width - left - right;
    const plotH = height - top - bottom;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0c1117";
    ctx.fillRect(0, 0, width, height);

    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < values.length; i++) {
      const x = xs?.[i] ?? i;
      const y = values[i];
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (xMin !== undefined && x < xMin) continue;
      if (xMax !== undefined && x > xMax) continue;
      points.push({ x, y });
    }

    let viewX0 = xMin ?? points[0]?.x ?? 0;
    let viewX1 = xMax ?? points[points.length - 1]?.x ?? 1;
    let viewY0 = yMin ?? Infinity;
    let viewY1 = yMax ?? -Infinity;
    if (yMin === undefined || yMax === undefined) {
      for (const point of points) {
        viewY0 = Math.min(viewY0, point.y);
        viewY1 = Math.max(viewY1, point.y);
      }
    }
    if (!Number.isFinite(viewY0) || !Number.isFinite(viewY1)) {
      viewY0 = -1;
      viewY1 = 1;
    }
    if (viewX1 - viewX0 < 1e-12) {
      viewX0 -= 1;
      viewX1 += 1;
    }
    if (viewY1 - viewY0 < 1e-12) {
      viewY0 -= 1;
      viewY1 += 1;
    }

    const xStep = niceStep(viewX1 - viewX0);
    const yStep = niceStep(viewY1 - viewY0);
    const xStart = Math.ceil(viewX0 / xStep) * xStep;
    const yStart = Math.ceil(viewY0 / yStep) * yStep;
    ctx.font = "11px ui-monospace, monospace";
    ctx.lineWidth = 1;
    for (let x = xStart; x <= viewX1 + xStep * 0.01; x += xStep) {
      const px = left + ((x - viewX0) / (viewX1 - viewX0)) * plotW;
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath();
      ctx.moveTo(px, top);
      ctx.lineTo(px, top + plotH);
      ctx.stroke();
      ctx.fillStyle = "#71717a";
      ctx.textAlign = "center";
      ctx.fillText(tickLabel(x), px, height - 14);
    }
    for (let y = yStart; y <= viewY1 + yStep * 0.01; y += yStep) {
      const py = top + plotH - ((y - viewY0) / (viewY1 - viewY0)) * plotH;
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath();
      ctx.moveTo(left, py);
      ctx.lineTo(left + plotW, py);
      ctx.stroke();
      ctx.fillStyle = "#71717a";
      ctx.textAlign = "right";
      ctx.fillText(tickLabel(y), left - 6, py + 4);
    }
    if (xLabel) {
      ctx.fillStyle = "#a1a1aa";
      ctx.textAlign = "right";
      ctx.fillText(xLabel, width - 8, height - 2);
    }
    if (yLabel) {
      ctx.fillStyle = "#a1a1aa";
      ctx.textAlign = "left";
      ctx.fillText(yLabel, 8, 12);
    }

    if (points.length < 2) return;
    const step = Math.max(1, Math.floor(points.length / 700));
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, plotW, plotH);
    ctx.clip();
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    let drawn = 0;
    for (let i = 0; i < points.length; i += step) {
      const px = left + ((points[i].x - viewX0) / (viewX1 - viewX0)) * plotW;
      const py = top + plotH - ((points[i].y - viewY0) / (viewY1 - viewY0)) * plotH;
      if (drawn === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
      drawn += 1;
    }
    const last = points[points.length - 1];
    const lastX = left + ((last.x - viewX0) / (viewX1 - viewX0)) * plotW;
    const lastY = top + plotH - ((last.y - viewY0) / (viewY1 - viewY0)) * plotH;
    ctx.lineTo(lastX, lastY);
    ctx.stroke();
    ctx.restore();
  }, [values, xKey, color, xMin, xMax, yMin, yMax, xLabel, yLabel, xs]);

  return <canvas ref={ref} width={960} height={260} className="h-64 w-full rounded-xl" />;
}
