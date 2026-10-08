"use server";

import { analytics, collector, emulator, mes, type MachineSensor } from "./api";

export async function loadSensors(machine: string) {
  return mes.sensors(machine);
}

export async function loadWaveform(machine: string, channel: string) {
  return collector.waveform(machine, channel);
}

export async function loadSimulator() {
  const [presets, sensors] = await Promise.all([emulator.presets(), mes.sensors()]);
  return { presets, sensors };
}

export async function loadPresets() {
  return emulator.presets();
}

export async function saveSensor(sensor: MachineSensor) {
  return mes.saveSensor(sensor);
}

export async function createSensor(machine: string, sensor: Omit<MachineSensor, "id" | "machineCode">) {
  return mes.createSensor(machine, sensor);
}

export async function deleteSensor(id: number) {
  return mes.deleteSensor(id);
}

export async function loadMachines() {
  return mes.machines();
}

export async function previewChannel(body: {
  sampleRate: number;
  nSamples: number;
  rpm: number;
  preset: string;
  severity: number;
}) {
  return emulator.preview(body);
}

// 등록된 모델 목록과 최신 판정을 함께 가져온다.
export async function loadModels() {
  const [models, live] = await Promise.all([analytics.models(), analytics.live()]);
  return { models, live };
}

// 종류, 파라미터, 실시간 적용 여부로 모델을 등록한다.
export async function createModel(body: {
  name: string;
  kind: string;
  params: Record<string, number>;
  realtime: boolean;
}) {
  return analytics.createModel(body);
}

// 이름, 파라미터, 실시간 적용 여부를 저장한다.
export async function updateModel(model: import("./api").ManagedModel) {
  return analytics.updateModel(model);
}

// 모델 목록에서 한 건을 지운다.
export async function deleteModel(id: number) {
  return analytics.deleteModel(id);
}

// 고른 설비의 수집 데이터로 해당 모델 학습을 요청한다.
export async function trainManagedModel(id: number, body: { machine: string; minutes: number }) {
  return analytics.trainModel(id, body);
}
