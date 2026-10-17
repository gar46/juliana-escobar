type CaptureOptions = {
  onSpeechStart?: () => void;
  onUtterance: (wav: Blob) => void;
};

export type VoiceCapture = {
  pause(): void;
  resume(): void;
  stop(): void;
};

const TARGET_RATE = 16000;
const SILENCE_MS = 850;
const MIN_SPEECH_MS = 220;
const MAX_UTTERANCE_MS = 15000;
const PREROLL_MS = 350;

export function canCapture() {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof AudioContext !== "undefined";
}

export async function startCapture({ onSpeechStart, onUtterance }: CaptureOptions): Promise<VoiceCapture> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
  });
  const context = new AudioContext();
  await context.resume();
  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(2048, 1, 1);
  const frameMs = (2048 / context.sampleRate) * 1000;

  let paused = true;
  let speaking = false;
  let loudFrames = 0;
  let quietMs = 0;
  let speechMs = 0;
  let noise = 0.008;
  let chunks: Float32Array[] = [];
  const preroll: Float32Array[] = [];

  const reset = () => {
    speaking = false;
    loudFrames = 0;
    quietMs = 0;
    speechMs = 0;
    chunks = [];
  };

  processor.onaudioprocess = (event) => {
    event.outputBuffer.getChannelData(0).fill(0);
    const input = event.inputBuffer.getChannelData(0);
    const frame = new Float32Array(input);
    let sum = 0;
    for (let i = 0; i < frame.length; i += 1) sum += frame[i] * frame[i];
    const rms = Math.sqrt(sum / frame.length);

    if (paused) return;
    const threshold = Math.max(0.012, noise * 2.6);
    const loud = rms > threshold;

    if (!speaking) {
      noise = noise * 0.95 + Math.min(rms, 0.05) * 0.05;
      preroll.push(frame);
      while (preroll.length * frameMs > PREROLL_MS) preroll.shift();
      loudFrames = loud ? loudFrames + 1 : 0;
      if (loudFrames >= 2) {
        speaking = true;
        chunks = [...preroll];
        preroll.length = 0;
        speechMs = loudFrames * frameMs;
        quietMs = 0;
        onSpeechStart?.();
      }
      return;
    }

    chunks.push(frame);
    if (loud) {
      speechMs += frameMs;
      quietMs = 0;
    } else {
      quietMs += frameMs;
    }
    const total = chunks.length * frameMs;
    if (quietMs >= SILENCE_MS || total >= MAX_UTTERANCE_MS) {
      const captured = chunks;
      const enough = speechMs >= MIN_SPEECH_MS;
      reset();
      if (enough) onUtterance(encodeWav(captured, context.sampleRate));
    }
  };

  source.connect(processor);
  processor.connect(context.destination);

  return {
    pause() {
      paused = true;
      reset();
      preroll.length = 0;
    },
    resume() {
      reset();
      preroll.length = 0;
      paused = false;
    },
    stop() {
      paused = true;
      processor.disconnect();
      source.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      void context.close();
    },
  };
}

function encodeWav(chunks: Float32Array[], inputRate: number) {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const merged = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  const ratio = inputRate / TARGET_RATE;
  const outLength = Math.floor(merged.length / ratio);
  const samples = new Int16Array(outLength);
  for (let i = 0; i < outLength; i += 1) {
    const start = Math.floor(i * ratio);
    const end = Math.min(merged.length, Math.floor((i + 1) * ratio));
    let total = 0;
    for (let j = start; j < end; j += 1) total += merged[j];
    const value = Math.max(-1, Math.min(1, total / Math.max(1, end - start)));
    samples[i] = value < 0 ? value * 0x8000 : value * 0x7fff;
  }

  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (at: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(at + i, text.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, TARGET_RATE, true);
  view.setUint32(28, TARGET_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples.length * 2, true);
  new Int16Array(buffer, 44).set(samples);
  return new Blob([buffer], { type: "audio/wav" });
}
