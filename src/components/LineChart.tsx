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

function superscript(exp: number) {
  const digits = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  const body = String(Math.abs(exp)).replace(/\d/g, (digit) => digits[Number(digit)]);
  return exp < 0 ? `⁻${body}` : body;
}

function axisScale(min: number, max: number) {
  const span = Math.max(max - min, 1e-12);
  const exp = Math.floor(Math.log10(span));
  if (exp >= -1 && exp <= 4) return { div: 1, note: "" };
  return { div: 10 ** exp, note: `×10${superscript(exp)}` };
}

function tickText(value: number, step: number) {
  const decimals = Math.min(4, Math.max(0, -Math.floor(Math.log10(step)) ));
  const text = value.toFixed(decimals);
  return text.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function ticks(min: number, max: number, div: number) {
  const step = niceStep((max - min) / div);
  const start = Math.ceil(min / div / step - 1e-9) * step;
  const out: number[] = [];
  for (let i = 0; i < 8; i++) {
    const value = start + i * step;
    if (value > max / div + step * 0.01) break;
    if (value < min / div - step * 0.01) continue;
    out.push(value);
  }
  return { values: out, step };
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
  const xKey = xs?.length ? `${xs[0]}:${xs[xs.length - 1]}:${xs.length}` : "";

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const cssW = Math.max(canvas.clientWidth, 320);
      const cssH = Math.max(canvas.clientHeight, 220);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.fillStyle = "#0c1117";
      ctx.fillRect(0, 0, cssW, cssH);

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
      const yPad = (viewY1 - viewY0) * 0.08;
      if (yMin === undefined) viewY0 -= yPad;
      if (yMax === undefined) viewY1 += yPad;

      const xScale = axisScale(viewX0, viewX1);
      const yScale = axisScale(viewY0, viewY1);
      const xTicks = ticks(viewX0, viewX1, xScale.div);
      const yTicks = ticks(viewY0, viewY1, yScale.div);
      ctx.font = "13px ui-monospace, SFMono-Regular, monospace";
      let left = 52;
      for (const value of yTicks.values) {
        left = Math.max(left, ctx.measureText(tickText(value, yTicks.step)).width + 16);
      }
      const top = 28;
      const right = 16;
      const bottom = 28;
      const plotW = cssW - left - right;
      const plotH = cssH - top - bottom;
      const xOf = (x: number) => left + ((x - viewX0) / (viewX1 - viewX0)) * plotW;
      const yOf = (y: number) => top + plotH - ((y - viewY0) / (viewY1 - viewY0)) * plotH;

      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      ctx.strokeRect(left, top, plotW, plotH);
      ctx.fillStyle = "#e4e4e7";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const caption = [yLabel, yScale.note].filter(Boolean).join(" ");
      if (caption) ctx.fillText(caption, left, 6);

      ctx.textBaseline = "middle";
      for (const value of yTicks.values) {
        const py = yOf(value * yScale.div);
        if (py < top + 8 || py > top + plotH - 8) continue;
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.beginPath();
        ctx.moveTo(left, py);
        ctx.lineTo(left + plotW, py);
        ctx.stroke();
        ctx.fillStyle = "#e4e4e7";
        ctx.textAlign = "right";
        ctx.fillText(tickText(value, yTicks.step), left - 8, py);
      }

      ctx.textBaseline = "top";
      const xCaption = [xLabel, xScale.note].filter(Boolean).join(" ");
      const xCaptionW = xCaption ? ctx.measureText(xCaption).width + 12 : 0;
      let lastRight = -Infinity;
      for (const value of xTicks.values) {
        const px = xOf(value * xScale.div);
        const label = tickText(value, xTicks.step);
        const half = ctx.measureText(label).width / 2 + 6;
        if (px - half < left || px + half > left + plotW - xCaptionW) continue;
        if (px - half < lastRight) continue;
        lastRight = px + half;
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.beginPath();
        ctx.moveTo(px, top);
        ctx.lineTo(px, top + plotH);
        ctx.stroke();
        ctx.fillStyle = "#e4e4e7";
        ctx.textAlign = "center";
        ctx.fillText(label, px, top + plotH + 6);
      }
      if (xCaption) {
        ctx.fillStyle = "#e4e4e7";
        ctx.textAlign = "right";
        ctx.fillText(xCaption, left + plotW, top + plotH + 6);
      }

      if (points.length < 2) return;
      const step = Math.max(1, Math.floor(points.length / 700));
      ctx.save();
      ctx.beginPath();
      ctx.rect(left, top, plotW, plotH);
      ctx.clip();
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      let drawn = 0;
      for (let i = 0; i < points.length; i += step) {
        const px = xOf(points[i].x);
        const py = yOf(points[i].y);
        if (drawn === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
        drawn += 1;
      }
      ctx.lineTo(xOf(points[points.length - 1].x), yOf(points[points.length - 1].y));
      ctx.stroke();
      ctx.restore();
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [values, xKey, color, xMin, xMax, yMin, yMax, xLabel, yLabel, xs]);

  return <canvas ref={ref} className="h-64 w-full rounded-xl" />;
}
