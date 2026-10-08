"use client";

// 센서 연결. 설비에 센서를 추가하고, 목록에서 고른 센서의 샘플레이트·샘플 수·주기·파형을 저장한다.

import { useEffect, useState } from "react";
import { LineChart } from "@/components/LineChart";
import {
  createSensor,
  deleteSensor,
  loadMachines,
  loadPresets,
  loadSensors,
  previewChannel,
  saveSensor,
} from "@/lib/actions";
import type { MachineSensor, Presets } from "@/lib/api";

const blank = {
  code: "PIEZO_FRONT",
  name: "스핀들 전면 베어링",
  sensorType: "PIEZO",
  mount: "스핀들 전면 반경",
  unit: "g",
  sampleRate: 2560,
  nSamples: 1024,
  intervalS: 3600,
  preset: "normal",
  severity: 0.2,
  enabled: true,
};

const RATED_RPM: Record<string, number> = { MACHINE_A: 3000, MACHINE_B: 2400 };

export default function SensorLinkPage() {
  const [machines, setMachines] = useState<{ code: string; name: string }[]>([]);
  const [machine, setMachine] = useState("MACHINE_A");
  const [sensors, setSensors] = useState<MachineSensor[]>([]);
  const [draft, setDraft] = useState(blank);
  const [selected, setSelected] = useState<MachineSensor | null>(null);
  const [presets, setPresets] = useState<Presets | null>(null);
  const [preview, setPreview] = useState<number[]>([]);
  const [meta, setMeta] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function refresh(code = machine) {
    const list = await loadSensors(code);
    setSensors(list);
    return list;
  }

  useEffect(() => {
    loadMachines()
      .then((rows) => setMachines(rows.map((row) => ({ code: row.code, name: row.name }))))
      .catch((e: Error) => setMessage(e.message));
    loadPresets()
      .then(setPresets)
      .catch((e: Error) => setMessage(e.message));
  }, []);

  useEffect(() => {
    setSelected(null);
    setPreview([]);
    setMeta("");
    refresh(machine).catch((e: Error) => setMessage(e.message));
  }, [machine]);

  function choose(sensor: MachineSensor) {
    setSelected(sensor);
    setPreview([]);
    setMeta("");
    setMessage(null);
  }

  function setField<K extends keyof MachineSensor>(key: K, value: MachineSensor[K]) {
    setSelected((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  const resolution =
    selected && selected.nSamples > 0 ? (selected.sampleRate / selected.nSamples).toFixed(2) : "0";
  const duration =
    selected && selected.sampleRate > 0 ? (selected.nSamples / selected.sampleRate).toFixed(3) : "0";

  return (
    <>
      <header className="border-b border-white/8 px-8 py-6">
        <h2 className="text-2xl font-semibold text-zinc-50">센서 연결</h2>
        <p className="mt-1 text-sm text-zinc-400">
          설비에 센서를 추가한 뒤 목록에서 고르면 샘플레이트, 샘플 개수, 수집 주기, 파형을 바꿉니다.
        </p>
      </header>
      <main className="grid gap-6 p-8 xl:grid-cols-[22rem_1fr]">
        <section className="space-y-4">
          <div className="space-y-3 rounded-2xl border border-white/8 bg-[#12181f] p-5">
            <label className="block text-sm text-zinc-400">
              설비
              <select
                value={machine}
                onChange={(e) => setMachine(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c1117] px-3 py-2"
              >
                {(machines.length
                  ? machines
                  : [
                      { code: "MACHINE_A", name: "Machine A" },
                      { code: "MACHINE_B", name: "Machine B" },
                    ]
                ).map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name} ({item.code})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-zinc-400">
              센서 코드
              <input
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c1117] px-3 py-2 text-zinc-100"
              />
            </label>
            <label className="block text-sm text-zinc-400">
              이름
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c1117] px-3 py-2 text-zinc-100"
              />
            </label>
            <label className="block text-sm text-zinc-400">
              설치 위치
              <input
                value={draft.mount}
                onChange={(e) => setDraft({ ...draft, mount: e.target.value })}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c1117] px-3 py-2 text-zinc-100"
              />
            </label>
            <button
              className="rounded-lg bg-sky-400 px-3 py-2 text-sm font-medium text-zinc-950"
              onClick={() =>
                createSensor(machine, draft)
                  .then((created) => refresh().then(() => created))
                  .then((created) => {
                    setSelected(created);
                    setMessage(`${machine}에 ${created.code}를 연결했습니다`);
                  })
                  .catch((e: Error) => setMessage(e.message))
              }
            >
              이 설비에 센서 추가
            </button>
          </div>
          <div className="rounded-2xl border border-white/8 bg-[#12181f] p-5">
            <h3 className="mb-3 text-sm text-zinc-300">
              {machine} 센서 {sensors.length}개
            </h3>
            {sensors.length === 0 ? <p className="text-sm text-zinc-500">아직 없습니다.</p> : null}
            <ul className="space-y-2">
              {sensors.map((sensor, index) => (
                <li key={sensor.id}>
                  <button
                    className={`w-full rounded-xl px-3 py-3 text-left ${
                      selected?.id === sensor.id ? "bg-sky-400/15" : "bg-white/4 hover:bg-white/8"
                    }`}
                    onClick={() => choose(sensor)}
                  >
                    <span className="block text-sm text-zinc-100">
                      센서 {index + 1} · {sensor.name}
                    </span>
                    <span className="mt-1 block font-mono text-xs text-zinc-500">
                      {sensor.code} · {sensor.preset} · {sensor.sampleRate} Hz × {sensor.nSamples}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {selected ? (
          <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
            <section className="space-y-3 rounded-2xl border border-white/8 bg-[#12181f] p-5">
              <h3 className="text-sm text-zinc-200">
                {selected.name} <span className="font-mono text-zinc-500">{selected.code}</span>
              </h3>
              <label className="block text-sm text-zinc-400">
                샘플레이트 (Hz)
                <input
                  type="number"
                  value={selected.sampleRate}
                  onChange={(e) => setField("sampleRate", Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c1117] px-3 py-2 text-zinc-100"
                />
              </label>
              <label className="block text-sm text-zinc-400">
                샘플 개수
                <select
                  value={selected.nSamples}
                  onChange={(e) => setField("nSamples", Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c1117] px-3 py-2"
                >
                  {(presets?.sampleCounts ?? [256, 512, 1024, 2048, 4096, 8192]).map((n) => (
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
                  min={1}
                  value={selected.intervalS}
                  onChange={(e) => setField("intervalS", Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c1117] px-3 py-2 text-zinc-100"
                />
              </label>
              <label className="block text-sm text-zinc-400">
                파형
                <select
                  value={selected.preset}
                  onChange={(e) => setField("preset", e.target.value)}
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
                세기 {selected.severity.toFixed(2)}
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={selected.severity}
                  onChange={(e) => setField("severity", Number(e.target.value))}
                  className="mt-2 w-full"
                />
              </label>
              <p className="text-xs text-zinc-500">
                해상도 {resolution} Hz · 블록 {duration}초
              </p>
              <p className="text-xs text-zinc-500">저장하면 재시작 없이 다음 수집부터 반영됩니다.</p>
              {message ? <p className="text-sm text-amber-200">{message}</p> : null}
              <div className="flex gap-2">
                <button
                  className="rounded-lg bg-sky-400 px-3 py-2 text-sm font-medium text-zinc-950"
                  onClick={() =>
                    saveSensor(selected)
                      .then((saved) => refresh().then(() => saved))
                      .then((saved) => {
                        setSelected(saved);
                        setMessage("저장했습니다");
                      })
                      .catch((e: Error) => setMessage(e.message))
                  }
                >
                  저장
                </button>
                <button
                  className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200"
                  onClick={() =>
                    previewChannel({
                      sampleRate: selected.sampleRate,
                      nSamples: selected.nSamples,
                      rpm: RATED_RPM[machine] ?? 1800,
                      preset: selected.preset,
                      severity: selected.severity,
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
                <button
                  className="rounded-lg px-3 py-2 text-sm text-rose-300"
                  onClick={() =>
                    deleteSensor(selected.id)
                      .then(() => refresh())
                      .then(() => {
                        setSelected(null);
                        setPreview([]);
                        setMessage(`${selected.code} 연결을 해제했습니다`);
                      })
                      .catch((e: Error) => setMessage(e.message))
                  }
                >
                  해제
                </button>
              </div>
            </section>
            <section className="rounded-2xl border border-white/8 bg-[#12181f] p-5">
              <h3 className="mb-3 text-sm text-zinc-300">{meta || "미리보기"}</h3>
              <LineChart values={preview} />
            </section>
          </div>
        ) : (
          <section className="rounded-2xl border border-dashed border-white/10 bg-[#12181f] p-8">
            <p className="text-sm text-zinc-400">센서 목록에서 하나를 선택하면 파형 설정 화면이 열립니다.</p>
            {message ? <p className="mt-3 text-sm text-amber-200">{message}</p> : null}
          </section>
        )}
      </main>
    </>
  );
}
