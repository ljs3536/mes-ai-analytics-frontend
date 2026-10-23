"use client";

// 파형 이력. 기간으로 저장된 블록을 찾고, 고른 블록을 차트로 본 뒤 학습 세트로 저장한다.

import { useEffect, useMemo, useState } from "react";
import { LineChart } from "@/components/LineChart";
import { loadDatasets, loadSensors, loadWaveformAt, removeDataset, saveDataset, searchWaveforms } from "@/lib/actions";
import type { Dataset, MachineSensor, Waveform, WaveformSummary } from "@/lib/api";
import { spectrum, welchPsd, withTime } from "@/lib/signal";

const MACHINES = ["MACHINE_A", "MACHINE_B"];
const fieldClass = "rounded-lg border border-white/10 bg-[#0c1117] px-3 py-2 text-sm text-zinc-100";

function localInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function keyOf(row: { machine: string; channel: string; ts: string }) {
  return `${row.machine}|${row.channel}|${row.ts}`;
}

function stamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR", { hour12: false });
}

export default function HistoryPage() {
  const now = useMemo(() => new Date(), []);
  const [machine, setMachine] = useState("MACHINE_A");
  const [channel, setChannel] = useState("");
  const [sensors, setSensors] = useState<MachineSensor[]>([]);
  const [start, setStart] = useState(localInput(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)));
  const [stop, setStop] = useState(localInput(now));
  const [rows, setRows] = useState<WaveformSummary[]>([]);
  const [picked, setPicked] = useState<Record<string, WaveformSummary>>({});
  const [openKey, setOpenKey] = useState("");
  const [wave, setWave] = useState<Waveform | null>(null);
  const [sets, setSets] = useState<Dataset[]>([]);
  const [setName, setSetName] = useState("Set1");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadSensors(machine)
      .then(setSensors)
      .catch((e: Error) => setMessage(e.message));
    setChannel("");
  }, [machine]);

  useEffect(() => {
    loadDatasets()
      .then((data) => setSets(data.datasets))
      .catch((e: Error) => setMessage(e.message));
  }, []);

  const chosen = Object.values(picked);
  const view = useMemo(() => {
    if (!wave) return null;
    const time = withTime(wave.samples, wave.sampleRate, wave.unit || "V");
    return {
      time,
      spec: spectrum(wave.samples, wave.sampleRate, "hann", wave.unit || "V"),
      psd: welchPsd(wave.samples, wave.sampleRate, "hann", wave.unit || "V"),
    };
  }, [wave]);

  function search() {
    setBusy(true);
    setMessage(null);
    searchWaveforms(machine, channel, new Date(start).toISOString(), new Date(stop).toISOString())
      .then((found) => {
        setRows(found);
        setMessage(found.length ? `${found.length}개 블록` : "이 기간에 파형이 없습니다.");
      })
      .catch((e: Error) => setMessage(e.message))
      .finally(() => setBusy(false));
  }

  function toggle(row: WaveformSummary) {
    const key = keyOf(row);
    setPicked((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = row;
      return next;
    });
  }

  function open(row: WaveformSummary) {
    const key = keyOf(row);
    setOpenKey(key);
    setWave(null);
    loadWaveformAt(row.machine, row.channel, row.ts)
      .then(setWave)
      .catch((e: Error) => setMessage(e.message));
  }

  function save() {
    if (!chosen.length) {
      setMessage("저장할 블록을 선택하세요.");
      return;
    }
    saveDataset({
      name: setName.trim(),
      items: chosen.map((row) => ({
        machine: row.machine,
        channel: row.channel,
        ts: row.ts,
        rpm: row.rpm,
        n: row.n,
        unit: row.unit,
        preset: row.preset,
      })),
    })
      .then((saved) => {
        setSets((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)]);
        setPicked({});
        setSetName(`Set${sets.length + 2}`);
        setMessage(`${saved.name}에 ${saved.items.length}개 블록을 저장했습니다.`);
      })
      .catch((e: Error) => setMessage(e.message));
  }

  return (
    <>
      <header className="border-b border-white/8 px-8 py-6">
        <h2 className="text-2xl font-semibold text-zinc-50">파형 이력</h2>
        <p className="mt-1 max-w-3xl text-sm text-zinc-400">
          InfluxDB에 쌓인 파형 블록을 기간으로 찾습니다. 고른 블록은 샘플을 복사하지 않고 시각만 학습 세트로 저장합니다.
          보관 기간은 7일입니다.
        </p>
      </header>
      <section className="grid gap-3 border-b border-white/8 px-8 py-5 md:grid-cols-5">
        <label className="text-sm text-zinc-400">
          설비
          <select value={machine} onChange={(e) => setMachine(e.target.value)} className={`${fieldClass} mt-1 w-full`}>
            {MACHINES.map((code) => (
              <option key={code}>{code}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-zinc-400">
          센서
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className={`${fieldClass} mt-1 w-full`}>
            <option value="">전체</option>
            {sensors.map((sensor) => (
              <option key={sensor.id} value={sensor.code}>
                {sensor.code}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-zinc-400">
          시작
          <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={`${fieldClass} mt-1 w-full`} />
        </label>
        <label className="text-sm text-zinc-400">
          끝
          <input type="datetime-local" value={stop} onChange={(e) => setStop(e.target.value)} className={`${fieldClass} mt-1 w-full`} />
        </label>
        <div className="flex items-end">
          <button className="rounded-lg bg-sky-400 px-4 py-2 text-sm font-medium text-zinc-950" onClick={search} disabled={busy}>
            {busy ? "검색 중" : "검색"}
          </button>
        </div>
      </section>
      <main className="grid gap-6 p-8 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-white/8 bg-[#12181f]">
          <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
            <h3 className="text-sm text-zinc-200">블록 {rows.length}개 · 선택 {chosen.length}개</h3>
            <div className="flex items-center gap-2">
              <input value={setName} onChange={(e) => setSetName(e.target.value)} className={`${fieldClass} w-28`} />
              <button className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-100" onClick={save}>
                세트로 저장
              </button>
            </div>
          </div>
          <div className="max-h-[28rem] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-[#12181f] text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-2" />
                  <th className="px-2 py-2">시각</th>
                  <th className="px-2 py-2">센서</th>
                  <th className="px-2 py-2">rpm</th>
                  <th className="px-2 py-2">프리셋</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const key = keyOf(row);
                  return (
                    <tr
                      key={key}
                      className={`cursor-pointer border-t border-white/6 ${openKey === key ? "bg-sky-500/10" : "hover:bg-white/4"}`}
                      onClick={() => open(row)}
                    >
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={Boolean(picked[key])}
                          onChange={() => toggle(row)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="px-2 py-2 text-zinc-200">{stamp(row.ts)}</td>
                      <td className="px-2 py-2 text-zinc-400">{row.channel}</td>
                      <td className="px-2 py-2 font-mono text-zinc-300">{Math.round(row.rpm)}</td>
                      <td className="px-2 py-2 text-zinc-400">{row.preset || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {message ? <p className="border-t border-white/8 px-5 py-3 text-sm text-amber-200">{message}</p> : null}
        </section>
        <div className="space-y-4">
          <section className="rounded-2xl border border-white/8 bg-[#12181f] p-5">
            <h3 className="mb-3 text-sm text-zinc-200">
              {wave ? `${wave.channel} · ${stamp(wave.ts)} · ${wave.unit}` : "블록을 누르면 파형을 봅니다"}
            </h3>
            {view ? (
              <div className="space-y-4">
                <div>
                  <p className="mb-1 text-xs text-zinc-500">시간 파형</p>
                  <LineChart values={view.time.ys} xs={view.time.xs} xLabel="s" yLabel={view.time.unit} color="#7dd3fc" />
                </div>
                <div>
                  <p className="mb-1 text-xs text-zinc-500">스펙트럼 · Hann</p>
                  <LineChart values={view.spec.ys} xs={view.spec.xs} xMax={1200} xLabel="Hz" yLabel={view.spec.unit} color="#fbbf24" />
                </div>
                <div>
                  <p className="mb-1 text-xs text-zinc-500">PSD · Welch</p>
                  <LineChart values={view.psd.ys} xs={view.psd.xs} xMax={1200} xLabel="Hz" yLabel={view.psd.unit} color="#c4b5fd" />
                </div>
              </div>
            ) : null}
          </section>
          <section className="rounded-2xl border border-white/8 bg-[#12181f] p-5">
            <h3 className="mb-3 text-sm text-zinc-200">저장된 세트</h3>
            {sets.length === 0 ? <p className="text-sm text-zinc-500">아직 없습니다.</p> : null}
            {sets.map((item) => (
              <div key={item.id} className="mb-3 border-t border-white/6 pt-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-zinc-100">
                    {item.name} · {item.items.length}개
                  </p>
                  <button
                    className="text-xs text-rose-300"
                    onClick={() =>
                      removeDataset(item.id)
                        .then(() => setSets((prev) => prev.filter((row) => row.id !== item.id)))
                        .catch((e: Error) => setMessage(e.message))
                    }
                  >
                    삭제
                  </button>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {item.items
                    .slice(0, 3)
                    .map((block) => `${block.channel} ${stamp(block.ts)}`)
                    .join(" · ")}
                  {item.items.length > 3 ? " …" : ""}
                </p>
              </div>
            ))}
          </section>
        </div>
      </main>
    </>
  );
}
