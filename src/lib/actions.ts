"use server";

import { analytics, collector, emulator, type Channel } from "./api";

export async function loadWaveform(machine: string) {
  return collector.waveform(machine);
}

export async function loadSimulator() {
  const [presets, channels] = await Promise.all([emulator.presets(), emulator.channels()]);
  return { presets, channels };
}

export async function saveChannel(channel: Channel) {
  return emulator.save(channel);
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
