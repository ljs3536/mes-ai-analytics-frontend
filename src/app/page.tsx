"use client";

// 파형 분석. 설비를 고르면 연결된 센서마다 시간 파형과 스펙트럼을 따로 보여 준다.

import { useEffect, useState } from "react";
import { LineChart } from "@/components/LineChart";
import { loadSensors, loadWaveform } from "@/lib/actions";
import type { MachineSensor, Waveform } from "@/lib/api";

const MACHINES = ["MACHINE_A", "MACHINE_B"];

export default function WaveformPage() {
  const [machine, setMachine] = useState("MACHINE_A");
  const [sensors, setSensors] = useState<MachineSensor[]>([]);
  const [waves, setWaves] = useState<Record<string, Waveform | null>>({});
  const [missing, setMissing] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

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

  return (
    <>
      <header className="flex items-end justify-between border-b border-white/8 px-8 py-6">
        <div>
          <h2 className="text-2xl font-semibold text-zinc-50">파형 분석</h2>
          <p className="mt-1 text-sm text-zinc-400">
            선택한 설비에 연결된 센서를 한 화면에서 모두 봅니다. 센서를 다시 고르지 않습니다.
          </p>
        </div>
        <select
          value={machine}
          onChange={(e) => setMachine(e.target.value)}
          className="rounded-lg border border-white/10 bg-[#12181f] px-3 py-2 text-sm"
        >
          {MACHINES.map((code) => (
            <option key={code}>{code}</option>
          ))}
        </select>
      </header>
      <main className="space-y-8 p-8">
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        {sensors.length === 0 ? (
          <p className="text-sm text-zinc-500">연결된 센서가 없습니다. 센서 연결 화면에서 추가하세요.</p>
        ) : null}
        {sensors.map((sensor) => {
          const wave = waves[sensor.code];
          const spectrum = wave
            ? wave.magnitudes.slice(1).filter((_, i) => wave.freqs[i + 1] <= 1200)
            : [];
          return (
            <section key={sensor.id} className="space-y-4">
              <div>
                <h3 className="text-lg text-zinc-100">
                  {sensor.name}{" "}
                  <span className="font-mono text-sm text-zinc-500">{sensor.code}</span>
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  {sensor.sensorType} · {sensor.mount} · {sensor.sampleRate} Hz × {sensor.nSamples} ·{" "}
                  {sensor.intervalS >= 3600 ? `${sensor.intervalS / 3600}시간` : `${sensor.intervalS}초`}마다 수집
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
                  <p className="mb-3 text-sm text-zinc-300">시간 파형</p>
                  <LineChart values={wave?.samples ?? []} />
                </div>
                <div className="rounded-2xl border border-white/8 bg-[#12181f] p-5">
                  <p className="mb-3 text-sm text-zinc-300">스펙트럼 (0–1200 Hz)</p>
                  <LineChart values={spectrum} color="#fbbf24" />
                </div>
              </div>
            </section>
          );
        })}
      </main>
    </>
  );
}
