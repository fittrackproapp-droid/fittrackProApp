
import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, Exercise, WorkoutPlan, Submission, Message } from './types';
import { db, saveVideo, getVideo } from './services/db';
import VideoRecorder from './components/VideoRecorder';
import WorkoutCalendar from './components/WorkoutCalendar';
import InboxView from './components/InboxView';
import { messaging, VAPID_KEY, dbFirestore, auth } from './services/firebase';
import { getToken } from 'firebase/messaging';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { generateExerciseSuggestions } from './services/feedbackService';
import { translations, Language, TranslationKey } from './services/translations';
import { initNativePushNotifications, cleanupNativePushNotifications } from './capacitor-notifications';
import { 
  Dumbbell, 
  Users, 
  Video, 
  CheckCircle, 
  LogOut, 
  PlusCircle, 
  Trash2, 
  Play, 
  Sparkles,
  Trophy,
  UserPlus,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Lock,
  Mail,
  Activity,
  Globe,
  Calendar as CalendarIcon,
  Edit,
  MessageSquare,
  Home,
  Loader2,
  AlertTriangle,
  Upload,
  Camera,
  Film,
  Award,
  FileText,
  List,
  XCircle,
  HeartPulse,
  Bell,
  BellOff
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';

// --- Global Google Type ---
declare global {
    interface Window {
        google?: any;
    }
}

// --- Notification Logic ---
// Simple notification sound
const NOTIFICATION_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

const playNotificationSound = () => {
    try {
        const audio = new Audio(NOTIFICATION_SOUND_URL);
        audio.volume = 0.5;
        audio.play().catch(e => console.log("Audio play blocked", e));
    } catch (e) {
        console.error("Audio error", e);
    }
}

const sendLocalNotification = (title: string, body: string) => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        playNotificationSound();
        
        // Use ServiceWorker registration to show notification (Required for Android PWA)
        if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
            navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(title, {
                    body: body,
                    icon: 'https://cdn-icons-png.flaticon.com/512/2964/2964514.png',
                    badge: 'https://cdn-icons-png.flaticon.com/512/2964/2964514.png',
                    vibrate: [200, 100, 200],
                    tag: 'fittrack-update'
                } as any);
            });
        } else {
            // Fallback for desktop if SW not ready
            new Notification(title, {
                body,
                icon: 'https://cdn-icons-png.flaticon.com/512/2964/2964514.png'
            });
        }
    }
};

// --- Helper Components ---

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }> = ({ className, variant = 'primary', ...props }) => {
  const base = "px-4 py-2 rounded-lg font-medium transition flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:active:scale-100";
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200",
    secondary: "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50",
    danger: "bg-red-50 text-red-600 hover:bg-red-100",
    ghost: "bg-transparent text-gray-500 hover:text-gray-700"
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
};

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className, ...props }) => (
  <input className={`w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition ${className || ''}`} {...props} />
);

const Badge: React.FC<{ children: React.ReactNode, color: string }> = ({ children, color }) => (
  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${color}`}>{children}</span>
);

// --- Custom Muscle Icons ---
const MuscleIcon: React.FC<{ type: string, size?: number, className?: string }> = ({ type, size = 24, className = "" }) => {
    const commonProps = { width: size, height: size, fill: "currentColor", className: className, viewBox: "0 0 24 24" };
    
    switch(type.toLowerCase()) {
        case 'chest': // Pectorals
            return (
                <svg {...commonProps}>
                    <path d="M4 7c0 3 2 5 5 5s5-2 5-5c0-2-2-4-5-4S4 5 4 7z" opacity="0.5"/>
                    <path d="M15 7c0 3 2 5 5 5s5-2 5-5c0-2-2-4-5-4s-5 2-5 4z" opacity="0.5"/>
                    <path d="M2 9a2 2 0 0 1 2-2h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a2 2 0 0 1 2 2v2a8 8 0 0 1-8 8h-6a8 8 0 0 1-8-8V9z" />
                </svg>
            );
        case 'back': // Wide Back / Lats
            return (
                 <svg {...commonProps}>
                    <path d="M4 4l8 5 8-5v14l-8 4-8-4V4z" />
                </svg>
            );
        case 'legs': // Quads
            return (
                <svg {...commonProps}>
                    <path d="M5 4c0 10 5 18 7 18s7-8 7-18h-4c0 6-2 10-3 10s-3-4-3-10H5z" />
                </svg>
            );
        case 'arms': // Biceps
             return (
                <svg {...commonProps}>
                    <path d="M4 14c0 4 3 7 7 7s7-3 7-7v-4c0-2-2-4-4-4H9c-2 0-4 2-4 4v4z" />
                    <circle cx="11" cy="8" r="3" />
                </svg>
            );
        case 'shoulders': // Deltoids
            return (
                <svg {...commonProps}>
                    <path d="M2 10c0-4 4-8 10-8s10 4 10 8v2c0 2-2 4-4 4h-12c-2 0-4-2-4-4v-2z" />
                </svg>
            );
        case 'core': // Abs
            return (
                <svg {...commonProps}>
                     <rect x="8" y="4" width="8" height="4" rx="1" />
                     <rect x="8" y="9" width="8" height="4" rx="1" />
                     <rect x="8" y="14" width="8" height="4" rx="1" />
                </svg>
            );
        case 'cardio': 
            return <HeartPulse size={size} className={className} />;
        default: 
            return <Dumbbell size={size} className={className} />;
    }
}

const getCategoryIcon = (category: string) => {
    return <MuscleIcon type={category} size={18} />;
};

// --- Auth Screen Component ---
const AuthScreen = ({ onLogin, t, lang, setLang }: { onLogin: (u: User) => void, t: (k: TranslationKey) => string, lang: Language, setLang: (l: Language) => void }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            if (isLogin) {
                const u = await db.loginUser(email, password);
                onLogin(u);
            } else {
                if (!email || !password || !name) {
                    setError(t('all_fields_required'));
                    setLoading(false);
                    return;
                }
                const newUser = await db.registerUser(email, password, name);
                onLogin(newUser);
            }
        } catch (err: any) {
            setError(err.message || 'Authentication failed. Check your Firebase Config.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setError('');
        setLoading(true);
        try {
            const user = await db.loginWithGoogle();
            onLogin(user);
        } catch (err: any) {
            if (err.message === 'REDIRECT') return; // Normal redirect, not an error
            console.error("Login Error:", err);
            setError(err.message || 'Google Auth failed.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" dir={lang === 'he' ? 'rtl' : 'ltr'}>
             <div className="absolute top-4 right-4 rtl:left-4 rtl:right-auto">
                 <button 
                    onClick={() => setLang(lang === 'en' ? 'he' : 'en')}
                    className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm text-sm font-bold text-indigo-600 hover:bg-indigo-50 border border-gray-100"
                 >
                     <Globe size={16} />
                     {lang === 'en' ? 'עברית' : 'English'}
                 </button>
             </div>

            <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md border border-gray-100">
                <div className="text-center mb-8">
                    <div className="bg-indigo-600 w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-indigo-200">
                        <Dumbbell className="text-white w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">{t('app_name')}</h1>
                    <p className="text-gray-500 text-sm mt-1">{isLogin ? t('sign_in_title') : t('create_account_title')}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && (
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">{t('full_name')}</label>
                            <div className="relative">
                                <div className="absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 text-gray-400 flex items-center justify-center w-5 h-5">
                                    <Users size={20} />
                                </div>
                                <Input value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" className="pl-10 rtl:pr-10 rtl:pl-4" />
                            </div>
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">{t('email')}</label>
                        <div className="relative">
                            <div className="absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 text-gray-400 flex items-center justify-center w-5 h-5">
                                <Mail size={20} />
                            </div>
                            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="pl-10 rtl:pr-10 rtl:pl-4" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">{t('password')}</label>
                        <div className="relative">
                            <div className="absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 text-gray-400 flex items-center justify-center w-5 h-5">
                                <Lock size={20} />
                            </div>
                            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="pl-10 rtl:pr-10 rtl:pl-4" />
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-center">
                            <div className="flex items-center justify-center gap-2 text-red-600 font-bold text-sm mb-1">
                                <AlertTriangle size={16} />
                                <span>Error</span>
                            </div>
                            <p className="text-red-500 text-xs mb-2">{error}</p>
                        </div>
                    )}

                    <Button type="submit" className="w-full h-12 text-lg" disabled={loading}>
                        {loading ? <Loader2 className="animate-spin" /> : (isLogin ? t('sign_in') : t('create_account'))}
                    </Button>
                </form>

                <div className="my-6 flex items-center">
                    <div className="flex-grow border-t border-gray-200"></div>
                    <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">{t('or')}</span>
                    <div className="flex-grow border-t border-gray-200"></div>
                </div>

                <Button 
                    type="button" 
                    variant="secondary"
                    onClick={handleGoogleLogin} 
                    className="w-full relative flex items-center justify-center gap-3 py-3 font-bold text-gray-700"
                    disabled={loading}
                >
                   {/* Google G Logo */}
                   <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                   </svg>
                   {t('sign_in_google')}
                </Button>

                <div className="mt-6 text-center">
                    <button onClick={() => setIsLogin(!isLogin)} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                        {isLogin ? t('no_account') : t('have_account')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const PlanDisplay = ({ userId, exercises, onStartSession, t, users }: { userId: string, exercises: Exercise[], onStartSession: (ids: string[]) => void, t: any, users: User[] }) => {
    const [plan, setPlan] = useState<WorkoutPlan | null>(null);
    const [loading, setLoading] = useState(true);
    const [recordingExercises, setRecordingExercises] = useState<string[]>([]);

    useEffect(() => {
        db.getPlan(userId).then(setPlan).finally(() => setLoading(false));
    }, [userId]);

    if (loading) return <Loader2 className="animate-spin text-white/50" />;
    
    if (!plan || plan.exerciseIds.length === 0) {
        return <p className="text-indigo-100 opacity-80">{t('no_plan')}</p>;
    }
    const planExercises = exercises.filter(e => plan.exerciseIds.includes(e.id));
    
    return (
        <>
            <p className="text-indigo-100 text-sm mb-6 flex items-center gap-2">
                <CheckCircle size={14} /> {t('assigned_by')} {users.find(u => u.id === plan.coachId)?.name}
            </p>
            <div className="space-y-2 mb-6 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {planExercises.map(ex => (
                    <div 
                        key={ex.id} 
                        onClick={() => setRecordingExercises(prev => prev.includes(ex.id) ? prev.filter(x => x !== ex.id) : [...prev, ex.id])}
                        className={`p-3 rounded-xl cursor-pointer transition flex items-center justify-between border ${recordingExercises.includes(ex.id) ? 'bg-white text-indigo-700 border-white shadow-lg transform scale-[1.02]' : 'bg-white/10 border-white/10 hover:bg-white/20'}`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`p-1 rounded-full ${recordingExercises.includes(ex.id) ? 'bg-indigo-100 text-indigo-600' : 'bg-white/20 text-white'}`}>
                                {getCategoryIcon(ex.category)}
                            </div>
                            <div>
                                <span className="font-bold block text-sm">{t(ex.name)}</span>
                                <span className={`text-[10px] ${recordingExercises.includes(ex.id) ? 'text-indigo-400' : 'text-indigo-200'}`}>{t(ex.category)}</span>
                            </div>
                        </div>
                        {recordingExercises.includes(ex.id) ? <CheckCircle className="text-indigo-600" size={20} /> : <div className="w-5 h-5 rounded-full border-2 border-indigo-200/30" />}
                    </div>
                ))}
            </div>
            <Button 
                variant="secondary"
                onClick={() => onStartSession(recordingExercises)} 
                className="w-full py-3 font-bold text-indigo-600 hover:text-indigo-700"
                disabled={recordingExercises.length === 0}
            >
                <Video size={18} /> 
                {recordingExercises.length === 0 ? t('select_to_start') : `${t('record_session')} (${recordingExercises.length})`}
            </Button>
        </>
    );
}

const Leaderboard = ({ users, currentUser, t }: { users: User[], currentUser: User, t: any }) => {
    const trainees = users.filter(u => u.role === UserRole.TRAINEE).sort((a, b) => b.points - a.points);
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-yellow-600"><Trophy className="text-yellow-500" /> {t('leaderboard')}</h2>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left rtl:text-right">
                        <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4">#</th>
                                <th className="px-6 py-4">{t('full_name')}</th>
                                <th className="px-6 py-4 text-center">{t('points_label')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {trainees.map((u, index) => (
                                <tr key={u.id} className={`${u.id === currentUser.id ? 'bg-indigo-50' : 'hover:bg-gray-50'} transition`}>
                                    <td className="px-6 py-4 font-bold text-gray-400">
                                        {index === 0 ? <span className="text-2xl">🥇</span> : 
                                         index === 1 ? <span className="text-2xl">🥈</span> : 
                                         index === 2 ? <span className="text-2xl">🥉</span> : 
                                         index + 1}
                                    </td>
                                    <td className="px-6 py-4 font-bold text-gray-900 flex items-center gap-3">
                                         <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs text-white font-bold ${u.id === currentUser.id ? 'bg-indigo-600' : 'bg-gray-400'}`}>
                                            {u.name.charAt(0)}
                                         </div>
                                         {u.name} {u.id === currentUser.id && <span className="text-xs bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded-full">{t('you_bracket')}</span>}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <Badge color="bg-amber-100 text-amber-800 text-sm px-3 py-1">{u.points} pts</Badge>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// --- Main App ---

const App = () => {
  const [lang, setLang] = useState<Language>('he');
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true); // Persist loading state
  const [users, setUsers] = useState<User[]>([]);
  const [view, setView] = useState<'DASHBOARD' | 'RECORD' | 'SESSION_HUB' | 'HISTORY' | 'ADMIN' | 'PLANNING' | 'TRAINEE_DETAILS' | 'INBOX' | 'LEADERBOARD'>('DASHBOARD');
  const [adminView, setAdminView] = useState<'USERS' | 'SUBMISSIONS'>('USERS');
  const [loadingData, setLoadingData] = useState(false);
  const [isUploading, setIsUploading] = useState(false); // Track specifically if uploading video
  const [uploadProgress, setUploadProgress] = useState(0); 
  
  // Data State
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  
  // Coach/Planning specific
  const [selectedTraineeId, setSelectedTraineeId] = useState<string>('');
  const [currentPlanExercises, setCurrentPlanExercises] = useState<string[]>([]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // Trainee specific
  const [recordingExercises, setRecordingExercises] = useState<string[]>([]);
  // Added isExisting flag to track if video is already on server (for editing)
  const [sessionMedia, setSessionMedia] = useState<{id: string, file: Blob, type: 'video', preview: string, name: string, isExisting?: boolean}[]>([]);
  const [traineeNote, setTraineeNote] = useState('');
  const [editingSubmissionId, setEditingSubmissionId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Progress Tracking ref
  const progressMap = useRef<{[key: string]: number}>({});

  // Playback
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);

  // Expanded Feedback State (Track which feedback is expanded by ID)
  const [expandedFeedback, setExpandedFeedback] = useState<string[]>([]);

  // Inline delete confirmation: stores { subId, vidId } or null
  const [deleteConfirm, setDeleteConfirm] = useState<{ subId: string; vidId: string } | null>(null);

  // User delete confirmation
  const [deleteUserConfirm, setDeleteUserConfirm] = useState<string | null>(null);

  // Notification Permission State
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied',
  );

  const requestPermission = async () => {
    let res: NotificationPermission = 'denied';
    if (typeof Notification !== 'undefined') {
      res = await Notification.requestPermission();
    }
    setNotifPermission(res);
    if (res === 'granted' && user) {
        const swReg = await navigator.serviceWorker.ready;
        const subscription = await swReg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: VAPID_KEY 
        });
        await setDoc(doc(dbFirestore, 'pushSubscriptions', user.id), {
            subscription: subscription.toJSON(),
            userId: user.id,
            role: user.role
        }, { merge: true });
    }
  };

  const sendPushToUser = async (targetUserId: string, title: string, body: string) => {
    try {
      const subDoc = await getDoc(doc(dbFirestore, 'pushSubscriptions', targetUserId));
      if (!subDoc.exists()) return;
      
      const data = subDoc.data();
      
      await fetch('/.netlify/functions/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: data.subscription || null,
          nativeFcmToken: data.nativeFcmToken || null,
          title,
          body
        })
      });
    } catch (err) {
      console.error('Failed to send push:', err);
    }
  };
  // --- Auth Persistence Logic ---
  useEffect(() => {
    const unsubscribe = db.subscribeToAuth((restoredUser) => {
        if (restoredUser) {
            setUser(restoredUser);
        }
        setAuthLoading(false);
    });
    return () => {
        if (unsubscribe) unsubscribe();
    };
  }, []);

  // --- Handle Google Redirect Result on Web ---
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      import('firebase/auth').then(({ getRedirectResult }) => {
        getRedirectResult(auth).then(async (result) => {
          if (result?.user) {
            const firebaseUser = result.user;
            const u = await db.getOrCreateUserFromFirebase(firebaseUser);
            if (u) setUser(u);
          }
        }).catch(console.error);
      });
    }
  }, []);

  // --- Real-time Data & Notifications ---
  useEffect(() => {
    if (!user) return;

    initNativePushNotifications(
        async (token) => {
            // Save the native FCM token to Firestore so your backend can target this device
            await setDoc(doc(dbFirestore, 'pushSubscriptions', user.id), {
                nativeFcmToken: token,
                userId: user.id,
                role: user.role,
            }, { merge: true });
        },
        (notification) => {
            // Foreground notification received — show an in-app alert
            sendLocalNotification(
                notification.title ?? 'FitTrack',
                notification.body ?? ''
            );
        },
        (action) => {
            // User tapped a notification — you can navigate based on action.notification.data
            console.log('[Push] Tapped:', action.notification.data);
        },
    );

    refreshData(); // Initial fetch for static data (Users/Exercises/Messages)
    // Messages could also be real-time, but for now we focus on submissions notifications
    
    // Subscribe to Submissions for real-time updates and notifications
    const unsubscribeSubs = db.subscribeToSubmissions((newSubs) => {
        setSubmissions((prevSubs) => {
            // Check for notifications only if we have previous data (to avoid notifying on initial load)
            if (prevSubs.length > 0) {
                // 1. Coach Notification: New Submission (PENDING) added
                if (user.role === UserRole.COACH) {
                    const newPending = newSubs.filter(s => s.status === 'PENDING' && !prevSubs.find(p => p.id === s.id));
                    if (newPending.length > 0) {
                        const traineeName = users.find(u => u.id === newPending[0].traineeId)?.name || 'Trainee';
                        sendLocalNotification("New Submission", `${traineeName} just submitted a workout.`);
                    }
                }
                
                // 2. Trainee Notification: Submission marked COMPLETED (Feedback received)
                if (user.role === UserRole.TRAINEE) {
                    const newlyCompleted = newSubs.filter(s => 
                        s.traineeId === user.id && 
                        s.status === 'COMPLETED' && 
                        prevSubs.find(p => p.id === s.id && p.status === 'PENDING')
                    );
                    if (newlyCompleted.length > 0) {
                        sendLocalNotification("Workout Reviewed", "Your coach has reviewed your submission!");
                    }
                }
            }
            return newSubs;
        });
    });

    // Cleanup subscription
    return () => {
        if (unsubscribeSubs) unsubscribeSubs();
        cleanupNativePushNotifications();
    };
  }, [user]); // Re-subscribe if user changes

  const t = (key: string): string => {
      // @ts-ignore
      return translations[lang][key] || key;
  }

  const refreshData = async () => {
    if (!user) return;
    setLoadingData(true);
    try {
        const u = await db.getUsers();
        setUsers(u);
        const e = await db.getExercises();
        setExercises(e);
        // Submissions handled by subscription now
        const m = await db.getMessages(user.id);
        setMessages(m);
    } catch (e) {
        console.error("Error loading data", e);
    } finally {
        setLoadingData(false);
    }
  };

  const playVideo = async (id: string) => {
    if (id.startsWith('http') || id.startsWith('blob:') || id.startsWith('data:')) {
        setPlaybackUrl(id);
    } else {
        const url = await getVideo(id);
        setPlaybackUrl(url);
    }
  };

  const handleLogout = async () => { 
      await db.logout(); 
      setUser(null); 
      setPlaybackUrl(null); 
      setView('DASHBOARD'); 
      setSelectedTraineeId(''); 
      setSessionMedia([]); 
      setTraineeNote(''); 
      setEditingSubmissionId(null); 
  };
  const handleHomeView = () => { if (user?.role === UserRole.ADMIN) { setView('ADMIN'); } else { setView('DASHBOARD'); } };
  const handleSwitchUser = () => { if (!users.length) return; const currentIndex = users.findIndex(u => u.id === user?.id); const nextIndex = (currentIndex + 1) % users.length; setUser(users[nextIndex]); setView('DASHBOARD'); };
  const handleSendMessage = async (content: string) => { 
    if (!user) return; 
    let receiverId = selectedTraineeId; 
    if (user.role === UserRole.TRAINEE) return; 
    if (receiverId) { 
        await db.sendMessage(user.id, receiverId, content); 
        await sendPushToUser(receiverId, 'New Message from Coach', content.slice(0, 80));
        refreshData(); 
    } 
  };
  const handleMarkRead = async (messageIds: string[]) => { await db.markMessagesAsRead(messageIds); refreshData(); };
  const unreadCount = messages.filter(m => m.receiverId === user?.id && !m.read).length;
  const handleRoleChange = async (userId: string, newRole: UserRole) => { const u = users.find(x => x.id === userId); if(u) { await db.updateUser({ ...u, role: newRole, coachId: (newRole === UserRole.COACH || newRole === UserRole.ADMIN) ? null : u.coachId }); refreshData(); } };
  const handleUpdatePoints = async (userId: string, points: number) => { const u = users.find(x => x.id === userId); if(u) { await db.updateUser({ ...u, points }); refreshData(); } };
  const handleDeleteUser = (userId: string) => { setDeleteUserConfirm(userId); };
  const confirmUserDelete = async () => { if (!deleteUserConfirm) return; const userId = deleteUserConfirm; setDeleteUserConfirm(null); try { await db.deleteUser(userId); refreshData(); } catch (e: any) { console.error("Delete user failed:", e); alert("Failed to delete user. " + (e.message || "Unknown error")); } }
  const handleAssignCoach = async (traineeId: string, coachId: string) => { const u = users.find(x => x.id === traineeId); if(u) { await db.updateUser({ ...u, coachId }); refreshData(); } };
  const handleTraineeClick = (traineeId: string) => { setSelectedTraineeId(traineeId); setView('TRAINEE_DETAILS'); setSelectedDate(null); }
  const handleEditProgram = async () => { setLoadingData(true); const plan = await db.getPlan(selectedTraineeId); setCurrentPlanExercises(plan ? plan.exerciseIds : []); setView('PLANNING'); setLoadingData(false); }
  const handleOpenInbox = (traineeId: string) => { setSelectedTraineeId(traineeId); setView('INBOX'); }
  const saveTraineePlan = async () => { if (!selectedTraineeId || !user) return; const plan: WorkoutPlan = { id: crypto.randomUUID(), coachId: user.id, traineeId: selectedTraineeId, exerciseIds: currentPlanExercises, lastUpdated: Date.now() }; await db.savePlan(plan); alert(t('program_saved')); setView('TRAINEE_DETAILS'); };
  const inviteTrainee = (traineeId: string) => { handleAssignCoach(traineeId, user!.id); };
  const markCompleted = async (sub: Submission, feedback: string, points: number) => { 
    if (!user) return; 
    const updated: Submission = { ...sub, status: 'COMPLETED', feedback, pointsAwarded: points }; 
    await db.updateSubmission(updated); 
    await db.updateUserPoints(sub.traineeId, points); 
    const exerciseNames = exercises.filter(e => sub.exerciseIds.includes(e.id)).map(e => t(e.name)).join(', '); 
    const msgContent = `${t('msg_auto_review_title')}\n${t('msg_exercises')} ${exerciseNames}\n${t('msg_submitted_at')} ${new Date(sub.timestamp).toLocaleString()}`; 
    await db.sendMessage(user.id, sub.traineeId, msgContent); 
    await sendPushToUser(sub.traineeId, 'Workout Reviewed! 🎉', 'Your coach has reviewed your submission.');
    refreshData(); 
  };
  
  // Replaces window.confirm with state-based modal
  const handleSubmissionVideoDelete = async (subId: string, vidId: string) => {
     setDeleteConfirm({ subId, vidId });
  }

  const confirmVideoDelete = async () => {
     if (!deleteConfirm) return;
     const { subId, vidId } = deleteConfirm;
     setDeleteConfirm(null);
     try {
         await db.deleteSubmissionVideo(subId, vidId);
         await refreshData();
     } catch (e: any) {
         console.error("Delete failed:", e);
         alert("Failed to delete video. " + (e.message || "Unknown error"));
     }
  }

  const handleEditSubmission = async (sub: Submission) => {
      setLoadingData(true);
      setRecordingExercises(sub.exerciseIds);
      setTraineeNote(sub.traineeNote || '');
      setEditingSubmissionId(sub.id);
      const mediaItems: typeof sessionMedia = [];
      const vids = sub.videoIds || []; 
      try {
          for (const vidId of vids) {
              if (vidId === 'DELETED') continue;
              const url = await getVideo(vidId);
              if (url) {
                  try {
                      const res = await fetch(url);
                      const blob = await res.blob();
                      mediaItems.push({ id: vidId, file: blob, type: 'video', preview: url, name: `Existing Video`, isExisting: true });
                  } catch (fetchErr) { console.error("Failed to fetch video for edit", fetchErr); }
              }
          }
      } catch (e) { console.error("Error loading existing videos for edit", e); }
      setSessionMedia(mediaItems);
      setView('SESSION_HUB');
      setLoadingData(false);
  }
  const toggleFeedback = (subId: string) => { if (expandedFeedback.includes(subId)) { setExpandedFeedback(prev => prev.filter(id => id !== subId)); } else { setExpandedFeedback(prev => [...prev, subId]); } }
  const handleAddRecordedVideo = (blob: Blob) => { const preview = URL.createObjectURL(blob); setSessionMedia([...sessionMedia, { id: crypto.randomUUID(), file: blob, type: 'video', preview, name: `Recorded Video ${sessionMedia.length + 1}`, isExisting: false }]); setView('SESSION_HUB'); }
  const handleUploadVideo = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) { const file = e.target.files[0]; const preview = URL.createObjectURL(file); setSessionMedia([...sessionMedia, { id: crypto.randomUUID(), file: file, type: 'video', preview, name: file.name, isExisting: false }]); } }
  const handleRemoveMedia = (id: string) => { setSessionMedia(sessionMedia.filter(m => m.id !== id)); }
  
  const handleFinishWorkout = async () => { 
    if (!user) return; 
    setLoadingData(true); 
    setIsUploading(true); 
    setUploadProgress(0); 
    progressMap.current = {}; 
    try { 
        const plan = await db.getPlan(user.id); 
        const newFiles = sessionMedia.filter(m => !m.isExisting); 
        const totalFiles = newFiles.length; 
        if (totalFiles === 0) setUploadProgress(100); 
        else setUploadProgress(0); 
        
        const videoProcessingPromises = sessionMedia.map(async (media) => { 
            if (media.isExisting) { 
                return media.id; 
            } else { 
                return await saveVideo(media.file, (percent) => { 
                    progressMap.current[media.id] = percent; 
                    const values = Object.values(progressMap.current) as number[];
                    const sum = values.reduce((a, b) => a + b, 0); 
                    const avg = totalFiles > 0 ? sum / totalFiles : 100; 
                    setUploadProgress(avg); 
                }); 
            } 
        }); 
        const savedVideoIds = await Promise.all(videoProcessingPromises); 
        setUploadProgress(100); 
        const subId = editingSubmissionId || crypto.randomUUID(); 
        const sub: Submission = { 
            id: subId, 
            planId: plan ? plan.id : 'free-workout', 
            traineeId: user.id, 
            exerciseIds: recordingExercises, 
            videoIds: savedVideoIds, 
            timestamp: editingSubmissionId ? Date.now() : Date.now(), 
            status: 'PENDING', 
            feedback: '', 
            traineeNote: traineeNote, 
            videosDeleted: false 
        }; 
        if (editingSubmissionId) { 
            await db.saveSubmission(sub); 
        } else { 
            await db.saveSubmission(sub); 
        } 
        if (user.coachId) { 
            const exerciseNames = exercises.filter(e => recordingExercises.includes(e.id)).map(e => t(e.name)).join(', '); 
            const msgContent = `${t('msg_auto_submission_title')}\n${t('msg_exercises')} ${exerciseNames}\n${t('msg_submitted_at')} ${new Date().toLocaleString()}`; 
            await db.sendMessage(user.id, user.coachId, msgContent); 
            await sendPushToUser(user.coachId, 'New Workout Submission', `${user.name} submitted a workout.`);
        } 
        await refreshData(); 
        setView('DASHBOARD'); 
        setRecordingExercises([]); 
        setSessionMedia([]); 
        setTraineeNote(''); 
        setEditingSubmissionId(null); 
    } catch (e: any) { 
        alert(`Error saving workout: ${e.message || "Unknown error"}`); 
        console.error(e); 
    } finally { 
        setLoadingData(false); 
        setUploadProgress(0); 
        setIsUploading(false); 
    } 
  };
  
  const generateAiExercises = async () => { if (!aiPrompt) return; setIsGenerating(true); const newExercises = await generateExerciseSuggestions(aiPrompt); for (const ex of newExercises) { await db.saveExercise(ex); } refreshData(); setIsGenerating(false); setAiPrompt(''); };

  const renderSubmissionsList = (subs: Submission[], showTraineeName = false) => {
      if (subs.length === 0) return <p className="text-gray-500 italic p-4 text-center text-sm">{t('no_submissions_found')}</p>;
      
      return subs.map(sub => {
        const trainee = users.find(u => u.id === sub.traineeId);
        const subExercises = exercises.filter(e => sub.exerciseIds.includes(e.id));
        const videoIds = sub.videoIds || []; // STRICT NEW FORMAT
        const isPending = sub.status === 'PENDING';
        const isCoach = user?.role === UserRole.COACH;
        const isAdmin = user?.role === UserRole.ADMIN;
        const isMe = user?.id === sub.traineeId;

        return (
            <div key={sub.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-3 transition">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        {showTraineeName && (
                             <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600 text-xs">{trainee?.name.charAt(0)}</div>
                        )}
                        <div>
                            {showTraineeName && <h4 className="font-bold text-gray-900 text-sm">{trainee?.name}</h4>}
                            <p className="text-xs text-gray-500">{new Date(sub.timestamp).toLocaleString()}</p>
                        </div>
                    </div>
                    {sub.pointsAwarded !== undefined && (
                        <Badge color="bg-amber-100 text-amber-800 flex items-center gap-1">
                            <Award size={10} /> {sub.pointsAwarded} pts
                        </Badge>
                    )}
                </div>
                
                <div className="mt-2 flex flex-wrap gap-1">
                    {subExercises.map(e => (
                        <span key={e.id} className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded border border-gray-200 flex items-center gap-1">
                            {getCategoryIcon(e.category)}
                            {t(e.name)}
                        </span>
                    ))}
                </div>
                
                {sub.traineeNote && (
                    <div className="mt-2 p-2 bg-indigo-50/50 rounded-lg border border-indigo-50 text-xs text-indigo-900 flex gap-2 items-start">
                        <FileText size={14} className="mt-0.5 shrink-0 text-indigo-400" />
                        <span className="italic">"{sub.traineeNote}"</span>
                    </div>
                )}

                <div className="mt-3 flex flex-wrap gap-4">
                     {videoIds.length > 0 ? videoIds.map((vid, idx) => {
                         if (vid === 'DELETED') {
                             return (
                                 <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-400 rounded text-xs border border-gray-200 flex items-center gap-1 cursor-default">
                                     <Trash2 size={12} /> {t('video_deleted')}
                                 </span>
                             );
                         }

                         return (
                             <div key={idx} className="flex items-center gap-2">
                                 <button onClick={() => playVideo(vid)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 text-xs font-bold transition border border-indigo-100 shadow-sm">
                                     <Play size={14} /> {videoIds.length > 1 ? `${t('video_label')} ${idx+1}` : t('watch')}
                                 </button>
                                 {(isMe || isAdmin) && (
                                     <button 
                                        onClick={(e) => { 
                                            e.stopPropagation(); 
                                            handleSubmissionVideoDelete(sub.id, vid); 
                                        }}
                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition group"
                                        title={t('remove')}
                                    >
                                        <Trash2 size={16} className="group-hover:scale-110 transition-transform" />
                                    </button>
                                 )}
                             </div>
                         );
                     }) : (
                         <span className="text-xs text-gray-400 italic flex items-center gap-1">
                             <AlertTriangle size={12} /> {t('video_deleted')}
                         </span>
                     )}
                </div>
                
                {isMe && isPending && (
                    <div className="mt-3 pt-2 border-t border-gray-100">
                        <button onClick={() => handleEditSubmission(sub)} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"><Edit size={14} /> {t('edit')}</button>
                    </div>
                )}

                {isCoach && isPending && (
                    <div className="mt-4 pt-3 border-t border-gray-100 space-y-3">
                         <textarea id={`feedback-${sub.id}`} className="w-full text-sm px-3 py-2 border rounded-lg bg-gray-50 focus:bg-white outline-none min-h-[80px]" placeholder={t('feedback_placeholder')} defaultValue={sub.feedback} />
                         <div className="flex justify-between items-center gap-2">
                             <div className="flex items-center gap-2"><span className="text-xs font-bold text-gray-500">{t('points_label')}</span><input type="number" id={`points-${sub.id}`} defaultValue={sub.exerciseIds.length} className="w-16 px-2 py-1 text-sm border rounded text-center font-bold" min="0" /></div>
                            <Button variant="primary" className="text-xs px-4 py-2 h-auto" onClick={() => { const fbVal = (document.getElementById(`feedback-${sub.id}`) as HTMLTextAreaElement).value; const ptsVal = parseInt((document.getElementById(`points-${sub.id}`) as HTMLInputElement).value) || 0; markCompleted(sub, fbVal, ptsVal); }}>{t('approve')}</Button>
                         </div>
                    </div>
                )}
                
                {!isPending && sub.feedback && (
                    <div className="mt-3">
                        {(isMe || isCoach || isAdmin) && (
                            <div>
                                <button onClick={() => toggleFeedback(sub.id)} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                                    {expandedFeedback.includes(sub.id) ? ( <><ChevronUp size={14} /> {t('hide_feedback')}</> ) : ( <><ChevronDown size={14} /> {t('view_feedback')}</> )}
                                </button>
                                {expandedFeedback.includes(sub.id) && (
                                    <div className="mt-2 p-3 bg-green-50 rounded-lg border border-green-100 text-sm text-gray-800 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="flex items-start gap-2"><CheckCircle size={16} className="mt-0.5 text-green-600 shrink-0" /><p className="whitespace-pre-wrap">{sub.feedback}</p></div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
      })
  }

  // --- Auth Loading Screen ---
  if (authLoading) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
              <div className="relative mb-4">
                 <div className="w-16 h-16 bg-indigo-100 rounded-full animate-ping absolute inset-0 opacity-75"></div>
                 <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center relative z-10 shadow-lg">
                    <Dumbbell className="text-white w-8 h-8" />
                 </div>
              </div>
              <h2 className="text-lg font-bold text-indigo-900">{t('app_name')}</h2>
              <p className="text-sm text-gray-500 mt-2 flex items-center gap-2">
                  <Loader2 className="animate-spin text-indigo-500" size={14} />
                  {t('syncing_data')}
              </p>
          </div>
      );
  }

  if (!user) return <AuthScreen onLogin={setUser} t={t} lang={lang} setLang={setLang} />;
  const ChevronNext = lang === 'he' ? ChevronLeft : ChevronRight;
  const ChevronPrev = lang === 'he' ? ChevronRight : ChevronLeft;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900 pb-16" dir={lang === 'he' ? 'rtl' : 'ltr'}>
        {/* ... Header remains largely unchanged ... */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
            <div className="max-w-5xl mx-auto px-4 h-16 flex justify-between items-center">
            <div className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition" onClick={handleHomeView}>
                <img 
                    src="https://cdn-icons-png.flaticon.com/512/2964/2964514.png"
                    alt="FitTrack Pro"
                    className="w-12 h-12 rounded-xl object-cover"
                />
            <div className="flex flex-col justify-center leading-none">
                <h1 className="text-base font-bold text-slate-900 leading-tight">{t('app_name')}</h1>
                <span className="text-[10px] text-gray-400 font-medium tracking-widest uppercase mt-0.5">
                    {user.role === UserRole.ADMIN ? t('role_admin') : user.role === UserRole.COACH ? t('role_coach') : t('role_trainee')}
                </span>
            </div>
        </div>
                <div className="flex items-center gap-3">
                     <button onClick={() => setView('LEADERBOARD')} className={`p-2 rounded hover:bg-gray-100 text-gray-600 ${view === 'LEADERBOARD' ? 'text-indigo-600 bg-indigo-50' : ''}`} title={t('leaderboard')}><Trophy size={20} /></button>
                    <button onClick={handleHomeView} className={`p-2 rounded hover:bg-gray-100 text-gray-600 ${ (user.role === UserRole.ADMIN && view === 'ADMIN') || (user.role !== UserRole.ADMIN && view === 'DASHBOARD') ? 'text-indigo-600 bg-indigo-50' : ''}`} title={t('home')}><Home size={20} /></button>
                    {(user.role === UserRole.TRAINEE || user.role === UserRole.COACH) && (
                        <button onClick={() => { setView('INBOX'); setSelectedTraineeId(''); }} className={`relative p-2 rounded hover:bg-gray-100 text-gray-600 ${view === 'INBOX' ? 'text-indigo-600 bg-indigo-50' : ''}`}>
                             <MessageSquare size={20} />
                             {unreadCount > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white"></span>}
                        </button>
                    )}
                    {user.role === UserRole.TRAINEE && <div className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"><Award size={14} /> {user.points}</div>}
                    <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-500 transition"><LogOut size={20} /></button>
                </div>
            </div>
        </header>

        {playbackUrl && (
            <div className="fixed inset-0 z-50 bg-slate-500/50 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="w-full max-w-2xl bg-white rounded-2xl overflow-hidden relative shadow-2xl border border-slate-200">
                    <button onClick={() => setPlaybackUrl(null)} className="absolute top-4 right-4 rtl:left-4 rtl:right-auto text-slate-600 hover:text-slate-900 bg-white/50 hover:bg-white p-2 rounded-full z-10 transition">✕</button>
                    <div className="p-1 bg-slate-100"><video src={playbackUrl} controls autoPlay className="w-full max-h-[80vh] bg-slate-300 rounded-lg" /></div>
                </div>
            </div>
        )}

        {deleteConfirm && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 w-full max-w-sm text-center">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Trash2 className="text-red-500" size={22} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{t('delete_video_title')}</h3>
                    <p className="text-sm text-gray-500 mb-6">{t('delete_video_warning')}</p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setDeleteConfirm(null)}
                            className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-gray-700 font-bold hover:bg-gray-50 transition"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            onClick={confirmVideoDelete}
                            className="flex-1 px-4 py-2 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition shadow-md"
                        >
                            {t('delete_action')}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {deleteUserConfirm && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 w-full max-w-sm text-center">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Trash2 className="text-red-500" size={22} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{t('delete_user_title')}</h3>
                    <p className="text-sm text-gray-500 mb-6">{t('delete_user_warning')}</p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setDeleteUserConfirm(null)}
                            className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-gray-700 font-bold hover:bg-gray-50 transition"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            onClick={confirmUserDelete}
                            className="flex-1 px-4 py-2 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition shadow-md"
                        >
                            {t('delete_action')}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {loadingData && (
             <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                 <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm text-center space-y-6 animate-in fade-in zoom-in duration-300">
                     {isUploading ? (
                         <>
                             <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                    <circle className="text-gray-100" stroke="currentColor" strokeWidth="8" fill="transparent" r="40" cx="50" cy="50" />
                                    <circle 
                                        className="text-indigo-600 transition-all duration-300 ease-out" 
                                        stroke="currentColor" 
                                        strokeWidth="8" 
                                        strokeLinecap="round" 
                                        fill="transparent" 
                                        r="40" 
                                        cx="50" 
                                        cy="50" 
                                        strokeDasharray="251.2" 
                                        strokeDashoffset={251.2 - (251.2 * uploadProgress) / 100} 
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-indigo-900">
                                    {uploadProgress < 100 ? `${Math.round(uploadProgress)}%` : <CheckCircle size={32} className="text-green-500 animate-in zoom-in duration-300" />}
                                </div>
                             </div>
                             
                             <div className="space-y-2">
                                 <h3 className="font-bold text-gray-900 text-xl">
                                    {uploadProgress < 100 ? t('uploading_videos') : t('finishing_up')}
                                 </h3>
                                 <p className="text-sm text-gray-500">
                                     {uploadProgress < 100 ? t('please_wait') : t('finishing_up')}
                                 </p>
                             </div>
                         </>
                     ) : (
                         <div className="flex flex-col items-center justify-center py-2">
                             <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
                             <h3 className="font-bold text-gray-900 text-xl">{t('syncing_data')}</h3>
                         </div>
                     )}
                 </div>
             </div>
        )}

        <main className="flex-1 max-w-5xl mx-auto w-full p-4 md:p-6 space-y-6">
            {/* View Switching Logic... (Same as before but wrapped for brevity) */}
            {view === 'LEADERBOARD' && <Leaderboard users={users} currentUser={user} t={t} />}
            {(view === 'ADMIN' || (view === 'DASHBOARD' && user.role === UserRole.ADMIN)) && user.role === UserRole.ADMIN && (
                <div className="space-y-6">
                    <h2 className="text-2xl font-bold flex items-center gap-2">{t('system_admin')}</h2>
                    <div className="flex gap-2">
                        <button onClick={() => setAdminView('USERS')} className={`px-4 py-2 rounded-lg font-bold text-sm transition flex items-center gap-2 ${adminView === 'USERS' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}><Users size={16} /> {t('manage_users')}</button>
                         <button onClick={() => setAdminView('SUBMISSIONS')} className={`px-4 py-2 rounded-lg font-bold text-sm transition flex items-center gap-2 ${adminView === 'SUBMISSIONS' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}><List size={16} /> {t('all_submissions')}</button>
                    </div>
                    {adminView === 'USERS' && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50"><h3 className="font-semibold text-gray-700">{t('user_management')}</h3></div>
                            <div className="divide-y divide-gray-100">
                                {users.filter(u => u.id !== user.id).map(u => (
                                    <div key={u.id} className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                        <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${u.role === UserRole.COACH ? 'bg-purple-100 text-purple-600' : u.role === UserRole.ADMIN ? 'bg-gray-800 text-white' : 'bg-green-100 text-green-600'}`}>{u.name.charAt(0)}</div><div><p className="font-medium text-gray-900">{u.name}</p><p className="text-xs text-gray-500">{u.email}</p></div></div>
                                        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto items-center">
                                            {u.role === UserRole.TRAINEE && (<div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded border border-gray-200"><Trophy size={14} className="text-amber-500"/><input type="number" className="w-16 bg-transparent outline-none text-sm font-bold text-center" defaultValue={u.points} onBlur={(e) => handleUpdatePoints(u.id, parseInt(e.target.value) || 0)} /><span className="text-[10px] text-gray-400">pts</span></div>)}
                                            <select value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)} className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white focus:ring-2 focus:ring-indigo-100 outline-none"><option value={UserRole.TRAINEE}>{t('role_trainee')}</option><option value={UserRole.COACH}>{t('role_coach')}</option><option value={UserRole.ADMIN}>{t('role_admin')}</option></select>
                                            <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition" title="Delete User"><Trash2 size={18} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {adminView === 'SUBMISSIONS' && <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">{renderSubmissionsList(submissions.sort((a,b) => b.timestamp - a.timestamp), true)}</div>}
                </div>
            )}

            {/* ... Other Views ... */}
            {view === 'INBOX' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between max-w-3xl mx-auto">
                        <h2 className="text-xl font-bold flex items-center gap-2"><Mail className="text-indigo-600" /> {t('inbox')}</h2>
                        {/* Only show back button if we are in coach role AND have a specific trainee selected (Chat Mode) */}
                        {user.role === UserRole.COACH && selectedTraineeId && (
                            <button onClick={() => setSelectedTraineeId('')} className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1">
                                <ChevronPrev size={16} /> {t('conversations')}
                            </button>
                        )}
                    </div>
                    <InboxView 
                        currentUser={user} 
                        users={users} 
                        otherUser={user.role === UserRole.COACH ? users.find(u => u.id === selectedTraineeId) : users.find(u => u.id === user.coachId)} 
                        messages={messages.filter(m => 
                            user.role === UserRole.TRAINEE 
                            ? (m.receiverId === user.id || m.senderId === user.id) 
                            : (selectedTraineeId 
                                ? (m.senderId === user.id && m.receiverId === selectedTraineeId) || (m.senderId === selectedTraineeId && m.receiverId === user.id)
                                : true // Pass all messages to inbox view if no trainee selected
                            )
                        )} 
                        onSendMessage={user.role === UserRole.COACH ? handleSendMessage : undefined} 
                        onMarkRead={handleMarkRead} 
                        onSelectUser={(id) => setSelectedTraineeId(id)}
                        t={t} 
                    />
                </div>
            )}
            
            {/* Dashboard Coach */}
            {view === 'DASHBOARD' && user.role === UserRole.COACH && (
                <div className="max-w-3xl mx-auto space-y-6">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"><h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2"><Users className="text-indigo-600" /> {t('my_trainees')}</h3><div className="space-y-3">{users.filter(u => u.coachId === user.id).map(trainee => (<div key={trainee.id} onClick={() => handleTraineeClick(trainee.id)} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 hover:bg-indigo-50 transition border border-gray-100 hover:border-indigo-200 group cursor-pointer shadow-sm hover:shadow-md" ><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-full bg-white text-indigo-600 flex items-center justify-center font-bold text-lg shadow-sm">{trainee.name.charAt(0)}</div><div><p className="font-bold text-gray-900 text-lg">{trainee.name}</p><p className="text-xs text-gray-500">{submissions.filter(s => s.traineeId === trainee.id && s.status === 'PENDING').length} {t('reviews_pending_label')} • {trainee.points} pts</p></div></div><ChevronNext size={24} className="text-gray-300 group-hover:text-indigo-500" /></div>))}{users.filter(u => u.coachId === user.id).length === 0 && <p className="text-gray-500 italic text-center py-8">{t('no_trainees')}</p>}</div></div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"><h3 className="font-bold text-gray-800 mb-4 text-lg flex items-center gap-2"><UserPlus size={20} className="text-gray-400"/> {t('recruit_trainees')}</h3><div className="space-y-3">{users.filter(u => u.role === UserRole.TRAINEE && !u.coachId).map(trainee => (<div key={trainee.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100"><span className="font-medium text-gray-700">{trainee.name}</span><button onClick={() => inviteTrainee(trainee.id)} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 font-bold transition shadow-sm shadow-indigo-200">{t('add')}</button></div>))}{users.filter(u => u.role === UserRole.TRAINEE && !u.coachId).length === 0 && <p className="text-sm text-gray-400 text-center py-4">{t('no_unassigned')}</p>}</div></div>
                </div>
            )}
            
            {/* Trainee Details View */}
            {view === 'TRAINEE_DETAILS' && user.role === UserRole.COACH && (
                <div className="space-y-6">
                     <div className="flex items-center justify-between"><button onClick={() => setView('DASHBOARD')} className="text-gray-500 hover:text-gray-800 flex items-center gap-1 text-sm font-medium"><ChevronPrev size={16} /> {t('back_dashboard')}</button></div>
                     <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-4"><div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-2xl">{users.find(u => u.id === selectedTraineeId)?.name.charAt(0)}</div><div><h2 className="text-2xl font-bold text-gray-900">{users.find(u => u.id === selectedTraineeId)?.name}</h2><p className="text-gray-500 text-sm flex items-center gap-1"><Trophy size={14}/> {users.find(u => u.id === selectedTraineeId)?.points} {t('points_lowercase')}</p></div></div>
                        <div className="flex gap-2"><Button onClick={() => handleOpenInbox(selectedTraineeId)} variant="primary"><MessageSquare size={16} /> {t('send_message')}</Button><Button onClick={handleEditProgram} variant="secondary"><Edit size={16} /> {t('edit_program')}</Button></div>
                     </div>
                     <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-1 space-y-4"><div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"><div className="bg-yellow-50 p-4 border-b border-yellow-100 flex items-center gap-2"><Activity size={18} className="text-yellow-600"/><h3 className="font-bold text-yellow-800">{t('pending_reviews')}</h3></div><div className="p-2 max-h-[500px] overflow-y-auto">{renderSubmissionsList(submissions.filter(s => s.traineeId === selectedTraineeId && s.status === 'PENDING').sort((a,b) => b.timestamp - a.timestamp))}{submissions.filter(s => s.traineeId === selectedTraineeId && s.status === 'PENDING').length === 0 && (<p className="text-sm text-gray-400 text-center py-6">{t('no_pending_reviews')}</p>)}</div></div></div>
                        <div className="lg:col-span-2 space-y-6"><div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"><h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><CalendarIcon size={18}/> {t('completed_workouts')}</h3><WorkoutCalendar submissions={submissions.filter(s => s.traineeId === selectedTraineeId)} onDateSelect={setSelectedDate} t={t} /></div>{selectedDate && (<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 animate-in fade-in slide-in-from-top-4 duration-300"><h4 className="font-bold text-gray-800 mb-3 text-sm flex justify-between items-center"><span>{t('workouts_on')} {selectedDate.toLocaleDateString()}</span><button onClick={() => setSelectedDate(null)} className="text-xs text-gray-400 hover:text-gray-600">{t('close')}</button></h4><div className="space-y-2">{(() => { const startOfDay = selectedDate.setHours(0,0,0,0); const endOfDay = selectedDate.setHours(23,59,59,999); const subs = submissions.filter(s => s.traineeId === selectedTraineeId && s.timestamp >= startOfDay && s.timestamp <= endOfDay); if (subs.length === 0) return <p className="text-sm text-gray-500 italic">{t('no_workouts_on_day')}</p>; return renderSubmissionsList(subs); })()}</div></div>)}{!selectedDate && <div className="text-center text-sm text-gray-400 py-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">{t('click_date_details')}</div>}</div>
                     </div>
                </div>
            )}
            
            {/* Planning View, Dashboard Trainee, Session Hub, Record, History... (No functional changes in logic, just rendering) */}
            {view === 'PLANNING' && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between"><button onClick={() => setView('TRAINEE_DETAILS')} className="text-gray-500 hover:text-gray-800 flex items-center gap-1 text-sm font-medium"><ChevronPrev size={16} /> {t('back_profile')}</button><div className="flex items-center gap-2"><span className="text-sm text-gray-500">{t('editing_program')}</span><span className="font-bold text-lg bg-white px-3 py-1 rounded shadow-sm">{users.find(u => u.id === selectedTraineeId)?.name}</span></div></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[calc(100vh-200px)]">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden"><div className="p-4 border-b border-gray-100 bg-gray-50"><h3 className="font-bold text-gray-700 mb-2">{t('exercise_library')}</h3><div className="flex gap-2"><input className="flex-1 px-3 py-2 text-sm border rounded-lg" placeholder={t('ai_search_placeholder')} value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} /><button onClick={generateAiExercises} disabled={isGenerating || !aiPrompt} className="bg-purple-100 text-purple-700 px-3 py-2 rounded-lg text-xs font-bold hover:bg-purple-200 disabled:opacity-50">{isGenerating ? 'AI...' : <Sparkles size={16}/>}</button></div></div><div className="flex-1 overflow-y-auto p-2 space-y-1">{exercises.map(ex => (<div key={ex.id} className="group flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-100 transition"><div className="flex items-center gap-3"><div className="text-indigo-400 bg-indigo-50 p-2 rounded-lg">{getCategoryIcon(ex.category)}</div><div><p className="font-medium text-sm">{t(ex.name)}</p><p className="text-[10px] text-gray-500 uppercase tracking-wide">{t(ex.category)}</p></div></div><button onClick={() => !currentPlanExercises.includes(ex.id) && setCurrentPlanExercises([...currentPlanExercises, ex.id])} disabled={currentPlanExercises.includes(ex.id)} className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-md disabled:text-gray-300"><PlusCircle size={20} /></button></div>))}</div></div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden"><div className="p-4 border-b border-gray-100 bg-indigo-50/50 flex justify-between items-center"><h3 className="font-bold text-indigo-900">{t('current_program')}</h3><span className="text-xs font-medium text-indigo-600">{currentPlanExercises.length} {t('exercises_count')}</span></div><div className="flex-1 overflow-y-auto p-2 space-y-1 bg-gray-50/30">{currentPlanExercises.length === 0 && (<div className="h-full flex flex-col items-center justify-center text-gray-400"><div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-2"><Dumbbell className="opacity-50"/></div><p className="text-sm">{t('no_exercises_assigned')}</p></div>)}{currentPlanExercises.map((id, index) => { const ex = exercises.find(e => e.id === id); if(!ex) return null; return (<div key={id} className="flex justify-between items-center p-3 bg-white shadow-sm rounded-lg border border-gray-100"><div className="flex items-center gap-3"><span className="text-xs font-bold text-gray-300 w-4">{index + 1}</span><div className="flex items-center gap-2"><div className="text-indigo-400">{getCategoryIcon(ex.category)}</div><div><p className="font-medium text-sm text-gray-900">{t(ex.name)}</p><p className="text-xs text-gray-500 truncate max-w-[150px]">{ex.description}</p></div></div></div><button onClick={() => setCurrentPlanExercises(currentPlanExercises.filter(x => x !== id))} className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded"><Trash2 size={16} /></button></div>); })}</div><div className="p-4 border-t border-gray-100 bg-white"><Button className="w-full" onClick={saveTraineePlan}>{t('save_program')}</Button></div></div>
                    </div>
                </div>
            )}
            
            {view === 'DASHBOARD' && user.role === UserRole.TRAINEE && (
                <div className="space-y-6">
                    <div className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white rounded-2xl p-6 shadow-xl shadow-indigo-200"><h2 className="text-2xl font-bold mb-2">{t('my_workout_plan')}</h2><PlanDisplay userId={user.id} exercises={exercises} onStartSession={(ids) => { setRecordingExercises(ids); setView('SESSION_HUB'); }} t={t} users={users} /></div>
                    <div className="space-y-6"><div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"><h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><CalendarIcon size={18}/> {t('completed_workouts')}</h3><WorkoutCalendar submissions={submissions.filter(s => s.traineeId === user.id)} onDateSelect={setSelectedDate} t={t} /></div>{selectedDate && (<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 animate-in fade-in slide-in-from-top-4 duration-300"><h4 className="font-bold text-gray-800 mb-3 text-sm flex justify-between items-center"><span>{t('workouts_on')} {selectedDate.toLocaleDateString()}</span><button onClick={() => setSelectedDate(null)} className="text-xs text-gray-400 hover:text-gray-600">{t('close')}</button></h4><div className="space-y-2">{(() => { const startOfDay = selectedDate.setHours(0,0,0,0); const endOfDay = selectedDate.setHours(23,59,59,999); const subs = submissions.filter(s => s.traineeId === user.id && s.timestamp >= startOfDay && s.timestamp <= endOfDay); if (subs.length === 0) return <p className="text-sm text-gray-500 italic">{t('no_workouts_on_day')}</p>; return renderSubmissionsList(subs); })()}</div></div>)}</div>
                </div>
            )}
            
            {view === 'SESSION_HUB' && (
                <div className="max-w-2xl mx-auto space-y-6">
                    <div className="flex items-center gap-2"><button onClick={() => { setSessionMedia([]); setView('DASHBOARD'); }} className="text-sm font-bold text-gray-500 hover:text-gray-900">{t('cancel')}</button><span className="text-gray-300">|</span><h2 className="text-lg font-bold">{editingSubmissionId ? t('edit_workout_session') : t('new_workout_session')}</h2></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200"><h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">{t('selected_for_session')}</h3><div className="flex flex-wrap gap-2">{exercises.filter(e => recordingExercises.includes(e.id)).map(e => (<span key={e.id} className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium border border-indigo-100 flex items-center gap-2">{getCategoryIcon(e.category)}{t(e.name)}</span>))}</div></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-4">
                        <div className="flex justify-between items-center"><h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t('session_media')}</h3><Badge color="bg-indigo-100 text-indigo-700">{sessionMedia.length} {t('videos_count')}</Badge></div>
                        {sessionMedia.length === 0 ? (<div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-xl bg-gray-50"><Film className="mx-auto text-gray-300 mb-2" size={32} /><p className="text-sm text-gray-400">{t('no_media_yet')}</p></div>) : (<div className="grid grid-cols-2 gap-3">{sessionMedia.map(media => (<div key={media.id} className="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-50"><video src={media.preview} className="w-full h-32 object-cover" /><div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2"><button onClick={() => setPlaybackUrl(media.preview)} className="p-2 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-sm"><Play size={20}/></button><button onClick={() => handleRemoveMedia(media.id)} className="p-2 bg-red-500/80 hover:bg-red-600 rounded-full text-white backdrop-blur-sm"><Trash2 size={20}/></button></div><div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-white text-xs truncate">{media.name}{media.isExisting && <span className="block text-[9px] text-gray-300 italic">(Existing)</span>}</div></div>))}</div>)}
                        <div className="grid grid-cols-2 gap-4 pt-2"><Button variant="secondary" onClick={() => setView('RECORD')} className="h-12 border-dashed border-2"><Camera size={20} className="text-indigo-600" /> {t('record_video')}</Button><Button variant="secondary" onClick={() => fileInputRef.current?.click()} className="h-12 border-dashed border-2"><Upload size={20} className="text-indigo-600" /> {t('upload_video')}</Button><input type="file" ref={fileInputRef} className="hidden" accept="video/*" onChange={handleUploadVideo} /></div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200"><textarea className="w-full text-sm p-3 border rounded-lg focus:ring-2 focus:ring-indigo-100 outline-none resize-none h-24" placeholder={t('add_notes')} value={traineeNote} onChange={(e) => setTraineeNote(e.target.value)} /></div>
                    <Button className="w-full h-14 text-lg shadow-xl shadow-indigo-200" onClick={handleFinishWorkout} disabled={sessionMedia.length === 0}>{editingSubmissionId ? t('update_workout') : t('finish_workout')}</Button>
                </div>
            )}
            
            {view === 'RECORD' && (<div className="max-w-2xl mx-auto space-y-4"><div className="flex items-center gap-2 mb-2"><button onClick={() => setView('SESSION_HUB')} className="text-sm font-bold text-gray-500 hover:text-gray-900">{t('cancel')}</button><span className="text-gray-300">|</span><h2 className="text-lg font-bold">{t('session_recording')}</h2></div><VideoRecorder onSave={handleAddRecordedVideo} onCancel={() => setView('SESSION_HUB')} labels={{ ready: t('ready'), rec: t('rec'), retake: t('retake'), save: t('save_clip'), cancel: t('cancel'), error: t('camera_error') }} /></div>)}
            
            {view === 'HISTORY' && (
                <div className="space-y-6">
                    <div className="flex items-center gap-4"><Button onClick={() => setView('DASHBOARD')} variant="secondary" className="px-3 py-1.5 text-sm"><ChevronPrev size={16} /> {t('back')}</Button><h2 className="text-2xl font-bold">{t('workout_history')}</h2></div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm text-left rtl:text-right"><thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200"><tr><th className="px-6 py-4">{t('col_date')}</th>{user.role === UserRole.COACH && <th className="px-6 py-4">{t('col_trainee')}</th>}<th className="px-6 py-4">{t('col_exercises')}</th><th className="px-6 py-4">{t('col_status')}</th><th className="px-6 py-4">{t('col_feedback')}</th></tr></thead><tbody className="divide-y divide-gray-100">{submissions.filter(s => user.role === UserRole.COACH ? true : s.traineeId === user.id).sort((a,b) => b.timestamp - a.timestamp).map(sub => (<tr key={sub.id} className="hover:bg-gray-50 transition"><td className="px-6 py-4 whitespace-nowrap text-gray-500">{new Date(sub.timestamp).toLocaleDateString()} <span className="text-xs text-gray-400">{new Date(sub.timestamp).toLocaleTimeString()}</span></td>{user.role === UserRole.COACH && (<td className="px-6 py-4 font-medium text-gray-900">{users.find(u => u.id === sub.traineeId)?.name}</td>)}<td className="px-6 py-4 text-gray-900 max-w-xs truncate">{exercises.filter(e => sub.exerciseIds.includes(e.id)).map(e => t(e.name)).join(', ')}</td><td className="px-6 py-4"><Badge color={sub.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>{sub.status}</Badge></td><td className="px-6 py-4 text-gray-500 italic max-w-xs truncate">{sub.feedback || '-'}</td></tr>))}</tbody></table></div></div>
                </div>
            )}
        </main>
        {/* Bottom Language Switcher Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-t border-gray-100 z-20 flex justify-center py-2 px-4">
            <button
                onClick={() => setLang(lang === 'en' ? 'he' : 'en')}
                className="flex items-center gap-2 px-4 py-1.5 rounded-full hover:bg-gray-100 text-indigo-600 text-sm font-semibold transition"
            >
                <Globe size={15} />
                {lang === 'en' ? 'עברית' : 'English'}
            </button>
        </div>
    </div>
  );
}

export default App;
