"use client";

// 실시간 파형. 설비의 센서마다 최신 블록의 시간 파형, 진폭 스펙트럼, Welch PSD를 보여 준다. 단위, 이동 RMS, FFT 윈도우, 축 고정을 고른다.

import { useEffect, useMemo, useState } from "react";
import { LineChart } from "@/components/LineChart";
import { loadSensors, loadWaveform } from "@/lib/actions";
import type { MachineSensor, Waveform } from "@/lib/api";
import {
  convertUnit,
  extent,
  levelStats,
  slidingRms,
  spectrum,
  welchPsd,
  withTime,
  type FftWindow,
  type Quantity,
  type Series,
} from "@/lib/signal";

const MACHINES = ["MACHINE_A", "MACHINE_B"];
const fieldClass = "rounded-lg border border-white/10 bg-[#0c1117] px-3 py-2 text-sm text-zinc-100";

function viewOf(wave: Waveform, quantity: Quantity, mvPerG: number, rmsMs: number, fftWindow: FftWindow) {
  const target = quantity === "v" || quantity === "rms-v" ? "v" : quantity === "g" || quantity === "rms-g" ? "g" : "raw";
  const converted = convertUnit(wave.samples, wave.unit || "g", target, mvPerG);
  const time =
    quantity === "rms-g" || quantity === "rms-v"
      ? slidingRms(converted.ys, wave.sampleRate, rmsMs, converted.unit)
      : withTime(converted.ys, wave.sampleRate, converted.unit);
  const signal = converted.ys;
  return {
    time,
    spec: spectrum(signal, wave.sampleRate, fftWindow, converted.unit),
    psd: welchPsd(signal, wave.sampleRate, fftWindow, converted.unit),
  };
}

function union(rows: Series[], xMax?: number) {
  let box: { xMin: number; xMax: number; yMin: number; yMax: number } | null = null;
  for (const row of rows) {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < row.ys.length; i++) {
      if (xMax !== undefined && row.xs[i] > xMax) continue;
      xs.push(row.xs[i]);
      ys.push(row.ys[i]);
    }
    const next = extent(xs, ys);
    if (!next) continue;
    box = box
      ? {
          xMin: Math.min(box.xMin, next.xMin),
          xMax: Math.max(box.xMax, next.xMax),
          yMin: Math.min(box.yMin, next.yMin),
          yMax: Math.max(box.yMax, next.yMax),
        }
      : next;
  }
  return box;
}

function AxisFields({
  title,
  xLock,
  yLock,
  xMin,
  xMax,
  yMin,
  yMax,
  onXLock,
  onYLock,
  onXMin,
  onXMax,
  onYMin,
  onYMax,
  onCapture,
}: {
  title: string;
  xLock: boolean;
  yLock: boolean;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  onXLock: (value: boolean) => void;
  onYLock: (value: boolean) => void;
  onXMin: (value: number) => void;
  onXMax: (value: number) => void;
  onYMin: (value: number) => void;
  onYMax: (value: number) => void;
  onCapture: () => void;
}) {
  const num = (value: number, set: (next: number) => void) => (
    <input
      className={`${fieldClass} w-24`}
      type="number"
      step="any"
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => set(Number(e.target.value))}
    />
  );
  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-400">{title}</p>
      <div className="flex items-center gap-2 text-xs text-zinc-300">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={xLock} onChange={(e) => onXLock(e.target.checked)} />
          X축 고정
        </label>
        {num(xMin, onXMin)}
        {num(xMax, onXMax)}
      </div>
      <div className="flex items-center gap-2 text-xs text-zinc-300">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={yLock} onChange={(e) => onYLock(e.target.checked)} />
          Y축 고정
        </label>
        {num(yMin, onYMin)}
        {num(yMax, onYMax)}
      </div>
      <button type="button" className="text-xs text-sky-300" onClick={onCapture}>
        현재 범위로 고정
      </button>
    </div>
  );
}

export default function WaveformPage() {
  const [machine, setMachine] = useState("MACHINE_A");
  const [sensors, setSensors] = useState<MachineSensor[]>([]);
  const [waves, setWaves] = useState<Record<string, Waveform | null>>({});
  const [missing, setMissing] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<Quantity>("raw");
  const [mvPerG, setMvPerG] = useState(100);
  const [rmsMs, setRmsMs] = useState(100);
  const [fftWindow, setFftWindow] = useState<FftWindow>("hann");
  const [timeXLock, setTimeXLock] = useState(false);
  const [timeYLock, setTimeYLock] = useState(false);
  const [timeXMin, setTimeXMin] = useState(0);
  const [timeXMax, setTimeXMax] = useState(1);
  const [timeYMin, setTimeYMin] = useState(-1);
  const [timeYMax, setTimeYMax] = useState(1);
  const [specXLock, setSpecXLock] = useState(false);
  const [specYLock, setSpecYLock] = useState(false);
  const [specXMin, setSpecXMin] = useState(0);
  const [specXMax, setSpecXMax] = useState(1200);
  const [specYMin, setSpecYMin] = useState(0);
  const [specYMax, setSpecYMax] = useState(1);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const list = await loadSensors(machine);
        if (stop) return;
        setSensors(list);
        setError(null);
        const next: Record<string, Waveform | null> = {};
        const gaps: Record<string, string> = {};
        await Promise.all(
          list.map(async (sensor) => {
            try {
              next[sensor.code] = await loadWaveform(machine, sensor.code);
            } catch (e) {
              next[sensor.code] = null;
              gaps[sensor.code] = e instanceof Error ? e.message : "파형 없음";
            }
          }),
        );
        if (!stop) {
          setWaves(next);
          setMissing(gaps);
        }
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : "센서 목록을 가져오지 못했습니다");
      }
    };
    setSensors([]);
    setWaves({});
    tick();
    const id = setInterval(tick, 15000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [machine]);

  const views = useMemo(() => {
    const out: Record<string, { time: Series; spec: Series; psd: Series }> = {};
    for (const sensor of sensors) {
      const wave = waves[sensor.code];
      if (wave) out[sensor.code] = viewOf(wave, quantity, mvPerG, rmsMs, fftWindow);
    }
    return out;
  }, [sensors, waves, quantity, mvPerG, rmsMs, fftWindow]);

  const capture = (kind: "time" | "spec") => {
    const rows = Object.values(views).map((view) => (kind === "time" ? view.time : view.spec));
    const box = union(rows, kind === "spec" && !specXLock ? 1200 : undefined);
    if (!box) return;
    const round = (value: number) => Math.round(value * 10000) / 10000;
    if (kind === "time") {
      setTimeXMin(round(box.xMin));
      setTimeXMax(round(box.xMax));
      setTimeYMin(round(box.yMin));
      setTimeYMax(round(box.yMax));
      setTimeXLock(true);
      setTimeYLock(true);
      return;
    }
    setSpecXMin(round(box.xMin));
    setSpecXMax(round(box.xMax));
    setSpecYMin(round(box.yMin));
    setSpecYMax(round(box.yMax));
    setSpecXLock(true);
    setSpecYLock(true);
  };

  return (
    <>
      <header className="flex items-end justify-between border-b border-white/8 px-8 py-6">
        <div>
          <h2 className="text-2xl font-semibold text-zinc-50">실시간 파형</h2>
          <p className="mt-1 text-sm text-zinc-400">
            받은 파형은 그대로 두고, 이 화면에서만 V와 g로 바꿔 봅니다.
          </p>
        </div>
        <select value={machine} onChange={(e) => setMachine(e.target.value)} className={fieldClass}>
          {MACHINES.map((code) => (
            <option key={code}>{code}</option>
          ))}
        </select>
      </header>
      <section className="border-b border-white/8 px-8 py-5">
        <h3 className="text-sm font-medium text-zinc-200">표시 설정</h3>
        <p className="mt-1 text-xs text-zinc-500">
          화면 단위를 전압 V 또는 가속도 g로 고릅니다. g = V ÷ (감도 mV/g ÷ 1000) 입니다. 세로축은 파형에 맞춰 다시 그려지므로 모양은 비슷하고, 피크와 블록 RMS 숫자가 달라집니다. 이동 RMS는 창 안의 샘플로 실효값 √(평균 제곱)을 이어 붙인 곡선이고, 단위는 화면 단위와 같습니다.
        </p>
      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <label className="block text-sm text-zinc-400">
          화면 단위
          <select value={quantity} onChange={(e) => setQuantity(e.target.value as Quantity)} className={`${fieldClass} mt-1 w-full`}>
            <option value="raw">받은 값 그대로</option>
            <option value="v">전압 V</option>
            <option value="g">가속도 g</option>
            <option value="rms-v">이동 RMS (V)</option>
            <option value="rms-g">이동 RMS (g)</option>
          </select>
        </label>
        <label className="block text-sm text-zinc-400">
          감도 (mV/g)
          <input
            className={`${fieldClass} mt-1 w-full`}
            type="number"
            min={0.001}
            step="any"
            value={mvPerG}
            onChange={(e) => setMvPerG(Number(e.target.value))}
          />
        </label>
        <label className="block text-sm text-zinc-400">
          RMS 창 (ms)
          <input
            className={`${fieldClass} mt-1 w-full`}
            type="number"
            min={1}
            step={1}
            value={rmsMs}
            onChange={(e) => setRmsMs(Number(e.target.value))}
          />
        </label>
        <label className="block text-sm text-zinc-400">
          FFT 윈도우
          <select value={fftWindow} onChange={(e) => setFftWindow(e.target.value as FftWindow)} className={`${fieldClass} mt-1 w-full`}>
            <option value="rect">사각</option>
            <option value="hann">Hann</option>
            <option value="hamming">Hamming</option>
            <option value="blackman">Blackman</option>
            <option value="flattop">Flat-top</option>
          </select>
        </label>
        <AxisFields
          title="시간 파형 축. 고정하지 않으면 들어온 파형에 맞춥니다."
          xLock={timeXLock}
          yLock={timeYLock}
          xMin={timeXMin}
          xMax={timeXMax}
          yMin={timeYMin}
          yMax={timeYMax}
          onXLock={setTimeXLock}
          onYLock={setTimeYLock}
          onXMin={setTimeXMin}
          onXMax={setTimeXMax}
          onYMin={setTimeYMin}
          onYMax={setTimeYMax}
          onCapture={() => capture("time")}
        />
        <AxisFields
          title="스펙트럼 축. 가로축을 고정하지 않으면 0–1200 Hz입니다."
          xLock={specXLock}
          yLock={specYLock}
          xMin={specXMin}
          xMax={specXMax}
          yMin={specYMin}
          yMax={specYMax}
          onXLock={setSpecXLock}
          onYLock={setSpecYLock}
          onXMin={setSpecXMin}
          onXMax={setSpecXMax}
          onYMin={setSpecYMin}
          onYMax={setSpecYMax}
          onCapture={() => capture("spec")}
        />
      </div>
      </section>
      <main className="space-y-8 p-8">
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        {sensors.length === 0 ? (
          <p className="text-sm text-zinc-500">연결된 센서가 없습니다. 센서 연결 화면에서 추가하세요.</p>
        ) : null}
        {sensors.map((sensor) => {
          const wave = waves[sensor.code];
          const view = views[sensor.code];
          const time = view?.time;
          const spec = view?.spec;
          const psd = view?.psd;
          const level = levelStats(time?.ys ?? []);
          const levelText = (value: number) =>
            Math.abs(value) !== 0 && (Math.abs(value) >= 1000 || Math.abs(value) < 0.001)
              ? value.toExponential(3)
              : value.toPrecision(4);
          return (
            <section key={sensor.id} className="space-y-4">
              <div>
                <h3 className="text-lg text-zinc-100">
                  {sensor.name} <span className="font-mono text-sm text-zinc-500">{sensor.code}</span>
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  {sensor.sensorType} · {sensor.mount} · {sensor.sampleRate} Hz × {sensor.nSamples} ·{" "}
                  {sensor.intervalS >= 3600 ? `${sensor.intervalS / 3600}시간` : `${sensor.intervalS}초`}마다 수집 · 저장 단위{" "}
                  {wave?.unit || sensor.unit}
                </p>
                {wave ? (
                  <p className="mt-1 font-mono text-xs text-zinc-500">
                    {wave.rpm.toFixed(0)} rpm · {wave.ts}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-zinc-500">{missing[sensor.code] ?? "파형을 기다리는 중"}</p>
                )}
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/8 bg-[#12181f] p-5">
                  <p className="mb-3 text-sm text-zinc-300">
                    시간 파형 · 화면 {time?.unit ?? sensor.unit}
                    {wave ? ` · 수신 ${wave.unit || sensor.unit}` : ""}
                    {level ? ` · 피크 ${levelText(level.peak)} · 블록 RMS ${levelText(level.rms)}` : ""}
                  </p>
                  <LineChart
                    values={time?.ys ?? []}
                    xs={time?.xs}
                    xLabel="s"
                    yLabel={time?.unit}
                    xMin={timeXLock ? timeXMin : undefined}
                    xMax={timeXLock ? timeXMax : undefined}
                    yMin={timeYLock ? timeYMin : undefined}
                    yMax={timeYLock ? timeYMax : undefined}
                  />
                </div>
                <div className="rounded-2xl border border-white/8 bg-[#12181f] p-5">
                  <p className="mb-3 text-sm text-zinc-300">
                    스펙트럼 · {fftWindow} · {spec?.unit ?? ""}
                  </p>
                  <LineChart
                    values={spec?.ys ?? []}
                    xs={spec?.xs}
                    color="#fbbf24"
                    xLabel="Hz"
                    yLabel={spec?.unit}
                    xMin={specXLock ? specXMin : 0}
                    xMax={specXLock ? specXMax : 1200}
                    yMin={specYLock ? specYMin : undefined}
                    yMax={specYLock ? specYMax : undefined}
                  />
                </div>
                <div className="rounded-2xl border border-white/8 bg-[#12181f] p-5 xl:col-span-2">
                  <p className="mb-3 text-sm text-zinc-300">
                    PSD · Welch · {fftWindow} · {psd?.unit ?? ""}
                  </p>
                  <p className="mb-3 text-xs text-zinc-500">
                    겹친 구간을 평균한 전력 스펙트럼 밀도입니다. 세로축은 10 log10(단위²/Hz)이고, 가로축은 스펙트럼과 같은 범위를 씁니다.
                  </p>
                  <LineChart
                    values={psd?.ys ?? []}
                    xs={psd?.xs}
                    color="#c4b5fd"
                    xLabel="Hz"
                    yLabel={psd?.unit}
                    xMin={specXLock ? specXMin : 0}
                    xMax={specXLock ? specXMax : 1200}
                  />
                </div>
              </div>
            </section>
          );
        })}
      </main>
    </>
  );
}
