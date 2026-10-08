"use client";

// 모델. 종류를 골라 여러 개를 만들고, 파라미터와 실시간 적용 여부를 저장한 뒤 학습한다.

import { useEffect, useState } from "react";
import { createModel, deleteModel, loadModels, trainManagedModel, updateModel } from "@/lib/actions";
import type { Live, ManagedModel, ModelCatalog } from "@/lib/api";

const emptyParams = (catalog: ModelCatalog | null, kind: string) => {
  const spec = catalog?.kinds.find((item) => item.id === kind);
  return Object.fromEntries((spec?.params ?? []).map((item) => [item.key, item.default]));
};

export default function ModelsPage() {
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null);
  const [live, setLive] = useState<Live["predictions"]>({});
  const [kind, setKind] = useState("isolation_forest");
  const [name, setName] = useState("진동 모델");
  const [realtime, setRealtime] = useState(false);
  const [draftParams, setDraftParams] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<ManagedModel | null>(null);
  const [machine, setMachine] = useState("MACHINE_A");
  const [minutes, setMinutes] = useState(10);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const data = await loadModels();
    setCatalog(data.models);
    setLive(data.live.predictions);
    setDraftParams((prev) => (Object.keys(prev).length ? prev : emptyParams(data.models, kind)));
    setSelected((prev) => {
      if (!prev) return prev;
      const next = data.models.models.find((item) => item.id === prev.id);
      if (!next) return null;
      if (next.status !== prev.status || next.version !== prev.version) return next;
      return prev;
    });
  }

  useEffect(() => {
    refresh().catch((e: Error) => setMessage(e.message));
    const id = setInterval(() => refresh().catch(() => undefined), 3000);
    return () => clearInterval(id);
  }, []);

  const createSpec = catalog?.kinds.find((item) => item.id === kind);
  const editSpec = catalog?.kinds.find((item) => item.id === selected?.kind);

  return (
    <>
      <header className="border-b border-white/8 px-8 py-6">
        <h2 className="text-2xl font-semibold text-zinc-50">모델</h2>
        <p className="mt-1 text-sm text-zinc-400">
          현재 실시간 판정에 쓰이던 모델은 Isolation Forest입니다. 모델을 여러 개 만들고, 파라미터를 바꾼 뒤 실시간
          데이터에 적용할지를 고릅니다. 적용은 학습이 끝난 모델만 합니다.
        </p>
      </header>
      <main className="grid gap-6 p-8 xl:grid-cols-[22rem_1fr]">
        <section className="space-y-4">
          <div className="space-y-3 rounded-2xl border border-white/8 bg-[#12181f] p-5">
            <h3 className="text-sm text-zinc-300">모델 만들기</h3>
            <label className="block text-sm text-zinc-400">
              종류
              <select
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                  setDraftParams(emptyParams(catalog, e.target.value));
                }}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c1117] px-3 py-2"
              >
                {(catalog?.kinds ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-zinc-500">{createSpec?.summary}</p>
            <label className="block text-sm text-zinc-400">
              이름
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c1117] px-3 py-2 text-zinc-100"
              />
            </label>
            {(createSpec?.params ?? []).map((item) => (
              <label key={item.key} className="block text-sm text-zinc-400">
                {item.label}
                <input
                  type="number"
                  min={item.min}
                  max={item.max}
                  step={item.step}
                  value={draftParams[item.key] ?? item.default}
                  onChange={(e) => setDraftParams({ ...draftParams, [item.key]: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c1117] px-3 py-2 text-zinc-100"
                />
              </label>
            ))}
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" checked={realtime} onChange={(e) => setRealtime(e.target.checked)} />
              학습 후 실시간 데이터에 적용
            </label>
            <button
              className="rounded-lg bg-sky-400 px-3 py-2 text-sm font-medium text-zinc-950"
              onClick={() =>
                createModel({ name, kind, params: draftParams, realtime })
                  .then((created) => {
                    setSelected(created);
                    setMessage(`${created.name}을 등록했습니다`);
                  })
                  .then(refresh)
                  .catch((e: Error) => setMessage(e.message))
              }
            >
              모델 등록
            </button>
          </div>
          <div className="rounded-2xl border border-white/8 bg-[#12181f] p-5">
            <h3 className="mb-3 text-sm text-zinc-300">등록된 모델 {catalog?.models.length ?? 0}개</h3>
            <ul className="space-y-2">
              {(catalog?.models ?? []).map((model) => (
                <li key={model.id}>
                  <button
                    className={`w-full rounded-xl px-3 py-3 text-left ${
                      selected?.id === model.id ? "bg-sky-400/15" : "bg-white/4"
                    }`}
                    onClick={() => setSelected(model)}
                  >
                    <span className="block text-sm text-zinc-100">{model.name}</span>
                    <span className="mt-1 block text-xs text-zinc-500">
                      {model.kindLabel} · {model.realtime ? "실시간 적용" : "미적용"} · {model.status}
                      {model.version ? ` · v${model.version}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
        <div className="space-y-6">
          {selected && editSpec ? (
            <section className="space-y-3 rounded-2xl border border-white/8 bg-[#12181f] p-5">
              <h3 className="text-sm text-zinc-200">{selected.kindLabel}</h3>
              <p className="text-xs text-zinc-500">{editSpec.summary}</p>
              <label className="block text-sm text-zinc-400">
                이름
                <input
                  value={selected.name}
                  onChange={(e) => setSelected({ ...selected, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c1117] px-3 py-2 text-zinc-100"
                />
              </label>
              {editSpec.params.map((item) => (
                <label key={item.key} className="block text-sm text-zinc-400">
                  {item.label}
                  <input
                    type="number"
                    min={item.min}
                    max={item.max}
                    step={item.step}
                    value={selected.params[item.key] ?? item.default}
                    onChange={(e) =>
                      setSelected({
                        ...selected,
                        params: { ...selected.params, [item.key]: Number(e.target.value) },
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c1117] px-3 py-2 text-zinc-100"
                  />
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={selected.realtime}
                  onChange={(e) => setSelected({ ...selected, realtime: e.target.checked })}
                />
                실시간 데이터에 적용
              </label>
              <p className="text-xs text-zinc-500">
                학습 파라미터는 다시 학습해야 반영됩니다. 실시간 적용 여부와 SSAD 거리 임계값은 저장 즉시 반영됩니다.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm text-zinc-400">
                  학습 설비
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
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c1117] px-3 py-2 text-zinc-100"
                  />
                </label>
              </div>
              {selected.message ? <p className="text-sm text-zinc-400">{selected.message}</p> : null}
              {message ? <p className="text-sm text-amber-200">{message}</p> : null}
              <div className="flex gap-2">
                <button
                  className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200"
                  onClick={() =>
                    updateModel(selected)
                      .then((saved) => {
                        setSelected(saved);
                        setMessage("저장했습니다");
                      })
                      .then(refresh)
                      .catch((e: Error) => setMessage(e.message))
                  }
                >
                  파라미터 저장
                </button>
                <button
                  className="rounded-lg bg-sky-400 px-3 py-2 text-sm font-medium text-zinc-950"
                  onClick={() =>
                    updateModel(selected)
                      .then(() => trainManagedModel(selected.id, { machine, minutes }))
                      .then((result) =>
                        setMessage(
                          result.status === "training"
                            ? "SSAD worker 학습을 시작했습니다. 끝나면 상태가 학습 완료로 바뀝니다."
                            : result.realtime
                              ? `v${result.version} 학습 완료. 실시간 데이터에 적용합니다.`
                              : `v${result.version} 학습 완료. 실시간 적용은 꺼져 있습니다.`,
                        ),
                      )
                      .then(refresh)
                      .catch((e: Error) => setMessage(e.message))
                  }
                >
                  학습
                </button>
                <button
                  className="rounded-lg px-3 py-2 text-sm text-rose-300"
                  onClick={() =>
                    deleteModel(selected.id)
                      .then(() => {
                        setSelected(null);
                        setMessage("모델을 삭제했습니다");
                      })
                      .then(refresh)
                      .catch((e: Error) => setMessage(e.message))
                  }
                >
                  삭제
                </button>
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-dashed border-white/10 p-8 text-sm text-zinc-400">
              목록에서 모델을 선택하면 파라미터를 수정할 수 있습니다.
              {message ? <p className="mt-3 text-amber-200">{message}</p> : null}
            </section>
          )}
          <section className="rounded-2xl border border-white/8 bg-[#12181f] p-5">
            <h3 className="mb-3 text-sm text-zinc-300">실시간 판정</h3>
            {Object.keys(live).length === 0 ? <p className="text-sm text-zinc-500">아직 판정이 없습니다.</p> : null}
            {Object.entries(live).map(([code, rows]) => (
              <div key={code} className="mb-3">
                <p className="text-sm text-zinc-400">{code}</p>
                {Object.entries(rows).map(([id, row]) => (
                  <p key={id} className="font-mono text-sm text-zinc-200">
                    {row.model} v{row.version} score {row.score.toFixed(3)}{" "}
                    <span className={row.isAnomaly ? "text-rose-300" : "text-emerald-300"}>
                      {row.isAnomaly ? "이상" : "정상"}
                    </span>
                  </p>
                ))}
              </div>
            ))}
          </section>
        </div>
      </main>
    </>
  );
}
