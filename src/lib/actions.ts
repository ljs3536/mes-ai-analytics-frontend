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

export async function loadModels() {
  const [models, live] = await Promise.all([analytics.models(), analytics.live()]);
  return { models, live };
}

export async function trainModel(body: { machine: string; minutes: number; contamination: number }) {
  return analytics.train(body);
}

export async function promoteModel(version: string) {
  return analytics.promote(version);
}
