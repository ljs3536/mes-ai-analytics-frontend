"use client";

import { useEffect, useState } from "react";
import { LineChart } from "@/components/LineChart";
import { loadWaveform } from "@/lib/actions";
import type { Waveform } from "@/lib/api";

const MACHINES = ["MACHINE_A", "MACHINE_B"];

export default function WaveformPage() {
  const [machine, setMachine] = useState("MACHINE_A");
  const [wave, setWave] = useState<Waveform | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const data = await loadWaveform(machine);
        if (!stop) {
          setWave(data);
          setError(null);
        }
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : "파형을 가져오지 못했습니다");
      }
    };
    setWave(null);
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [machine]);

  const spectrum = wave
    ? wave.magnitudes.slice(1).filter((_, i) => wave.freqs[i + 1] <= 1200)
    : [];

  return (
    <>
      <header className="flex items-end justify-between border-b border-white/8 px-8 py-6">
        <div>
          <h2 className="text-2xl font-semibold text-zinc-50">파형 분석</h2>
          <p className="mt-1 text-sm text-zinc-400">수집기가 저장한 최신 진동 블록과 스펙트럼입니다.</p>
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
      <main className="space-y-6 p-8">
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        {wave ? (
          <p className="font-mono text-xs text-zinc-500">
            {wave.channel} · {wave.sampleRate} Hz · {wave.n} samples · 해상도{" "}
            {(wave.sampleRate / wave.n).toFixed(2)} Hz · {wave.rpm.toFixed(0)} rpm · {wave.ts}
          </p>
        ) : (
          <p className="text-sm text-zinc-500">파형을 기다리는 중</p>
        )}
        <section className="rounded-2xl border border-white/8 bg-[#12181f] p-5">
          <h3 className="mb-3 text-sm text-zinc-300">시간 파형</h3>
          <LineChart values={wave?.samples ?? []} />
        </section>
        <section className="rounded-2xl border border-white/8 bg-[#12181f] p-5">
          <h3 className="mb-3 text-sm text-zinc-300">스펙트럼 (0–1200 Hz)</h3>
          <LineChart values={spectrum} color="#fbbf24" />
        </section>
      </main>
    </>
  );
}
