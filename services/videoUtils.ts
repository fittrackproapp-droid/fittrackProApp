/**
 * services/videoUtils.ts
 *
 * Automatic video splitting for large uploads.
 *
 * WHY fix-webm-duration?
 * ──────────────────────
 * MediaRecorder WebM output has three seek-related defects:
 *   1. Duration = 0 / Infinity in the EBML header → browser draws seek bar at
 *      position 0 or the far end, and shows "0:00" as total length.
 *   2. No Cues / SeekHead index → browser cannot seek to an arbitrary time
 *      even if it somehow knows the duration.
 *   3. The raw Duration bytes are at a variable offset; a simple byte-scanner
 *      is fragile across Chrome versions.
 *
 * fix-webm-duration parses the full EBML tree and rewrites the Segment Info
 * block with a correct Duration value (in ms) plus a proper SeekHead, giving
 * the browser everything it needs for a functional timeline / seek bar.
 *
 * AUDIO NOTE
 * ──────────
 * `video.muted = true` stops Chrome from decoding the audio pipeline, making
 * createMediaElementSource return silence. We leave the element unmuted and
 * instead route audio through a GainNode(0) → audioCtx.destination (silent
 * playback) AND → MediaStreamDestination (captured for MediaRecorder).
 */

// fix-webm-duration is a tiny browser-compatible library with no dependencies.
// Add it once: `npm install fix-webm-duration`
import fixWebmDuration from "fix-webm-duration";

// ─── Target chunk size ────────────────────────────────────────────────────────

/** Each auto-split segment will be at most this many bytes (~82 MB). */
export const AUTO_SPLIT_TARGET_BYTES = 82 * 1024 * 1024;

// ─── Progress type ────────────────────────────────────────────────────────────

export interface SplitProgress {
  /** "measuring" = reading duration, "splitting" = re-encoding segments */
  phase: "measuring" | "splitting";
  fileIndex: number;
  totalFiles: number;
  segmentIndex: number;
  totalSegments: number;
  segmentProgress: number;
  overallProgress: number;
}

// ─── Helper: get video duration ───────────────────────────────────────────────

export function getVideoDuration(blob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read video duration."));
    };
    video.src = url;
  });
}

// ─── Core trim ────────────────────────────────────────────────────────────────

/**
 * Re-encodes [startTime, endTime] from sourceBlob into a new seekable Blob.
 *
 * The output WebM is passed through fixWebmDuration() so the browser renders
 * the seek bar correctly and random-access seeking works.
 */
export async function trimSegment(
  sourceBlob: Blob,
  startTime: number,
  endTime: number,
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
    ? "video/webm;codecs=vp9,opus"
    : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
      ? "video/webm;codecs=vp8,opus"
      : "video/webm";

  const objectUrl = URL.createObjectURL(sourceBlob);

  try {
    const video = document.createElement("video");
    video.src = objectUrl;
    // ⚠️  Do NOT set video.muted = true.
    // muted=true prevents Chrome from decoding the audio pipeline entirely,
    // causing silent output even when the Web Audio graph is connected.
    // We silence playback via GainNode(0) below instead.
    video.playsInline = true;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () =>
        reject(new Error("Could not load video for trimming."));
    });

    // Scale canvas to ≤ 1280 px wide, preserving aspect ratio
    const scale = Math.min(1, 1280 / (video.videoWidth || 1280));
    const cw = Math.round((video.videoWidth || 1280) * scale);
    const ch = Math.round((video.videoHeight || 720) * scale);
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d")!;

    // ── Audio routing ──────────────────────────────────────────────────────
    // audioSrc → silentGain(0) → audioCtx.destination   (inaudible playback)
    // audioSrc → audioDst                                (captured for recorder)
    const audioCtx = new AudioContext();
    const audioSrc = audioCtx.createMediaElementSource(video);
    const audioDst = audioCtx.createMediaStreamDestination();

    const silentGain = audioCtx.createGain();
    silentGain.gain.value = 0;
    audioSrc.connect(silentGain);
    silentGain.connect(audioCtx.destination);
    audioSrc.connect(audioDst);

    // Combine canvas video track + captured audio track
    const stream = canvas.captureStream(30);
    const audioTrack = audioDst.stream.getAudioTracks()[0];
    if (audioTrack) stream.addTrack(audioTrack);

    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 2_500_000,
      audioBitsPerSecond: 128_000,
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const clipDuration = endTime - startTime;

    // ── Record the segment ─────────────────────────────────────────────────
    const rawBlob = await new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        audioCtx.close();
        resolve(new Blob(chunks, { type: mimeType }));
      };
      recorder.onerror = () =>
        reject(new Error("MediaRecorder failed during trim."));

      // Register onseeked BEFORE setting currentTime to avoid a race where
      // the seek completes synchronously (e.g. seeking to 0) and fires the
      // event before we attach the handler.
      video.onseeked = () => {
        recorder.start(100); // collect data every 100 ms
        video.play().catch(reject);

        const tick = () => {
          // Stop ~50 ms before trimEnd to avoid overshooting one frame
          if (video.ended || video.currentTime >= endTime - 0.05) {
            video.pause();
            recorder.stop();
            return;
          }
          onProgress?.(
            Math.min(
              100,
              ((video.currentTime - startTime) / clipDuration) * 100,
            ),
          );
          ctx.drawImage(video, 0, 0, cw, ch);
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      };

      video.currentTime = startTime;
    });

    // ── Fix WebM duration & seek index ─────────────────────────────────────
    // fix-webm-duration expects duration in **milliseconds**.
    // It rewrites the EBML Segment Info (Duration, SeekHead, Cues) so the
    // browser can render the seek bar and jump to any position in the clip.
    const fixedBlob = await fixWebmDuration(rawBlob, clipDuration * 1000, {
      logger: false,
    });

    return fixedBlob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// ─── Auto-split ────────────────────────────────────────────────────────────────

/**
 * Splits a Blob into segments each ≤ AUTO_SPLIT_TARGET_BYTES.
 * Returns [blob] immediately if the blob is already small enough.
 */
export async function autoSplitIfNeeded(
  blob: Blob,
  fileIndex: number,
  totalFiles: number,
  onProgress?: (p: SplitProgress) => void,
): Promise<Blob[]> {
  if (blob.size <= AUTO_SPLIT_TARGET_BYTES) return [blob];

  try {
    onProgress?.({
      phase: "measuring",
      fileIndex,
      totalFiles,
      segmentIndex: 0,
      totalSegments: 1,
      segmentProgress: 0,
      overallProgress: 0,
    });

    const duration = await getVideoDuration(blob);
    const bytesPerSecond = blob.size / duration;
    const secondsPerChunk = AUTO_SPLIT_TARGET_BYTES / bytesPerSecond;

    // Build time boundaries: [0, chunkSec, 2×chunkSec, …, duration]
    const boundaries: number[] = [];
    let t = 0;
    while (t < duration - 0.5) {
      boundaries.push(t);
      t += secondsPerChunk;
    }
    boundaries.push(duration);

    const totalSegments = boundaries.length - 1;
    const results: Blob[] = [];

    for (let i = 0; i < totalSegments; i++) {
      const start = boundaries[i];
      const end = boundaries[i + 1];

      const trimmed = await trimSegment(blob, start, end, (pct) => {
        onProgress?.({
          phase: "splitting",
          fileIndex,
          totalFiles,
          segmentIndex: i,
          totalSegments,
          segmentProgress: pct,
          overallProgress: ((i + pct / 100) / totalSegments) * 100,
        });
      });

      results.push(trimmed);

      onProgress?.({
        phase: "splitting",
        fileIndex,
        totalFiles,
        segmentIndex: i,
        totalSegments,
        segmentProgress: 100,
        overallProgress: ((i + 1) / totalSegments) * 100,
      });
    }

    return results;
  } catch (err) {
    console.warn("[autoSplit] Failed, uploading original blob:", err);
    return [blob];
  }
}