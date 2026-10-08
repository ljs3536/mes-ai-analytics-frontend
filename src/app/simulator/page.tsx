"use client";

import { useEffect, useState } from "react";
import { LineChart } from "@/components/LineChart";
import { loadSimulator, previewChannel, saveChannel } from "@/lib/actions";
import type { Channel, Presets } from "@/lib/api";

const empty: Channel = {
  machine: "MACHINE_A",
  channel: "VIBRATION",
  sampleRate: 2560,
  nSamples: 1024,
  intervalS: 1,
  preset: "normal",
  severity: 0.3,
  ratedRpm: 3000,
  enabled: true,
};

export default function SimulatorPage() {
  const [presets, setPresets] = useState<Presets | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [form, setForm] = useState<Channel>(empty);
  const [preview, setPreview] = useState<number[]>([]);
  const [meta, setMeta] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const data = await loadSimulator();
    setPresets(data.presets);
    setChannels(data.channels);
  }

  useEffect(() => {
    refresh().catch((e: Error) => setMessage(e.message));
  }, []);

  function set<K extends keyof Channel>(key: K, value: Channel[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <>
      <header className="border-b border-white/8 px-8 py-6">
        <h2 className="text-2xl font-semibold text-zinc-50">센서 에뮬레이터</h2>
        <p className="mt-1 text-sm text-zinc-400">
          샘플레이트와 샘플 개수, 결함 파형을 바꾸면 재시작 없이 다음 블록부터 반영됩니다.
        </p>
      </header>
      <main className="grid gap-6 p-8 lg:grid-cols-[20rem_1fr]">
        <section className="space-y-3 rounded-2xl border border-white/8 bg-[#12181f] p-5">
          <label className="block text-sm text-zinc-400">
            설비
            <input
              value={form.machine}
              onChange={(e) => set("machine", e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c1117] px-3 py-2 text-zinc-100"
            />
          </label>
          <label className="block text-sm text-zinc-400">
            채널
            <input
              value={form.channel}
              onChange={(e) => set("channel", e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c1117] px-3 py-2 text-zinc-100"
            />
          </label>
          <label className="block text-sm text-zinc-400">
            샘플레이트 (Hz)
            <input
              type="number"
              value={form.sampleRate}
              onChange={(e) => set("sampleRate", Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c1117] px-3 py-2 text-zinc-100"
            />
          </label>
          <label className="block text-sm text-zinc-400">
            샘플 개수
            <select
              value={form.nSamples}
              onChange={(e) => set("nSamples", Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c1117] px-3 py-2"
            >
              {(presets?.sampleCounts ?? [256, 512, 1024, 2048, 4096]).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-zinc-400">
            수집 주기 (초)
            <input
              type="number"
              step="0.1"
              value={form.intervalS}
              onChange={(e) => set("intervalS", Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c1117] px-3 py-2 text-zinc-100"
            />
          </label>
          <label className="block text-sm text-zinc-400">
            파형
            <select
              value={form.preset}
              onChange={(e) => set("preset", e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c1117] px-3 py-2"
            >
              {(presets?.presets ?? [{ id: "normal", label: "정상" }]).map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-zinc-400">
            세기 {form.severity.toFixed(2)}
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={form.severity}
              onChange={(e) => set("severity", Number(e.target.value))}
              className="mt-2 w-full"
            />
          </label>
          <p className="text-xs text-zinc-500">
            해상도 {(form.sampleRate / form.nSamples).toFixed(2)} Hz · 블록{" "}
            {(form.nSamples / form.sampleRate).toFixed(3)}초
          </p>
          {message ? <p className="text-sm text-amber-200">{message}</p> : null}
          <div className="flex gap-2">
            <button
              className="rounded-lg bg-sky-400 px-3 py-2 text-sm font-medium text-zinc-950"
              onClick={() =>
                saveChannel(form)
                  .then(() => refresh())
                  .then(() => setMessage("저장했습니다"))
                  .catch((e: Error) => setMessage(e.message))
              }
            >
              저장
            </button>
            <button
              className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200"
              onClick={() =>
                previewChannel({
                  sampleRate: form.sampleRate,
                  nSamples: form.nSamples,
                  rpm: form.ratedRpm,
                  preset: form.preset,
                  severity: form.severity,
                })
                  .then((data) => {
                    setPreview(data.samples);
                    setMeta(`미리보기 · 해상도 ${data.resolutionHz} Hz · ${data.durationS}초`);
                  })
                  .catch((e: Error) => setMessage(e.message))
              }
            >
              미리보기
            </button>
          </div>
        </section>
        <div className="space-y-6">
          <section className="rounded-2xl border border-white/8 bg-[#12181f] p-5">
            <h3 className="mb-3 text-sm text-zinc-300">{meta || "미리보기"}</h3>
            <LineChart values={preview} />
          </section>
          <section className="rounded-2xl border border-white/8 bg-[#12181f] p-5">
            <h3 className="mb-3 text-sm text-zinc-300">저장된 채널</h3>
            <ul className="space-y-2 text-sm text-zinc-300">
              {channels.map((ch) => (
                <li key={`${ch.machine}-${ch.channel}`}>
                  <button className="text-left hover:text-sky-300" onClick={() => setForm(ch)}>
                    {ch.machine} / {ch.channel} · {ch.preset} · {ch.sampleRate} Hz × {ch.nSamples}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </>
  );
}
