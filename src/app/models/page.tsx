"use client";

// 모델. 설비 특징값으로 Isolation Forest를 학습하고, 운영 버전을 지정하며 최근 판정을 본다.

import { useEffect, useState } from "react";
import { loadModels, promoteModel, trainModel } from "@/lib/actions";
import type { Live, ModelList } from "@/lib/api";

export default function ModelsPage() {
  const [models, setModels] = useState<ModelList | null>(null);
  const [live, setLive] = useState<Live["predictions"]>({});
  const [machine, setMachine] = useState("MACHINE_A");
  const [minutes, setMinutes] = useState(10);
  const [contamination, setContamination] = useState(0.05);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const data = await loadModels();
    setModels(data.models);
    setLive(data.live.predictions);
  }

  useEffect(() => {
    refresh().catch((e: Error) => setMessage(e.message));
    const id = setInterval(() => {
      refresh().catch(() => undefined);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <header className="border-b border-white/8 px-8 py-6">
        <h2 className="text-2xl font-semibold text-zinc-50">모델</h2>
        <p className="mt-1 text-sm text-zinc-400">
          정상 구간의 특징값으로 Isolation Forest를 학습하고, MLflow에 버전을 남깁니다. 운영 모델이 특징값을 받아
          이상을 판정합니다.
        </p>
      </header>
      <main className="grid gap-6 p-8 lg:grid-cols-2">
        <section className="space-y-3 rounded-2xl border border-white/8 bg-[#12181f] p-5">
          <h3 className="text-sm text-zinc-300">학습</h3>
          <p className="text-xs text-zinc-500">정상 프리셋으로 파형이 쌓인 뒤 학습하세요. 최소 30블록이 필요합니다.</p>
          <label className="block text-sm text-zinc-400">
            설비
            <select
              value={machine}
              onChange={(e) => setMachine(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c1117] px-3 py-2"
            >
              <option>MACHINE_A</option>
              <option>MACHINE_B</option>
            </select>
          </label>
          <label className="block text-sm text-zinc-400">
            최근 분
            <input
              type="number"
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c1117] px-3 py-2"
            />
          </label>
          <label className="block text-sm text-zinc-400">
            contamination
            <input
              type="number"
              step="0.01"
              value={contamination}
              onChange={(e) => setContamination(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c1117] px-3 py-2"
            />
          </label>
          {message ? <p className="text-sm text-amber-200">{message}</p> : null}
          <button
            className="rounded-lg bg-sky-400 px-3 py-2 text-sm font-medium text-zinc-950"
            onClick={() =>
              trainModel({ machine, minutes, contamination })
                .then((result) => setMessage(`v${result.version} 학습 완료 (${result.rows}개) · 운영 모델로 지정`))
                .then(refresh)
                .catch((e: Error) => setMessage(e.message))
            }
          >
            학습 후 운영 지정
          </button>
        </section>
        <section className="space-y-4 rounded-2xl border border-white/8 bg-[#12181f] p-5">
          <h3 className="text-sm text-zinc-300">실시간 판정</h3>
          {Object.keys(live).length === 0 ? <p className="text-sm text-zinc-500">아직 판정이 없습니다.</p> : null}
          {Object.entries(live).map(([code, row]) => (
            <p key={code} className="font-mono text-sm text-zinc-200">
              {code} v{row.version} score {row.score.toFixed(3)}{" "}
              <span className={row.isAnomaly ? "text-rose-300" : "text-emerald-300"}>
                {row.isAnomaly ? "이상" : "정상"}
              </span>
            </p>
          ))}
          <h3 className="pt-2 text-sm text-zinc-300">버전 {models ? `· 운영 v${models.production ?? "-"}` : ""}</h3>
          <ul className="space-y-2 text-sm">
            {models?.versions.map((version) => (
              <li key={version.version} className="flex items-center justify-between text-zinc-300">
                <span>
                  v{version.version}
                  {models.production === version.version ? " · 운영" : ""}
                </span>
                {models.production === version.version ? null : (
                  <button
                    className="text-sky-300"
                    onClick={() =>
                      promoteModel(version.version)
                        .then(() => setMessage(`v${version.version}을 운영 모델로 지정했습니다`))
                        .then(refresh)
                        .catch((e: Error) => setMessage(e.message))
                    }
                  >
                    운영 지정
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
