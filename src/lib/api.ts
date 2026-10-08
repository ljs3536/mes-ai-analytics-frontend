const COLLECTOR_URL = process.env.COLLECTOR_URL ?? "http://localhost:8001";
const EMULATOR_URL = process.env.EMULATOR_URL ?? "http://localhost:8002";
const ANALYTICS_URL = process.env.ANALYTICS_URL ?? "http://localhost:8003";
const MES_URL = process.env.MES_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function call<T>(base: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    cache: "no-store",
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = body?.detail;
    throw new ApiError(typeof detail === "string" ? detail : `API 오류 (${res.status})`, res.status);
  }
  return body as T;
}

export type Waveform = {
  machine: string;
  channel: string;
  ts: string;
  sampleRate: number;
  n: number;
  rpm: number;
  unit: string;
  samples: number[];
  freqs: number[];
  magnitudes: number[];
};

export type Channel = {
  machine: string;
  channel: string;
  sampleRate: number;
  nSamples: number;
  intervalS: number;
  preset: string;
  severity: number;
  ratedRpm: number;
  enabled: boolean;
};

export type Presets = { presets: { id: string; label: string }[]; sampleCounts: number[] };

export type ModelList = {
  name: string;
  production: string | null;
  versions: { version: string; runId: string; status: string; createdAt: number }[];
};

export type Live = {
  predictions: Record<
    string,
    { ts: string; version: string; score: number; isAnomaly: boolean; channel?: string }
  >;
};

export type MachineSensor = {
  id: number;
  machineCode: string;
  code: string;
  name: string;
  sensorType: string;
  mount: string;
  unit: string;
  sampleRate: number;
  nSamples: number;
  intervalS: number;
  preset: string;
  severity: number;
  enabled: boolean;
};

export const collector = {
  waveform: (machine: string, channel: string) =>
    call<Waveform>(
      COLLECTOR_URL,
      `/api/waveform?machine=${encodeURIComponent(machine)}&channel=${encodeURIComponent(channel)}`,
    ),
};

export const mes = {
  sensors: (machine?: string) =>
    call<MachineSensor[]>(
      MES_URL,
      `/api/sensors${machine ? `?machine=${encodeURIComponent(machine)}` : ""}`,
    ),
  machines: () =>
    call<{ code: string; name: string }[]>(MES_URL, "/api/machines"),
  createSensor: (machine: string, sensor: Omit<MachineSensor, "id" | "machineCode">) =>
    call<MachineSensor>(MES_URL, `/api/sensors?machine=${encodeURIComponent(machine)}`, {
      method: "POST",
      body: JSON.stringify(sensor),
    }),
  deleteSensor: (id: number) => call<null>(MES_URL, `/api/sensors/${id}`, { method: "DELETE" }),
  saveSensor: (sensor: MachineSensor) =>
    call<MachineSensor>(MES_URL, `/api/sensors/${sensor.id}`, {
      method: "PUT",
      body: JSON.stringify({
        code: sensor.code,
        name: sensor.name,
        sensorType: sensor.sensorType,
        mount: sensor.mount,
        unit: sensor.unit,
        sampleRate: sensor.sampleRate,
        nSamples: sensor.nSamples,
        intervalS: sensor.intervalS,
        preset: sensor.preset,
        severity: sensor.severity,
        enabled: sensor.enabled,
      }),
    }),
};

export const emulator = {
  presets: () => call<Presets>(EMULATOR_URL, "/api/presets"),
  channels: () => call<Channel[]>(EMULATOR_URL, "/api/channels"),
  save: (body: Channel) =>
    call<Channel>(EMULATOR_URL, "/api/channels", { method: "PUT", body: JSON.stringify(body) }),
  preview: (body: {
    sampleRate: number;
    nSamples: number;
    rpm: number;
    preset: string;
    severity: number;
  }) => call<{ samples: number[]; resolutionHz: number; durationS: number }>(EMULATOR_URL, "/api/preview", {
    method: "POST",
    body: JSON.stringify(body),
  }),
};

export const analytics = {
  models: () => call<ModelList>(ANALYTICS_URL, "/api/models"),
  live: () => call<Live>(ANALYTICS_URL, "/api/live"),
  train: (body: { machine: string; minutes: number; contamination: number }) =>
    call<{ version: string; rows: number }>(ANALYTICS_URL, "/api/train", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  promote: (version: string) =>
    call<{ production: string }>(ANALYTICS_URL, "/api/models/production", {
      method: "POST",
      body: JSON.stringify({ version }),
    }),
};
