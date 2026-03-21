import {
  User,
  UserRole,
  Exercise,
  WorkoutPlan,
  Submission,
  Message,
} from "../types";
import {
  auth,
  dbFirestore,
  isFirebaseConfigured,
  googleProvider,
  storage,
} from "./firebase";
import {
  collection,
  getDocs,
  getDoc,
  setDoc,
  doc,
  addDoc,
  query,
  where,
  updateDoc,
  deleteDoc,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut,
  signInWithCredential,
  GoogleAuthProvider,
} from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

// ==========================================
// STORAGE CONFIGURATION
// ==========================================

export const STORAGE_CONFIG = {
  PROVIDER: "CLOUDINARY" as "FIREBASE" | "CLOUDINARY",
  CLOUDINARY: {
    cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME,
    uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET,
    apiKey: import.meta.env.VITE_CLOUDINARY_API_KEY,
    apiSecret: import.meta.env.VITE_CLOUDINARY_API_SECRET,
  },
};

// ==========================================
// HELPER: SHA1 for Cloudinary Signature
// ==========================================
async function sha1(str: string) {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-1", enc.encode(str));
  return Array.from(new Uint8Array(hash))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}

// --- MOCK EXERCISES ---
// Used to seed the database if empty
const MOCK_EXERCISES: Exercise[] = [
  // Chest
  {
    id: "c1",
    name: "Barbell Bench Press",
    category: "Chest",
    description: "Compound chest exercise.",
  },
  {
    id: "c2",
    name: "Incline Dumbbell Press",
    category: "Chest",
    description: "Upper chest focus.",
  },
  {
    id: "c3",
    name: "Cable Flyes",
    category: "Chest",
    description: "Chest isolation.",
  },
  {
    id: "c4",
    name: "Push-ups",
    category: "Chest",
    description: "Bodyweight standard.",
  },
  // Back
  {
    id: "b1",
    name: "Deadlift",
    category: "Back",
    description: "Full body compound.",
  },
  {
    id: "b2",
    name: "Pull-ups",
    category: "Back",
    description: "Vertical pull.",
  },
  {
    id: "b3",
    name: "Barbell Rows",
    category: "Back",
    description: "Horizontal row.",
  },
  {
    id: "b4",
    name: "Lat Pulldown",
    category: "Back",
    description: "Vertical pull machine.",
  },
  {
    id: "b5",
    name: "Static Pull-up Hold",
    category: "Back",
    description: "Isometric back strength.",
  },
  {
    id: "b6",
    name: "One-Arm Dumbbell Row",
    category: "Back",
    description: "Unilateral back exercise.",
  },
  // Legs
  {
    id: "l1",
    name: "Barbell Squat",
    category: "Legs",
    description: "King of leg exercises.",
  },
  {
    id: "l2",
    name: "Leg Press",
    category: "Legs",
    description: "Machine leg push.",
  },
  {
    id: "l3",
    name: "Romanian Deadlift",
    category: "Legs",
    description: "Hamstring focus.",
  },
  {
    id: "l4",
    name: "Lunges",
    category: "Legs",
    description: "Unilateral leg work.",
  },
  {
    id: "l5",
    name: "Calf Raises",
    category: "Legs",
    description: "Isolation for calves.",
  },
  // Shoulders
  {
    id: "s1",
    name: "Overhead Press",
    category: "Shoulders",
    description: "Vertical push.",
  },
  {
    id: "s2",
    name: "Lateral Raises",
    category: "Shoulders",
    description: "Side delt isolation.",
  },
  {
    id: "s3",
    name: "Face Pulls",
    category: "Shoulders",
    description: "Rear delt and posture.",
  },
  // Arms
  {
    id: "a1",
    name: "Barbell Curls",
    category: "Arms",
    description: "Bicep builder.",
  },
  {
    id: "a2",
    name: "Tricep Pushdowns",
    category: "Arms",
    description: "Tricep isolation.",
  },
  {
    id: "a3",
    name: "Hammer Curls",
    category: "Arms",
    description: "Brachialis focus.",
  },
  {
    id: "a4",
    name: "Skullcrushers",
    category: "Arms",
    description: "Tricep extension.",
  },
  // Core / Cardio
  { id: "x1", name: "Plank", category: "Core", description: "Static hold." },
  {
    id: "x2",
    name: "Hanging Leg Raises",
    category: "Core",
    description: "Lower abs.",
  },
  {
    id: "x3",
    name: "Burpees",
    category: "Cardio",
    description: "Full body conditioning.",
  },
  {
    id: "x4",
    name: "Mountain Climbers",
    category: "Cardio",
    description: "High intensity core.",
  },
  {
    id: "x5",
    name: "Running",
    category: "Cardio",
    description: "Steady state cardio.",
  },
  {
    id: "x6",
    name: "Stairs Running",
    category: "Cardio",
    description: "High intensity cardio.",
  },
  {
    id: "x7",
    name: "Jump Rope",
    category: "Cardio",
    description: "Coordination and cardio.",
  },
  {
    id: "x8",
    name: "Sit-ups",
    category: "Core",
    description: "Abdominal flexion.",
  },
  {
    id: "x9",
    name: "Penguin Crunches",
    category: "Core",
    description: "Oblique focus.",
  },
  {
    id: "x10",
    name: "Bicycle Crunches",
    category: "Core",
    description: "Dynamic core stability.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Drop-in replacement for the video-upload section of services/db.ts
//
// What changed and why
// ────────────────────
// BEFORE: canvas-based compression → audio never captured → silent videos,
//         poor quality, 100 MB hard wall from a single XHR body.
//
// AFTER:  Cloudinary chunked upload (20 MB slices, X-Unique-Upload-Id).
//         Cloudinary reassembles chunks server-side into a single asset.
//         No compression step needed for files under ~1.5 GB.
//         Audio is preserved perfectly because the original blob is sent
//         byte-for-byte — just in pieces.
//
// Compression is kept as a last resort for files > COMPRESS_THRESHOLD_BYTES,
// but now correctly captures audio via the Web Audio API instead of relying
// on the canvas stream alone.
//
// Free-tier notes
// ───────────────
// Cloudinary free: 25 GB storage, 25 GB bandwidth/month.
// There is NO per-file size cap when using the chunked upload API —
// the 100 MB limit only applies to single-request (non-chunked) uploads.
// Practical limit with chunked: ~2–3 GB per file before storage quota bites.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Constants ────────────────────────────────────────────────────────────────

const CHUNK_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB per chunk
const MAX_VIDEO_BYTES = 1_500 * 1024 * 1024; // 1.5 GB absolute cap
const CHUNK_TIMEOUT_MS = 90_000; // 90 s per chunk
const MAX_CHUNK_RETRIES = 3;
const COMPRESS_THRESHOLD_BYTES = 200 * 1024 * 1024; // only compress if > 200 MB

// ─── Cloudinary chunked upload ────────────────────────────────────────────────

/**
 * Uploads a single chunk (slice of the original blob) to Cloudinary.
 * Cloudinary identifies which file the chunk belongs to via X-Unique-Upload-Id.
 * The last chunk triggers server-side reassembly and returns the final asset URL.
 */
async function uploadChunk(
  chunk: Blob,
  rangeStart: number,
  totalSize: number,
  uploadId: string,
  cloudName: string,
  uploadPreset: string,
  onProgress?: (bytesSent: number) => void,
): Promise<string | null> {
  const rangeEnd = rangeStart + chunk.size - 1;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
    );
    xhr.timeout = CHUNK_TIMEOUT_MS;

    // Cloudinary chunked-upload headers
    xhr.setRequestHeader("X-Unique-Upload-Id", uploadId);
    xhr.setRequestHeader(
      "Content-Range",
      `bytes ${rangeStart}-${rangeEnd}/${totalSize}`,
    );

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(rangeStart + e.loaded);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        // Final chunk — Cloudinary returns the assembled asset
        try {
          resolve(JSON.parse(xhr.responseText).secure_url ?? null);
        } catch {
          reject(
            new Error("Cloudinary returned unexpected JSON for final chunk."),
          );
        }
      } else if (xhr.status === 204 || xhr.status === 206) {
        // Intermediate chunk accepted, no URL yet
        resolve(null);
      } else {
        let detail = "";
        try {
          detail = JSON.parse(xhr.responseText)?.error?.message ?? "";
        } catch {
          /**/
        }
        reject(
          new Error(
            `Chunk upload failed (${xhr.status}): ${detail || xhr.statusText}`,
          ),
        );
      }
    };

    xhr.ontimeout = () =>
      reject(
        new Error(`Chunk upload timed out after ${CHUNK_TIMEOUT_MS / 1000}s.`),
      );
    xhr.onerror = () =>
      reject(
        new Error("Network error during chunk upload. Check your connection."),
      );

    const fd = new FormData();
    fd.append("file", chunk);
    fd.append("upload_preset", uploadPreset);
    xhr.send(fd);
  });
}

/**
 * Splits blob into CHUNK_SIZE_BYTES slices and uploads each sequentially.
 * Progress is reported as 0–100 across the whole file.
 */
export async function saveToCloudinaryChunked(
  blob: Blob,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const { cloudName, uploadPreset } = STORAGE_CONFIG.CLOUDINARY;

  if (!cloudName || cloudName.includes("REPLACE")) {
    throw new Error(
      "Cloudinary is not configured. Check your environment variables.",
    );
  }

  if (blob.size > MAX_VIDEO_BYTES) {
    throw new Error(
      `Video is too large (${(blob.size / 1024 / 1024).toFixed(0)} MB). ` +
        `Maximum is ${MAX_VIDEO_BYTES / 1024 / 1024} MB.`,
    );
  }

  const uploadId = crypto.randomUUID().replace(/-/g, ""); // Cloudinary prefers no dashes
  const totalSize = blob.size;
  const totalChunks = Math.ceil(totalSize / CHUNK_SIZE_BYTES);
  let finalUrl: string | null = null;

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE_BYTES;
    const chunk = blob.slice(
      start,
      Math.min(start + CHUNK_SIZE_BYTES, totalSize),
    );

    let lastError: Error = new Error("Chunk upload failed");
    let succeeded = false;

    for (let attempt = 1; attempt <= MAX_CHUNK_RETRIES; attempt++) {
      try {
        const result = await uploadChunk(
          chunk,
          start,
          totalSize,
          uploadId,
          cloudName,
          uploadPreset,
          (bytesSent) => onProgress?.((bytesSent / totalSize) * 100),
        );

        if (result) finalUrl = result; // only set on the last chunk
        succeeded = true;
        break;
      } catch (err: any) {
        lastError = err;
        console.warn(
          `Chunk ${i + 1}/${totalChunks} attempt ${attempt} failed:`,
          err.message,
        );

        // 4xx errors are permanent — no point retrying
        const isFatal = /40[013]/.test(err.message);
        if (isFatal || attempt === MAX_CHUNK_RETRIES) break;

        await new Promise((r) => setTimeout(r, 1500 * attempt)); // 1.5 s, 3 s back-off
      }
    }

    if (!succeeded) throw lastError;

    // Smooth progress: report chunk completion even if the last byte callback was skipped
    onProgress?.((Math.min(i + 1, totalChunks) / totalChunks) * 100);
  }

  if (!finalUrl) {
    throw new Error(
      "Cloudinary did not return a URL after all chunks were uploaded.",
    );
  }

  return finalUrl;
}

// ─── Audio-preserving compression (fallback for > COMPRESS_THRESHOLD_BYTES) ──

/**
 * Compresses a video blob while preserving audio.
 *
 * Root cause of the old silent-video bug:
 *   canvas.captureStream() only yields a *video* MediaStream.
 *   Audio was never included, so MediaRecorder recorded silence.
 *
 * Fix:
 *   1. Load the original blob into a <video> element.
 *   2. Route its audio through a Web Audio API MediaElementSourceNode
 *      into a MediaStreamDestinationNode to get an audio MediaStream.
 *   3. Combine the canvas video track + audio track into one stream
 *      before passing it to MediaRecorder.
 *
 * We only call this for blobs > COMPRESS_THRESHOLD_BYTES because chunked
 * upload handles everything else without any quality loss.
 */
export async function tryCompressBlob(blob: Blob): Promise<Blob> {
  // Skip compression for small/medium files — chunked upload will handle them
  if (blob.size < COMPRESS_THRESHOLD_BYTES) return blob;

  // Check browser support
  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
    ? "video/webm;codecs=vp9,opus"
    : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
      ? "video/webm;codecs=vp8,opus"
      : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : null;

  if (!mimeType) return blob; // browser can't re-encode — upload as-is

  const objectUrl = URL.createObjectURL(blob);

  try {
    // 1. Load source video to get dimensions and duration
    const sourceVideo = document.createElement("video");
    sourceVideo.src = objectUrl;
    sourceVideo.muted = true; // muted so autoplay policy doesn't block us
    sourceVideo.playsInline = true;

    await new Promise<void>((resolve, reject) => {
      sourceVideo.onloadedmetadata = () => resolve();
      sourceVideo.onerror = () =>
        reject(new Error("Failed to load video for compression."));
    });

    // 2. Set up canvas scaled to ≤1280 px wide (preserve aspect ratio)
    const scale = Math.min(1, 1280 / (sourceVideo.videoWidth || 1280));
    const cw = Math.round((sourceVideo.videoWidth || 1280) * scale);
    const ch = Math.round((sourceVideo.videoHeight || 720) * scale);
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d")!;

    // 3. Web Audio: source → destination (gives us an audio MediaStream)
    const audioCtx = new AudioContext();
    const audioSource = audioCtx.createMediaElementSource(sourceVideo);
    const audioDest = audioCtx.createMediaStreamDestination();
    // Connect to both destination node (for capture) AND audioCtx.destination
    // so the user doesn't hear surprise audio during compression.
    audioSource.connect(audioDest);
    // Do NOT connect to audioCtx.destination — silent in browser, captured for encoding

    // 4. Combine canvas video track + audio track into one stream
    const canvasStream = canvas.captureStream(24);
    const audioTrack = audioDest.stream.getAudioTracks()[0];
    if (audioTrack) {
      canvasStream.addTrack(audioTrack);
    }

    // 5. Record the combined stream
    const recorder = new MediaRecorder(canvasStream, {
      mimeType,
      videoBitsPerSecond: 2_500_000, // 2.5 Mbps — decent quality
      audioBitsPerSecond: 128_000, // 128 kbps audio
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    return await new Promise<Blob>((resolve) => {
      recorder.onstop = async () => {
        audioCtx.close();
        const compressed = new Blob(chunks, { type: mimeType });
        // Only use the compressed version if it's actually smaller
        resolve(compressed.size < blob.size ? compressed : blob);
      };

      recorder.start(100); // collect data every 100 ms

      // Draw frames in sync with the video
      const drawFrame = () => {
        if (sourceVideo.ended || sourceVideo.paused) {
          recorder.stop();
          return;
        }
        ctx.drawImage(sourceVideo, 0, 0, cw, ch);
        requestAnimationFrame(drawFrame);
      };

      sourceVideo.play().then(() => requestAnimationFrame(drawFrame));
    });
  } catch (err) {
    console.warn("Video compression failed, uploading original:", err);
    return blob; // fall through to chunked upload of original
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// ─── Public entry point: saveVideo ───────────────────────────────────────────
//
// Replace the existing saveVideo() in services/db.ts with this version.
// Logic:
//   1. If file > COMPRESS_THRESHOLD_BYTES → try audio-safe compression first.
//   2. Upload (possibly compressed) blob via chunked Cloudinary upload.
//   3. Legacy Firebase path preserved for STORAGE_CONFIG.PROVIDER === "FIREBASE".

export const saveVideo = async (
  blob: Blob,
  onProgress?: (progress: number) => void,
): Promise<string> => {
  const provider = STORAGE_CONFIG.PROVIDER;

  // ── CLOUDINARY (default) ──────────────────────────────────────────────────
  if (provider === "CLOUDINARY") {
    if (
      !STORAGE_CONFIG.CLOUDINARY.cloudName ||
      STORAGE_CONFIG.CLOUDINARY.cloudName.includes("REPLACE")
    ) {
      throw new Error(
        "Cloudinary is not configured. Check your environment variables.",
      );
    }

    // Send the original blob directly — chunked upload handles any size
    // without re-encoding. tryCompressBlob is intentionally skipped:
    // for a 700 MB video it would silently re-encode in real-time (~5 min)
    // with zero progress feedback.
    return await saveToCloudinaryChunked(blob, onProgress);
  }

  // ── FIREBASE (legacy) ─────────────────────────────────────────────────────
  // Kept unchanged so switching back is trivial.
  if (!isFirebaseConfigured) {
    throw new Error("Firebase not configured");
  }

  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, `videos/${id}`);
    const uploadTask = uploadBytesResumable(storageRef, blob, {
      contentType: blob.type || "video/webm",
    });

    const timeoutId = setTimeout(() => {
      uploadTask.cancel();
      reject(new Error("Upload timed out."));
    }, 120_000);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        onProgress?.((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(new Error(error.message));
      },
      () => {
        clearTimeout(timeoutId);
        resolve(id);
      },
    );
  });
};

export const getVideo = async (id: string): Promise<string> => {
  if (!id || id === "DELETED") return "";

  if (
    id.startsWith("http") ||
    id.startsWith("blob:") ||
    id.startsWith("data:")
  ) {
    return id;
  }

  if (!isFirebaseConfigured) throw new Error("Firebase not configured");

  try {
    const storageRef = ref(storage, `videos/${id}`);
    return await getDownloadURL(storageRef);
  } catch (e) {
    console.error("Error retrieving video:", e);
    return "";
  }
};

export const deleteVideo = async (id: string): Promise<void> => {
  console.log("Starting deleteVideo for:", id);

  if (
    !id ||
    id === "DELETED" ||
    id.startsWith("blob:") ||
    id.startsWith("data:")
  ) {
    console.log("Invalid ID for deletion, skipping.");
    return;
  }

  // Cloudinary Deletion
  if (id.includes("cloudinary.com")) {
    const { cloudName, apiKey, apiSecret } = STORAGE_CONFIG.CLOUDINARY;

    if (!apiKey || !apiSecret) {
      console.warn(
        "Cloudinary deletion skipped: Missing API Key/Secret in services/db.ts",
      );
      return;
    }

    try {
      const regex = /\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/;
      const match = id.match(regex);

      if (!match) {
        console.warn("Could not extract public_id from Cloudinary URL:", id);
        return;
      }
      const publicId = match[1];
      const timestamp = Math.round(Date.now() / 1000).toString();
      const str = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
      const signature = await sha1(str);

      const formData = new FormData();
      formData.append("public_id", publicId);
      formData.append("signature", signature);
      formData.append("api_key", apiKey);
      formData.append("timestamp", timestamp);
      const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/video/destroy`;

      const res = await fetch(endpoint, { method: "POST", body: formData });
      const result = await res.json();
      if (result.result !== "ok") {
        console.error("Cloudinary delete failed:", result);
      } else {
        console.log("Cloudinary video deleted successfully:", publicId);
      }
    } catch (e) {
      console.error("Cloudinary delete exception", e);
    }
    return;
  }

  // Firebase Deletion
  if (isFirebaseConfigured && !id.startsWith("http")) {
    try {
      const storageRef = ref(storage, `videos/${id}`);
      await deleteObject(storageRef);
      console.log("Firebase video deleted:", id);
    } catch (error) {
      console.warn("Error deleting firebase video:", error);
    }
  }
};

// Helper to handle Firebase errors gracefully
const handleFirebaseError = (e: any, context: string) => {
  console.error(`Firebase Error in ${context}:`, e);

  if (!isFirebaseConfigured) {
    throw new Error(
      `Firebase not configured. Please set your credentials in services/firebase.ts.`,
    );
  }

  const code = e.code || "";
  const message = e.message || "";

  if (
    code === "auth/unauthorized-domain" ||
    message.includes("unauthorized-domain")
  ) {
    const domain = window.location.hostname;
    throw new Error(
      `Domain (${domain}) is not authorized in Firebase Console.`,
    );
  }

  if (code === "auth/popup-closed-by-user") {
    throw new Error("Sign in cancelled by user.");
  }

  if (code === "auth/email-already-in-use") {
    throw new Error("Email is already in use.");
  }

  throw e;
};

// API Surface
export const db = {
  // --- REAL-TIME SUBSCRIPTIONS (For Persistence & Notifications) ---

  subscribeToAuth: (callback: (user: User | null) => void) => {
    if (!isFirebaseConfigured) return;
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const docRef = doc(dbFirestore, "users", firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            callback(docSnap.data() as User);
          } else {
            callback(null);
          }
        } catch (e) {
          console.error(
            "Error fetching user profile during auth state change",
            e,
          );
          callback(null);
        }
      } else {
        callback(null);
      }
    });
  },

  subscribeToSubmissions: (callback: (subs: Submission[]) => void) => {
    if (!isFirebaseConfigured) return;
    const q = query(collection(dbFirestore, "submissions"));
    return onSnapshot(q, (snapshot) => {
      const subs: Submission[] = [];
      snapshot.forEach((doc) => subs.push(doc.data() as Submission));
      callback(subs);
    });
  },

  subscribeToUsers: (callback: (users: User[]) => void) => {
    if (!isFirebaseConfigured) return;
    return onSnapshot(collection(dbFirestore, "users"), (snapshot) => {
      const users: User[] = [];
      snapshot.forEach((doc) => users.push(doc.data() as User));
      callback(users);
    });
  },

  subscribeToExercises: (callback: (exercises: Exercise[]) => void) => {
    if (!isFirebaseConfigured) return;
    return onSnapshot(collection(dbFirestore, "exercises"), (snapshot) => {
      const exercises: Exercise[] = [];
      snapshot.forEach((doc) => exercises.push(doc.data() as Exercise));
      // Seed if empty (first load)
      if (exercises.length === 0) {
        MOCK_EXERCISES.forEach((ex) =>
          setDoc(doc(dbFirestore, "exercises", ex.id), ex),
        );
        callback(MOCK_EXERCISES);
      } else {
        callback(exercises);
      }
    });
  },

  subscribeToMessages: (
    userId: string,
    callback: (messages: Message[]) => void,
  ) => {
    if (!isFirebaseConfigured) return;
    const q = query(
      collection(dbFirestore, "messages"),
      orderBy("timestamp", "asc"),
    );
    return onSnapshot(q, (snapshot) => {
      const all: Message[] = [];
      snapshot.forEach((doc) => all.push(doc.data() as Message));
      callback(
        all.filter((m) => m.senderId === userId || m.receiverId === userId),
      );
    });
  },

  logout: async () => {
    if (!isFirebaseConfigured) return;

    if (Capacitor.isNativePlatform()) {
      try {
        const { GoogleAuth } =
          await import("@codetrix-studio/capacitor-google-auth");
        // Initialize first to ensure GoogleSignInClient is not null
        await GoogleAuth.initialize({
          clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          scopes: ["profile", "email"],
          grantOfflineAccess: true,
        });
        await GoogleAuth.signOut();
      } catch (e) {
        // Non-fatal — user may not have signed in via Google this session
        console.warn("GoogleAuth signOut skipped:", e);
      }
    }

    await signOut(auth);
  },

  // --- EXISTING METHODS ---

  getUsers: async (): Promise<User[]> => {
    if (!isFirebaseConfigured) throw new Error("Firebase not configured");
    try {
      const querySnapshot = await getDocs(collection(dbFirestore, "users"));
      const users: User[] = [];
      querySnapshot.forEach((doc) => {
        users.push(doc.data() as User);
      });
      return users;
    } catch (e) {
      throw handleFirebaseError(e, "getUsers");
    }
  },

  registerUser: async (
    email: string,
    password: string,
    name: string,
  ): Promise<User> => {
    if (!isFirebaseConfigured) throw new Error("Firebase not configured");

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const uid = userCredential.user.uid;
      const newUser: User = {
        id: uid,
        email,
        name,
        role: UserRole.TRAINEE,
        points: 0,
      };
      await setDoc(doc(dbFirestore, "users", uid), newUser);
      return newUser;
    } catch (e: any) {
      if (e.code === "auth/email-already-in-use") {
        try {
          const userCredential = await signInWithEmailAndPassword(
            auth,
            email,
            password,
          );
          const uid = userCredential.user.uid;
          const docRef = doc(dbFirestore, "users", uid);
          const docSnap = await getDoc(docRef);

          if (!docSnap.exists()) {
            const newUser: User = {
              id: uid,
              email,
              name,
              role: UserRole.TRAINEE,
              points: 0,
            };
            await setDoc(docRef, newUser);
            return newUser;
          }
        } catch (innerError) {
          /* ignore */
        }
      }
      throw handleFirebaseError(e, "registerUser");
    }
  },

  loginUser: async (email: string, password: string): Promise<User> => {
    if (!isFirebaseConfigured) throw new Error("Firebase not configured");

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const uid = userCredential.user.uid;
      const docRef = doc(dbFirestore, "users", uid);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error("User profile not found.");
      }

      return docSnap.data() as User;
    } catch (e) {
      throw handleFirebaseError(e, "loginUser");
    }
  },

  loginWithGoogle: async (): Promise<User> => {
    if (!isFirebaseConfigured) throw new Error("Firebase not configured");

    try {
      let firebaseUser;

      if (Capacitor.isNativePlatform()) {
        const { GoogleAuth } =
          await import("@codetrix-studio/capacitor-google-auth");
        // Must initialize before signing in
        await GoogleAuth.initialize({
          clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          scopes: ["profile", "email"],
          grantOfflineAccess: true,
        });
        const googleUser = await GoogleAuth.signIn();
        const credential = GoogleAuthProvider.credential(
          googleUser.authentication.idToken,
        );
        const result = await signInWithCredential(auth, credential);
        firebaseUser = result.user;
      } else {
        // Check if returning from redirect first
        const redirectResult = await getRedirectResult(auth);
        if (redirectResult) {
          firebaseUser = redirectResult.user;
        } else {
          // Trigger redirect — page will reload and return here
          await signInWithRedirect(auth, googleProvider);
          throw new Error("REDIRECT"); // Redirect is happening, page will reloa
        }
      }

      const docRef = doc(dbFirestore, "users", firebaseUser.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return docSnap.data() as User;
      } else {
        const newUser: User = {
          id: firebaseUser.uid,
          email: firebaseUser.email || "",
          name: firebaseUser.displayName || "Google User",
          role: UserRole.TRAINEE,
          points: 0,
        };
        await setDoc(docRef, newUser);
        return newUser;
      }
    } catch (e) {
      throw handleFirebaseError(e, "loginWithGoogle");
    }
  },

  updateUser: async (updatedUser: User) => {
    if (!isFirebaseConfigured) throw new Error("Firebase not configured");
    const { id, ...fields } = updatedUser;
    await updateDoc(doc(dbFirestore, "users", id), fields as any);
  },

  updateUserPoints: async (userId: string, points: number) => {
    if (!isFirebaseConfigured) throw new Error("Firebase not configured");

    const docRef = doc(dbFirestore, "users", userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const currentPoints = docSnap.data().points || 0;
      await updateDoc(docRef, { points: currentPoints + points });
    }
  },

  deleteUser: async (userId: string) => {
    if (!isFirebaseConfigured) throw new Error("Firebase not configured");

    try {
      const qSubs = query(
        collection(dbFirestore, "submissions"),
        where("traineeId", "==", userId),
      );
      const snapSubs = await getDocs(qSubs);

      const videoDeletionPromises: Promise<void>[] = [];
      const subDeletePromises: Promise<void>[] = [];

      for (const docSnap of snapSubs.docs) {
        const sub = docSnap.data() as Submission;
        if (sub.videoIds && Array.isArray(sub.videoIds)) {
          for (const vidId of sub.videoIds) {
            if (vidId && vidId !== "DELETED") {
              videoDeletionPromises.push(
                deleteVideo(vidId).catch((err) =>
                  console.warn(`Failed to delete video ${vidId}`, err),
                ),
              );
            }
          }
        }
        subDeletePromises.push(deleteDoc(docSnap.ref));
      }

      await Promise.all(videoDeletionPromises);
      await Promise.all(subDeletePromises);

      const qPlans = query(
        collection(dbFirestore, "plans"),
        where("traineeId", "==", userId),
      );
      const snapPlans = await getDocs(qPlans);
      const planDeletePromises = snapPlans.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(planDeletePromises);

      const qSent = query(
        collection(dbFirestore, "messages"),
        where("senderId", "==", userId),
      );
      const snapSent = await getDocs(qSent);
      const qReceived = query(
        collection(dbFirestore, "messages"),
        where("receiverId", "==", userId),
      );
      const snapReceived = await getDocs(qReceived);

      const msgDeletePromises = [
        ...snapSent.docs.map((d) => deleteDoc(d.ref)),
        ...snapReceived.docs.map((d) => deleteDoc(d.ref)),
      ];
      await Promise.all(msgDeletePromises);
      await deleteDoc(doc(dbFirestore, "users", userId));
    } catch (e) {
      throw handleFirebaseError(e, "deleteUser");
    }
  },

  getExercises: async (): Promise<Exercise[]> => {
    if (!isFirebaseConfigured) throw new Error("Firebase not configured");
    try {
      const querySnapshot = await getDocs(collection(dbFirestore, "exercises"));
      if (querySnapshot.empty) {
        for (const ex of MOCK_EXERCISES) {
          await setDoc(doc(dbFirestore, "exercises", ex.id), ex);
        }
        return MOCK_EXERCISES;
      }
      const exercises: Exercise[] = [];
      querySnapshot.forEach((doc) => exercises.push(doc.data() as Exercise));
      return exercises;
    } catch (e) {
      throw handleFirebaseError(e, "getExercises");
    }
  },

  saveExercise: async (exercise: Exercise) => {
    if (!isFirebaseConfigured) throw new Error("Firebase not configured");
    await setDoc(doc(dbFirestore, "exercises", exercise.id), exercise);
  },

  getPlan: async (traineeId: string): Promise<WorkoutPlan | null> => {
    if (!isFirebaseConfigured) throw new Error("Firebase not configured");
    try {
      const q = query(
        collection(dbFirestore, "plans"),
        where("traineeId", "==", traineeId),
      );
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) return null;
      return querySnapshot.docs[0].data() as WorkoutPlan;
    } catch (e) {
      throw handleFirebaseError(e, "getPlan");
    }
  },

  savePlan: async (plan: WorkoutPlan) => {
    if (!isFirebaseConfigured) throw new Error("Firebase not configured");
    const existing = await db.getPlan(plan.traineeId);
    if (existing) {
      const q = query(
        collection(dbFirestore, "plans"),
        where("traineeId", "==", plan.traineeId),
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const docId = snap.docs[0].id;
        await setDoc(doc(dbFirestore, "plans", docId), plan);
      } else {
        await addDoc(collection(dbFirestore, "plans"), plan);
      }
    } else {
      await addDoc(collection(dbFirestore, "plans"), plan);
    }
  },

  getSubmissions: async (): Promise<Submission[]> => {
    if (!isFirebaseConfigured) throw new Error("Firebase not configured");
    try {
      const querySnapshot = await getDocs(
        collection(dbFirestore, "submissions"),
      );
      const subs: Submission[] = [];
      querySnapshot.forEach((doc) => subs.push(doc.data() as Submission));
      return subs;
    } catch (e) {
      throw handleFirebaseError(e, "getSubmissions");
    }
  },

  saveSubmission: async (sub: Submission) => {
    if (!isFirebaseConfigured) throw new Error("Firebase not configured");
    await setDoc(doc(dbFirestore, "submissions", sub.id), sub);
  },

  updateSubmission: async (sub: Submission) => {
    if (!isFirebaseConfigured) throw new Error("Firebase not configured");
    await setDoc(doc(dbFirestore, "submissions", sub.id), sub, { merge: true });
  },

  deleteSubmissionVideo: async (submissionId: string, videoId: string) => {
    if (!isFirebaseConfigured) throw new Error("Firebase not configured");

    const docRef = doc(dbFirestore, "submissions", submissionId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists())
      throw new Error(`Submission with ID ${submissionId} not found`);

    const sub = docSnap.data() as Submission;
    const currentIds = sub.videoIds || [];

    if (!currentIds.includes(videoId))
      throw new Error("Video not found in this submission.");

    try {
      await deleteVideo(videoId);
    } catch (e) {
      console.error(
        "Failed to delete video file from storage, but proceeding to update DB record.",
        e,
      );
    }

    const updatedVideoIds = currentIds.map((v) =>
      v === videoId ? "DELETED" : v,
    );
    await updateDoc(docRef, { videoIds: updatedVideoIds, videosDeleted: true });
  },

  cleanupOldVideos: async () => {},

  getMessages: async (userId: string): Promise<Message[]> => {
    if (!isFirebaseConfigured) throw new Error("Firebase not configured");
    try {
      const q = query(
        collection(dbFirestore, "messages"),
        orderBy("timestamp", "asc"),
      );
      const querySnapshot = await getDocs(q);
      const allMessages: Message[] = [];
      querySnapshot.forEach((doc) => allMessages.push(doc.data() as Message));
      return allMessages.filter(
        (m) => m.senderId === userId || m.receiverId === userId,
      );
    } catch (e) {
      throw handleFirebaseError(e, "getMessages");
    }
  },

  sendMessage: async (
    senderId: string,
    receiverId: string,
    content: string,
  ): Promise<Message> => {
    if (!isFirebaseConfigured) throw new Error("Firebase not configured");
    const newMsg: Message = {
      id: crypto.randomUUID(),
      senderId,
      receiverId,
      content,
      timestamp: Date.now(),
      read: false,
    };
    await setDoc(doc(dbFirestore, "messages", newMsg.id), newMsg);
    return newMsg;
  },

  markMessagesAsRead: async (messageIds: string[]) => {
    if (!isFirebaseConfigured) throw new Error("Firebase not configured");
    for (const id of messageIds) {
      await updateDoc(doc(dbFirestore, "messages", id), { read: true });
    }
  },

  performCleanup: async () => {
    if (isFirebaseConfigured) await db.cleanupOldVideos();
  },

  getOrCreateUserFromFirebase: async (firebaseUser: any): Promise<User> => {
    const docRef = doc(dbFirestore, "users", firebaseUser.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as User;
    }
    const newUser: User = {
      id: firebaseUser.uid,
      email: firebaseUser.email || "",
      name: firebaseUser.displayName || "Google User",
      role: UserRole.TRAINEE,
      points: 0,
    };
    await setDoc(docRef, newUser);
    return newUser;
  },
};
