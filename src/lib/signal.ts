// 화면용 신호 변환. 저장된 파형과 모델 학습에는 쓰지 않는다.

export type Quantity = "raw" | "g" | "v" | "rms-g" | "rms-v";
export type FftWindow = "rect" | "hann" | "hamming" | "blackman" | "flattop";

export type Series = { xs: number[]; ys: number[]; unit: string };

const WINDOWS: Record<FftWindow, (i: number, n: number) => number> = {
  rect: () => 1,
  hann: (i, n) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n),
  hamming: (i, n) => 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / n),
  blackman: (i, n) =>
    0.42 - 0.5 * Math.cos((2 * Math.PI * i) / n) + 0.08 * Math.cos((4 * Math.PI * i) / n),
  flattop: (i, n) => {
    const a = [0.21557895, 0.41663158, 0.277263158, 0.083578947, 0.006947368];
    return (
      a[0] -
      a[1] * Math.cos((2 * Math.PI * i) / n) +
      a[2] * Math.cos((4 * Math.PI * i) / n) -
      a[3] * Math.cos((6 * Math.PI * i) / n) +
      a[4] * Math.cos((8 * Math.PI * i) / n)
    );
  },
};

function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wlenRe = Math.cos(ang);
    const wlenIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wRe = 1;
      let wIm = 0;
      for (let j = 0; j < len / 2; j++) {
        const uRe = re[i + j];
        const uIm = im[i + j];
        const vRe = re[i + j + len / 2] * wRe - im[i + j + len / 2] * wIm;
        const vIm = re[i + j + len / 2] * wIm + im[i + j + len / 2] * wRe;
        re[i + j] = uRe + vRe;
        im[i + j] = uIm + vIm;
        re[i + j + len / 2] = uRe - vRe;
        im[i + j + len / 2] = uIm - vIm;
        const nextRe = wRe * wlenRe - wIm * wlenIm;
        wIm = wRe * wlenIm + wIm * wlenRe;
        wRe = nextRe;
      }
    }
  }
}

export function convertUnit(samples: number[], unit: string, target: "raw" | "g" | "v", mvPerG: number): Series {
  const src = unit.trim().toLowerCase();
  const voltsPerG = mvPerG / 1000;
  const n = samples.length;
  const xs = Array.from({ length: n }, (_, i) => i);
  if (target === "raw" || !Number.isFinite(voltsPerG) || voltsPerG <= 0) {
    return { xs, ys: samples, unit: unit || "raw" };
  }
  if (target === "g") {
    if (src === "g") return { xs, ys: samples, unit: "g" };
    if (src === "mv") return { xs, ys: samples.map((v) => v / 1000 / voltsPerG), unit: "g" };
    return { xs, ys: samples.map((v) => v / voltsPerG), unit: "g" };
  }
  if (src === "v" || src === "volt") return { xs, ys: samples, unit: "V" };
  if (src === "mv") return { xs, ys: samples.map((v) => v / 1000), unit: "V" };
  return { xs, ys: samples.map((v) => v * voltsPerG), unit: "V" };
}

export function withTime(samples: number[], sampleRate: number, unit: string): Series {
  return {
    xs: samples.map((_, i) => i / sampleRate),
    ys: samples,
    unit,
  };
}

export function slidingRms(samples: number[], sampleRate: number, windowMs: number, unit: string): Series {
  const win = Math.max(1, Math.round((windowMs / 1000) * sampleRate));
  const hop = Math.max(1, Math.floor(win / 4));
  const prefix = new Float64Array(samples.length + 1);
  for (let i = 0; i < samples.length; i++) prefix[i + 1] = prefix[i] + samples[i] * samples[i];
  const xs: number[] = [];
  const ys: number[] = [];
  for (let start = 0; start + win <= samples.length; start += hop) {
    const mean = (prefix[start + win] - prefix[start]) / win;
    xs.push((start + win / 2) / sampleRate);
    ys.push(Math.sqrt(Math.max(mean, 0)));
  }
  if (ys.length === 0 && samples.length > 0) {
    const mean = samples.reduce((sum, v) => sum + v * v, 0) / samples.length;
    xs.push(samples.length / 2 / sampleRate);
    ys.push(Math.sqrt(mean));
  }
  return { xs, ys, unit: `RMS ${unit}` };
}

export function spectrum(samples: number[], sampleRate: number, windowName: FftWindow, unit: string): Series {
  const n = samples.length;
  if (n < 8 || (n & (n - 1)) !== 0 || sampleRate <= 0) return { xs: [], ys: [], unit };
  const shape = WINDOWS[windowName];
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  let mean = 0;
  for (const value of samples) mean += value;
  mean /= n;
  let weight = 0;
  for (let i = 0; i < n; i++) {
    const w = shape(i, n);
    re[i] = (samples[i] - mean) * w;
    weight += w;
  }
  fft(re, im);
  const bins = n / 2;
  const xs: number[] = [];
  const ys: number[] = [];
  const scale = weight > 0 ? 2 / weight : 0;
  for (let k = 1; k < bins; k++) {
    xs.push((k * sampleRate) / n);
    ys.push(Math.hypot(re[k], im[k]) * scale);
  }
  return { xs, ys, unit };
}

export function extent(xs: number[], ys: number[]) {
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  const count = Math.min(xs.length, ys.length);
  for (let i = 0; i < count; i++) {
    const x = xs[i];
    const y = ys[i];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    xMin = Math.min(xMin, x);
    xMax = Math.max(xMax, x);
    yMin = Math.min(yMin, y);
    yMax = Math.max(yMax, y);
  }
  if (!Number.isFinite(xMin)) return null;
  if (xMax - xMin < 1e-9) {
    xMin -= 1;
    xMax += 1;
  }
  if (yMax - yMin < 1e-9) {
    yMin -= 1;
    yMax += 1;
  }
  return { xMin, xMax, yMin, yMax };
}
