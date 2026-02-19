
import { User, UserRole, Exercise, WorkoutPlan, Submission, Message } from '../types';
import { auth, dbFirestore, isFirebaseConfigured, googleProvider, storage } from './firebase';
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
  onSnapshot
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut,
  signInWithCredential,
  GoogleAuthProvider,
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';

// ==========================================
// STORAGE CONFIGURATION
// ==========================================

export const STORAGE_CONFIG = {
    // PROVIDER OPTIONS:
    // 'FIREBASE'   - Uses Firebase Storage
    // 'CLOUDINARY' - Uses Cloudinary (Recommended for Video)
    PROVIDER: 'CLOUDINARY' as 'FIREBASE' | 'CLOUDINARY', 
    
    CLOUDINARY: {
        cloudName: "dsozughdl", 
        uploadPreset: "fittrack",
        // API Key and Secret are required for client-side deletion.
        apiKey: "536924668125995", 
        apiSecret: "KlPz_QAKOAMpACJkH0Biajb7TB8" 
    }
};

// ==========================================
// HELPER: SHA1 for Cloudinary Signature
// ==========================================
async function sha1(str: string) {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-1', enc.encode(str));
  return Array.from(new Uint8Array(hash))
    .map(v => v.toString(16).padStart(2, '0'))
    .join('');
}


// --- MOCK EXERCISES ---
// Used to seed the database if empty
const MOCK_EXERCISES: Exercise[] = [
  // Chest
  { id: 'c1', name: 'Barbell Bench Press', category: 'Chest', description: 'Compound chest exercise.' },
  { id: 'c2', name: 'Incline Dumbbell Press', category: 'Chest', description: 'Upper chest focus.' },
  { id: 'c3', name: 'Cable Flyes', category: 'Chest', description: 'Chest isolation.' },
  { id: 'c4', name: 'Push-ups', category: 'Chest', description: 'Bodyweight standard.' },
  // Back
  { id: 'b1', name: 'Deadlift', category: 'Back', description: 'Full body compound.' },
  { id: 'b2', name: 'Pull-ups', category: 'Back', description: 'Vertical pull.' },
  { id: 'b3', name: 'Barbell Rows', category: 'Back', description: 'Horizontal row.' },
  { id: 'b4', name: 'Lat Pulldown', category: 'Back', description: 'Vertical pull machine.' },
  { id: 'b5', name: 'Static Pull-up Hold', category: 'Back', description: 'Isometric back strength.' },
  { id: 'b6', name: 'One-Arm Dumbbell Row', category: 'Back', description: 'Unilateral back exercise.' },
  // Legs
  { id: 'l1', name: 'Barbell Squat', category: 'Legs', description: 'King of leg exercises.' },
  { id: 'l2', name: 'Leg Press', category: 'Legs', description: 'Machine leg push.' },
  { id: 'l3', name: 'Romanian Deadlift', category: 'Legs', description: 'Hamstring focus.' },
  { id: 'l4', name: 'Lunges', category: 'Legs', description: 'Unilateral leg work.' },
  { id: 'l5', name: 'Calf Raises', category: 'Legs', description: 'Isolation for calves.' },
  // Shoulders
  { id: 's1', name: 'Overhead Press', category: 'Shoulders', description: 'Vertical push.' },
  { id: 's2', name: 'Lateral Raises', category: 'Shoulders', description: 'Side delt isolation.' },
  { id: 's3', name: 'Face Pulls', category: 'Shoulders', description: 'Rear delt and posture.' },
  // Arms
  { id: 'a1', name: 'Barbell Curls', category: 'Arms', description: 'Bicep builder.' },
  { id: 'a2', name: 'Tricep Pushdowns', category: 'Arms', description: 'Tricep isolation.' },
  { id: 'a3', name: 'Hammer Curls', category: 'Arms', description: 'Brachialis focus.' },
  { id: 'a4', name: 'Skullcrushers', category: 'Arms', description: 'Tricep extension.' },
  // Core / Cardio
  { id: 'x1', name: 'Plank', category: 'Core', description: 'Static hold.' },
  { id: 'x2', name: 'Hanging Leg Raises', category: 'Core', description: 'Lower abs.' },
  { id: 'x3', name: 'Burpees', category: 'Cardio', description: 'Full body conditioning.' },
  { id: 'x4', name: 'Mountain Climbers', category: 'Cardio', description: 'High intensity core.' },
  { id: 'x5', name: 'Running', category: 'Cardio', description: 'Steady state cardio.' },
  { id: 'x6', name: 'Stairs Running', category: 'Cardio', description: 'High intensity cardio.' },
  { id: 'x7', name: 'Jump Rope', category: 'Cardio', description: 'Coordination and cardio.' },
  { id: 'x8', name: 'Sit-ups', category: 'Core', description: 'Abdominal flexion.' },
  { id: 'x9', name: 'Penguin Crunches', category: 'Core', description: 'Oblique focus.' },
  { id: 'x10', name: 'Bicycle Crunches', category: 'Core', description: 'Dynamic core stability.' },
];

// --- CLOUDINARY STORAGE ---
const saveToCloudinary = (blob: Blob, onProgress?: (p: number) => void): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (STORAGE_CONFIG.CLOUDINARY.cloudName.includes("REPLACE")) {
            reject(new Error("Cloudinary Config Missing. Open services/db.ts and update cloudName/uploadPreset."));
            return;
        }

        const url = `https://api.cloudinary.com/v1_1/${STORAGE_CONFIG.CLOUDINARY.cloudName}/video/upload`;
        const formData = new FormData();
        formData.append('file', blob);
        formData.append('upload_preset', STORAGE_CONFIG.CLOUDINARY.uploadPreset);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgress) {
                const percent = (e.loaded / e.total) * 100;
                onProgress(percent);
            }
        };

        xhr.onload = () => {
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                resolve(response.secure_url);
            } else {
                reject(new Error(`Cloudinary Error: ${xhr.statusText} (${xhr.status})`));
            }
        };

        xhr.onerror = () => reject(new Error("Network Error uploading to Cloudinary"));
        xhr.send(formData);
    });
};


// --- MAIN STORAGE FUNCTIONS ---

export const saveVideo = async (blob: Blob, onProgress?: (progress: number) => void): Promise<string> => {
  const provider = STORAGE_CONFIG.PROVIDER;
  const id = crypto.randomUUID();

  // 1. CLOUDINARY
  if (provider === 'CLOUDINARY') {
      return await saveToCloudinary(blob, onProgress);
  }

  // 2. FIREBASE (Legacy/Default)
  if (!isFirebaseConfigured) {
      throw new Error("Firebase not configured");
  }

  return new Promise((resolve, reject) => {
      const storageRef = ref(storage, `videos/${id}`);
      const uploadTask = uploadBytesResumable(storageRef, blob, { contentType: blob.type || 'video/webm' });

      const timeoutId = setTimeout(() => {
          uploadTask.cancel();
          reject(new Error("Upload timed out."));
      }, 60000);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress(progress);
        },
        (error) => {
          clearTimeout(timeoutId);
          console.error(error);
          reject(new Error(error.message));
        },
        () => {
          clearTimeout(timeoutId);
          resolve(id);
        }
      );
  });
};

export const getVideo = async (id: string): Promise<string> => {
  if (!id || id === 'DELETED') return '';
  
  if (id.startsWith('http') || id.startsWith('blob:') || id.startsWith('data:')) {
      return id;
  }

  if (!isFirebaseConfigured) throw new Error("Firebase not configured");
  
  try {
      const storageRef = ref(storage, `videos/${id}`);
      return await getDownloadURL(storageRef);
  } catch (e) {
      console.error("Error retrieving video:", e);
      return '';
  }
};

export const deleteVideo = async (id: string): Promise<void> => {
  console.log("Starting deleteVideo for:", id);

  if (!id || id === 'DELETED' || id.startsWith('blob:') || id.startsWith('data:')) {
      console.log("Invalid ID for deletion, skipping.");
      return;
  }
  
  // Cloudinary Deletion
  if (id.includes('cloudinary.com')) {
      const { cloudName, apiKey, apiSecret } = STORAGE_CONFIG.CLOUDINARY;
      
      if (!apiKey || !apiSecret) {
           console.warn("Cloudinary deletion skipped: Missing API Key/Secret in services/db.ts");
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
          formData.append('public_id', publicId);
          formData.append('signature', signature);
          formData.append('api_key', apiKey);
          formData.append('timestamp', timestamp);
          const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/video/destroy`;
          
          const res = await fetch(endpoint, { method: 'POST', body: formData });
          const result = await res.json();
          if (result.result !== 'ok') {
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
  if (isFirebaseConfigured && !id.startsWith('http')) {
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
        throw new Error(`Firebase not configured. Please set your credentials in services/firebase.ts.`);
    }

    const code = e.code || '';
    const message = e.message || '';
    
    if (code === 'auth/unauthorized-domain' || message.includes('unauthorized-domain')) {
        const domain = window.location.hostname;
        throw new Error(`Domain (${domain}) is not authorized in Firebase Console.`);
    }

    if (code === 'auth/popup-closed-by-user') {
        throw new Error("Sign in cancelled by user.");
    }

    if (code === 'auth/email-already-in-use') {
        throw new Error("Email is already in use.");
    }

    throw e;
}

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
                console.error("Error fetching user profile during auth state change", e);
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
          snapshot.forEach(doc => subs.push(doc.data() as Submission));
          callback(subs);
      });
  },

  logout: async () => {
    if (!isFirebaseConfigured) return;
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
      throw handleFirebaseError(e, 'getUsers');
    }
  },

  registerUser: async (email: string, password: string, name: string): Promise<User> => {
      if (!isFirebaseConfigured) throw new Error("Firebase not configured");

      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;
        const newUser: User = {
            id: uid,
            email,
            name,
            role: UserRole.TRAINEE, 
            points: 0
        };
        await setDoc(doc(dbFirestore, "users", uid), newUser);
        return newUser;
      } catch(e: any) {
        if (e.code === 'auth/email-already-in-use') {
            try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const uid = userCredential.user.uid;
                const docRef = doc(dbFirestore, "users", uid);
                const docSnap = await getDoc(docRef);

                if (!docSnap.exists()) {
                    const newUser: User = {
                        id: uid,
                        email,
                        name,
                        role: UserRole.TRAINEE,
                        points: 0
                    };
                    await setDoc(docRef, newUser);
                    return newUser;
                }
            } catch (innerError) { /* ignore */ }
        }
        throw handleFirebaseError(e, 'registerUser');
      }
  },

  loginUser: async (email: string, password: string): Promise<User> => {
      if (!isFirebaseConfigured) throw new Error("Firebase not configured");

      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;
        const docRef = doc(dbFirestore, "users", uid);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
             throw new Error("User profile not found.");
        }
        
        return docSnap.data() as User;
      } catch(e) {
         throw handleFirebaseError(e, 'loginUser');
      }
  },

  loginWithGoogle: async (): Promise<User> => {
    if (!isFirebaseConfigured) throw new Error("Firebase not configured");

    try {
        let firebaseUser;

        if (Capacitor.isNativePlatform()) {
            const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
            const googleUser = await GoogleAuth.signIn();
            const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken);
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
                return; // Function exits here, redirect takes over
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
                points: 0
            };
            await setDoc(docRef, newUser);
            return newUser;
        }
    } catch (e) {
        throw handleFirebaseError(e, 'loginWithGoogle');
    }
  },

  updateUser: async (updatedUser: User) => {
      if (!isFirebaseConfigured) throw new Error("Firebase not configured");
      await setDoc(doc(dbFirestore, "users", updatedUser.id), updatedUser, { merge: true });
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
          const qSubs = query(collection(dbFirestore, "submissions"), where("traineeId", "==", userId));
          const snapSubs = await getDocs(qSubs);
          
          const videoDeletionPromises: Promise<void>[] = [];
          const subDeletePromises: Promise<void>[] = [];

          for (const docSnap of snapSubs.docs) {
              const sub = docSnap.data() as Submission;
              if (sub.videoIds && Array.isArray(sub.videoIds)) {
                  for (const vidId of sub.videoIds) {
                      if (vidId && vidId !== 'DELETED') {
                          videoDeletionPromises.push(
                              deleteVideo(vidId).catch(err => console.warn(`Failed to delete video ${vidId}`, err))
                          );
                      }
                  }
              }
              subDeletePromises.push(deleteDoc(docSnap.ref));
          }
          
          await Promise.all(videoDeletionPromises);
          await Promise.all(subDeletePromises);

          const qPlans = query(collection(dbFirestore, "plans"), where("traineeId", "==", userId));
          const snapPlans = await getDocs(qPlans);
          const planDeletePromises = snapPlans.docs.map(d => deleteDoc(d.ref));
          await Promise.all(planDeletePromises);

          const qSent = query(collection(dbFirestore, "messages"), where("senderId", "==", userId));
          const snapSent = await getDocs(qSent);
          const qReceived = query(collection(dbFirestore, "messages"), where("receiverId", "==", userId));
          const snapReceived = await getDocs(qReceived);
          
          const msgDeletePromises = [
              ...snapSent.docs.map(d => deleteDoc(d.ref)),
              ...snapReceived.docs.map(d => deleteDoc(d.ref))
          ];
          await Promise.all(msgDeletePromises);
          await deleteDoc(doc(dbFirestore, "users", userId));

      } catch (e) {
          throw handleFirebaseError(e, 'deleteUser');
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
          throw handleFirebaseError(e, 'getExercises');
      }
  },
  
  saveExercise: async (exercise: Exercise) => {
      if (!isFirebaseConfigured) throw new Error("Firebase not configured");
      await setDoc(doc(dbFirestore, "exercises", exercise.id), exercise);
  },

  getPlan: async (traineeId: string): Promise<WorkoutPlan | null> => {
    if (!isFirebaseConfigured) throw new Error("Firebase not configured");
    try {
        const q = query(collection(dbFirestore, "plans"), where("traineeId", "==", traineeId));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) return null;
        return querySnapshot.docs[0].data() as WorkoutPlan;
    } catch (e) {
        throw handleFirebaseError(e, 'getPlan');
    }
  },
  
  savePlan: async (plan: WorkoutPlan) => {
    if (!isFirebaseConfigured) throw new Error("Firebase not configured");
    const existing = await db.getPlan(plan.traineeId);
    if (existing) {
        const q = query(collection(dbFirestore, "plans"), where("traineeId", "==", plan.traineeId));
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
        const querySnapshot = await getDocs(collection(dbFirestore, "submissions"));
        const subs: Submission[] = [];
        querySnapshot.forEach(doc => subs.push(doc.data() as Submission));
        return subs;
    } catch(e) {
        throw handleFirebaseError(e, 'getSubmissions');
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
      
      if (!docSnap.exists()) throw new Error(`Submission with ID ${submissionId} not found`);

      const sub = docSnap.data() as Submission;
      const currentIds = sub.videoIds || [];
      
      if (!currentIds.includes(videoId)) throw new Error("Video not found in this submission.");

      try {
        await deleteVideo(videoId);
      } catch (e) {
        console.error("Failed to delete video file from storage, but proceeding to update DB record.", e);
      }

      const updatedVideoIds = currentIds.map(v => v === videoId ? 'DELETED' : v);
      await updateDoc(docRef, { videoIds: updatedVideoIds, videosDeleted: true });
  },

  cleanupOldVideos: async () => {},

  getMessages: async (userId: string): Promise<Message[]> => {
      if (!isFirebaseConfigured) throw new Error("Firebase not configured");
      try {
        const q = query(collection(dbFirestore, "messages"), orderBy("timestamp", "asc"));
        const querySnapshot = await getDocs(q);
        const allMessages: Message[] = [];
        querySnapshot.forEach(doc => allMessages.push(doc.data() as Message));
        return allMessages.filter(m => m.senderId === userId || m.receiverId === userId);
      } catch (e) {
          throw handleFirebaseError(e, 'getMessages');
      }
  },

  sendMessage: async (senderId: string, receiverId: string, content: string): Promise<Message> => {
      if (!isFirebaseConfigured) throw new Error("Firebase not configured");
      const newMsg: Message = {
          id: crypto.randomUUID(),
          senderId,
          receiverId,
          content,
          timestamp: Date.now(),
          read: false
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
  }
};
