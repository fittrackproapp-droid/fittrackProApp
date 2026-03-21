import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  Scissors,
  Play,
  Pause,
  Trash2,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SplitPoint {
  id: string;
  time: number;
}

interface ProcessingState {
  segmentIndex: number; // 0-based current segment
  totalSegments: number;
  segmentProgress: number; // 0–100 for this segment
  overallProgress: number; // 0–100 across all segments
}

export interface TrimmedSegment {
  blob: Blob;
  name: string;
}

interface VideoTrimmerProps {
  blob: Blob;
  fileName: string;
  onComplete: (segments: TrimmedSegment[]) => void;
  onCancel: () => void;
}

// ─── Core trim function ───────────────────────────────────────────────────────
// Re-encodes startTime→endTime from sourceBlob.
// Audio is captured via Web Audio API so it is preserved (canvas alone has no audio).
// Output is always WebM (what MediaRecorder produces in browsers).

async function trimSegment(
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
    video.muted = true; // muted so autoplay policy doesn't block
    video.playsInline = true;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () =>
        reject(new Error("Could not load video for trimming."));
    });

    // Scale canvas to max 1280 px wide while preserving aspect ratio
    const scale = Math.min(1, 1280 / (video.videoWidth || 1280));
    const cw = Math.round((video.videoWidth || 1280) * scale);
    const ch = Math.round((video.videoHeight || 720) * scale);
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d")!;

    // Web Audio: route source audio → MediaStreamDestinationNode
    // This gives us an audio track we can add to the canvas stream.
    // NOT connected to audioCtx.destination so the user doesn't hear it.
    const audioCtx = new AudioContext();
    const audioSrc = audioCtx.createMediaElementSource(video);
    const audioDst = audioCtx.createMediaStreamDestination();
    audioSrc.connect(audioDst);

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

    return await new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        audioCtx.close();
        resolve(new Blob(chunks, { type: mimeType }));
      };
      recorder.onerror = () =>
        reject(new Error("MediaRecorder failed during trim."));

      // Seek then record
      video.currentTime = startTime;
      video.onseeked = () => {
        recorder.start(100);
        video.play().catch(reject);

        const tick = () => {
          // Stop ~50 ms before trimEnd to avoid overshooting a single frame
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
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

const fmtMB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const SEGMENT_COLORS = ["#6366f1", "#0891b2", "#059669", "#d97706", "#dc2626"];
const SAFE_BYTES = 90 * 1024 * 1024; // warn if estimated segment > 90 MB

// ─── Component ────────────────────────────────────────────────────────────────

const VideoTrimmer: React.FC<VideoTrimmerProps> = ({
  blob,
  fileName,
  onComplete,
  onCancel,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  // Keep a stable object URL for the lifetime of the component
  const blobUrlRef = useRef(URL.createObjectURL(blob));

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [splitPoints, setSplitPoints] = useState<SplitPoint[]>([]);
  const [processing, setProcessing] = useState<ProcessingState | null>(null);
  const [done, setDone] = useState(false);

  // Refs for drag handler (avoids stale closure issues)
  const trimStartRef = useRef(0);
  const trimEndRef = useRef(0);
  const durationRef = useRef(0);
  const dragging = useRef<{
    type: "start" | "end" | "split";
    id?: string;
  } | null>(null);

  useEffect(() => {
    trimStartRef.current = trimStart;
  }, [trimStart]);
  useEffect(() => {
    trimEndRef.current = trimEnd;
  }, [trimEnd]);
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  // Revoke URL when component unmounts
  useEffect(() => {
    const url = blobUrlRef.current;
    return () => URL.revokeObjectURL(url);
  }, []);

  // Wire up the video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.src = blobUrlRef.current;

    const onMeta = () => {
      setDuration(video.duration);
      setTrimEnd(video.duration);
    };
    const onTime = () => setCurrentTime(video.currentTime);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    return () => {
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
    };
  }, []);

  // ── Timeline coordinate helpers ────────────────────────────────────────────

  const pxToTime = useCallback((clientX: number): number => {
    const tl = timelineRef.current;
    if (!tl || !durationRef.current) return 0;
    const { left, width } = tl.getBoundingClientRect();
    return Math.max(
      0,
      Math.min(
        durationRef.current,
        ((clientX - left) / width) * durationRef.current,
      ),
    );
  }, []);

  const timeToPercent = (t: number) =>
    durationRef.current ? (t / durationRef.current) * 100 : 0;

  // ── Global pointer handlers (handles drag outside the timeline rect) ────────

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragging.current) return;
      const time = pxToTime(e.clientX);
      if (dragging.current.type === "start") {
        setTrimStart(Math.min(time, trimEndRef.current - 0.5));
      } else if (dragging.current.type === "end") {
        setTrimEnd(Math.max(time, trimStartRef.current + 0.5));
      } else if (dragging.current.type === "split") {
        const id = dragging.current.id;
        setSplitPoints((pts) =>
          pts.map((p) =>
            p.id === id
              ? {
                  ...p,
                  time: Math.max(
                    trimStartRef.current + 0.5,
                    Math.min(trimEndRef.current - 0.5, time),
                  ),
                }
              : p,
          ),
        );
      }
    },
    [pxToTime],
  );

  const onPointerUp = useCallback(() => {
    dragging.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  // ── Derived segments ───────────────────────────────────────────────────────

  const segments = useMemo(() => {
    const sorted = [...splitPoints].sort((a, b) => a.time - b.time);
    const bounds = [trimStart, ...sorted.map((p) => p.time), trimEnd];
    return bounds
      .slice(0, -1)
      .map((start, i) => ({ start, end: bounds[i + 1], index: i }));
  }, [trimStart, trimEnd, splitPoints]);

  const estimatedSize = (start: number, end: number) =>
    duration > 0 ? (blob.size / duration) * (end - start) : 0;

  // ── Playback controls ──────────────────────────────────────────────────────

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) {
      v.pause();
    } else {
      if (v.currentTime < trimStart || v.currentTime >= trimEnd)
        v.currentTime = trimStart;
      v.play();
    }
  };

  const seekTo = (time: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = time;
    setCurrentTime(time);
  };

  // Keep playback inside trim zone
  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.currentTime > trimEnd) {
      v.pause();
      v.currentTime = trimEnd;
    }
  };

  // ── Split management ───────────────────────────────────────────────────────

  const addSplitAtCurrent = () => {
    const t = currentTime;
    if (t <= trimStart + 0.5 || t >= trimEnd - 0.5) return;
    if (splitPoints.some((p) => Math.abs(p.time - t) < 1)) return;
    setSplitPoints((pts) => [...pts, { id: crypto.randomUUID(), time: t }]);
  };

  const removeSplit = (id: string) =>
    setSplitPoints((pts) => pts.filter((p) => p.id !== id));

  // ── Processing ─────────────────────────────────────────────────────────────

  const processSegments = async () => {
    const total = segments.length;
    setProcessing({
      segmentIndex: 0,
      totalSegments: total,
      segmentProgress: 0,
      overallProgress: 0,
    });

    const results: TrimmedSegment[] = [];
    const baseName = fileName.replace(/\.[^.]+$/, "");

    for (let i = 0; i < segments.length; i++) {
      const { start, end } = segments[i];
      const trimmed = await trimSegment(blob, start, end, (pct) => {
        setProcessing({
          segmentIndex: i,
          totalSegments: total,
          segmentProgress: pct,
          overallProgress: ((i + pct / 100) / total) * 100,
        });
      });
      results.push({
        blob: trimmed,
        name:
          total === 1 ? `${baseName} (trimmed)` : `${baseName} – part ${i + 1}`,
      });
    }

    setProcessing({
      segmentIndex: total - 1,
      totalSegments: total,
      segmentProgress: 100,
      overallProgress: 100,
    });
    setDone(true);
    setTimeout(() => onComplete(results), 800);
  };

  const anySegmentOver = segments.some(
    (s) => estimatedSize(s.start, s.end) > SAFE_BYTES,
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto">
      {/* Video preview */}
      <div className="bg-black rounded-xl overflow-hidden">
        <video
          ref={videoRef}
          className="w-full max-h-56 object-contain"
          playsInline
          onTimeUpdate={onTimeUpdate}
        />
      </div>

      {/* Playback row */}
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          disabled={!!processing}
          className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 disabled:opacity-40 transition shrink-0"
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>

        <span className="text-xs tabular-nums text-gray-500 shrink-0 min-w-[90px]">
          {fmt(currentTime)} / {fmt(duration)}
        </span>

        <button
          onClick={addSplitAtCurrent}
          disabled={
            !!processing ||
            currentTime <= trimStart + 0.5 ||
            currentTime >= trimEnd - 0.5
          }
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200
            text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-100 disabled:opacity-40 transition"
        >
          <Scissors size={13} /> Split here
        </button>
      </div>

      {/* Timeline */}
      <div className="space-y-1">
        <div
          ref={timelineRef}
          className="relative h-10 bg-gray-100 rounded-lg cursor-crosshair select-none"
          onClick={(e) => {
            if (dragging.current || processing) return;
            seekTo(pxToTime(e.clientX));
          }}
        >
          {/* Coloured segment fills */}
          {segments.map((seg, i) => (
            <div
              key={i}
              className="absolute top-0 h-full rounded opacity-25 pointer-events-none"
              style={{
                left: `${timeToPercent(seg.start)}%`,
                width: `${timeToPercent(seg.end) - timeToPercent(seg.start)}%`,
                background: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
              }}
            />
          ))}

          {/* Greyed trim zones (outside usable range) */}
          <div
            className="absolute top-0 h-full bg-gray-300/70 rounded-l-lg pointer-events-none"
            style={{ left: 0, width: `${timeToPercent(trimStart)}%` }}
          />
          <div
            className="absolute top-0 h-full bg-gray-300/70 rounded-r-lg pointer-events-none"
            style={{ left: `${timeToPercent(trimEnd)}%`, right: 0 }}
          />

          {/* Playhead */}
          <div
            className="absolute top-0 h-full w-px bg-white shadow pointer-events-none z-20"
            style={{ left: `${timeToPercent(currentTime)}%` }}
          />

          {/* Trim start handle (green) */}
          <div
            className="absolute top-0 h-full w-3 bg-green-500 rounded-l z-30
              flex items-center justify-center cursor-ew-resize hover:bg-green-400 transition-colors"
            style={{
              left: `${timeToPercent(trimStart)}%`,
              transform: "translateX(-100%)",
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              if (processing) return;
              dragging.current = { type: "start" };
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            }}
          >
            <div className="w-px h-5 bg-white/80" />
          </div>

          {/* Trim end handle (red) */}
          <div
            className="absolute top-0 h-full w-3 bg-red-500 rounded-r z-30
              flex items-center justify-center cursor-ew-resize hover:bg-red-400 transition-colors"
            style={{ left: `${timeToPercent(trimEnd)}%` }}
            onPointerDown={(e) => {
              e.preventDefault();
              if (processing) return;
              dragging.current = { type: "end" };
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            }}
          >
            <div className="w-px h-5 bg-white/80" />
          </div>

          {/* Split point markers (amber) */}
          {splitPoints.map((sp) => (
            <div
              key={sp.id}
              className="absolute top-0 h-full w-2 bg-amber-400 z-30 cursor-ew-resize
                hover:bg-amber-300 transition-colors"
              style={{
                left: `${timeToPercent(sp.time)}%`,
                transform: "translateX(-50%)",
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                if (processing) return;
                dragging.current = { type: "split", id: sp.id };
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              }}
            />
          ))}
        </div>

        {/* Time labels */}
        <div className="flex justify-between text-[10px] text-gray-400 px-1 tabular-nums select-none">
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <span key={f}>{fmt(duration * f)}</span>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[10px] text-gray-400 px-1">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-500" />
            &nbsp;trim start
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-400" />
            &nbsp;split point
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-500" />
            &nbsp;trim end
          </span>
        </div>
      </div>

      {/* Segment list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
            {segments.length} clip{segments.length !== 1 ? "s" : ""}
          </p>
          {splitPoints.length > 0 && !processing && (
            <button
              onClick={() => setSplitPoints([])}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Clear all splits
            </button>
          )}
        </div>

        {segments.map((seg, i) => {
          const size = estimatedSize(seg.start, seg.end);
          const over = size > SAFE_BYTES;
          // The split point that ends this segment (if any)
          const sorted = [...splitPoints].sort((a, b) => a.time - b.time);
          const boundaryPoint = i < sorted.length ? sorted[i] : null;

          return (
            <div
              key={i}
              className={`flex items-center gap-3 p-3 rounded-xl border text-sm transition
                ${over ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-100"}`}
            >
              <div
                className="w-2.5 h-9 rounded-sm shrink-0"
                style={{
                  background: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm truncate">
                  {segments.length === 1
                    ? fileName.replace(/\.[^.]+$/, "") + " (trimmed)"
                    : `Part ${i + 1}`}
                </p>
                <p className="text-[11px] text-gray-500 tabular-nums">
                  {fmt(seg.start)} → {fmt(seg.end)}
                  &ensp;·&ensp;{fmt(seg.end - seg.start)}
                  &ensp;·&ensp;~{fmtMB(size)}
                </p>
              </div>
              {over && (
                <span title="Estimated size over 90 MB — add more split points">
                  <AlertTriangle size={15} className="text-red-500 shrink-0" />
                </span>
              )}
              {boundaryPoint && !processing && (
                <button
                  onClick={() => removeSplit(boundaryPoint.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition shrink-0"
                  title="Remove split after this clip"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          );
        })}

        {anySegmentOver && (
          <p className="text-xs text-red-600 flex items-center gap-1.5 px-1">
            <AlertTriangle size={11} />
            At least one clip may exceed 100 MB. Add more split points to reduce
            it.
          </p>
        )}
      </div>

      {/* Processing progress */}
      {processing && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-indigo-700">
              {done
                ? "Done!"
                : `Processing clip ${processing.segmentIndex + 1} of ${processing.totalSegments}…`}
            </span>
            {done ? (
              <CheckCircle size={18} className="text-green-500" />
            ) : (
              <span className="text-xs tabular-nums text-indigo-400">
                {Math.round(processing.overallProgress)}%
              </span>
            )}
          </div>

          {/* Overall bar */}
          <div className="h-2 bg-indigo-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-200 ease-out"
              style={{ width: `${processing.overallProgress}%` }}
            />
          </div>

          {/* Current segment bar */}
          {!done && processing.totalSegments > 1 && (
            <>
              <div className="flex justify-between items-center">
                <span className="text-xs text-indigo-400">
                  Clip {processing.segmentIndex + 1}
                </span>
                <span className="text-xs tabular-nums text-indigo-400">
                  {Math.round(processing.segmentProgress)}%
                </span>
              </div>
              <div className="h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-300 rounded-full transition-all duration-150 ease-out"
                  style={{ width: `${processing.segmentProgress}%` }}
                />
              </div>
            </>
          )}

          {!done && (
            <p className="text-[11px] text-indigo-400">
              Processing is real-time — a 2-minute clip takes ~2 minutes.
            </p>
          )}
        </div>
      )}

      {/* Action buttons */}
      {!processing && (
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold
              hover:bg-gray-50 transition text-sm"
          >
            Cancel
          </button>
          <button
            onClick={processSegments}
            disabled={anySegmentOver}
            className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm
              hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed
              transition shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
          >
            <Scissors size={15} />
            {segments.length === 1
              ? "Trim & add"
              : `Process ${segments.length} clips`}
          </button>
        </div>
      )}
    </div>
  );
};

export default VideoTrimmer;
