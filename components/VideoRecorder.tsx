import React, { useRef, useState, useEffect } from 'react';
import { Camera, StopCircle, RotateCcw, Save, SwitchCamera } from 'lucide-react';

interface VideoRecorderProps {
    onSave: (blob: Blob) => void;
    onCancel: () => void;
    labels: {
        ready: string;
        rec: string;
        retake: string;
        save: string;
        cancel: string;
        error: string;
    };
}

const VideoRecorder: React.FC<VideoRecorderProps> = ({ onSave, onCancel, labels }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null); // always up-to-date, no stale closure issue

    const [isRecording, setIsRecording] = useState(false);
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
    const [error, setError] = useState<string>('');
    const [timer, setTimer] = useState(0);
    const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
    const [isFlipping, setIsFlipping] = useState(false);

    useEffect(() => {
        startCamera('environment');
        return () => { stopCurrentStream(); };
    }, []);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (isRecording) {
            interval = setInterval(() => setTimer(t => t + 1), 1000);
        } else {
            setTimer(0);
        }
        return () => clearInterval(interval);
    }, [isRecording]);

    const stopCurrentStream = () => {
        // Always reads from ref — never stale
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    };

    const startCamera = async (facing: 'environment' | 'user') => {
        setError('');
        try {
            // Stop existing stream first via ref (always current)
            stopCurrentStream();

            // Give Android a moment to fully release the camera hardware
            await new Promise(res => setTimeout(res, 300));

            const s = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: facing } },
                audio: true,
            });

            streamRef.current = s; // update ref immediately
            setFacingMode(facing);

            if (videoRef.current) {
                videoRef.current.srcObject = s;
                videoRef.current.src = '';
                videoRef.current.controls = false;
            }
        } catch (err) {
            console.error('Camera error:', err);
            setError(labels.error);
        }
    };

    const handleFlipCamera = async () => {
        if (isRecording || isFlipping) return;
        setIsFlipping(true);
        const next = facingMode === 'environment' ? 'user' : 'environment';
        await startCamera(next);
        setIsFlipping(false);
    };

    const handleStartRecording = () => {
        if (!streamRef.current) return;
        chunksRef.current = [];
        const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
        const recorder = new MediaRecorder(streamRef.current, { mimeType });

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: mimeType });
            setRecordedBlob(blob);
            if (videoRef.current) {
                videoRef.current.srcObject = null;
                videoRef.current.src = URL.createObjectURL(blob);
                videoRef.current.controls = true;
                videoRef.current.loop = true;
                videoRef.current.play();
            }
        };

        recorder.start();
        setIsRecording(true);
        mediaRecorderRef.current = recorder;
    };

    const handleStopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const handleRetake = () => {
        setRecordedBlob(null);
        if (videoRef.current) {
            videoRef.current.src = '';
            videoRef.current.controls = false;
            videoRef.current.srcObject = streamRef.current;
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const videoMirror = !recordedBlob && facingMode === 'user' ? 'scale-x-[-1]' : '';

    return (
        <div className="flex flex-col items-center bg-slate-200 rounded-2xl overflow-hidden relative shadow-lg border border-slate-300">
            <video
                ref={videoRef}
                autoPlay
                muted={!recordedBlob}
                playsInline
                className={`w-full h-96 object-cover bg-slate-300 ${videoMirror}`}
            />

            {/* Flip camera button */}
            {!recordedBlob && (
                <button
                    onClick={handleFlipCamera}
                    disabled={isRecording || isFlipping}
                    className="absolute top-4 left-4 bg-white/80 backdrop-blur-sm p-2 rounded-full shadow-sm text-slate-700 hover:bg-white disabled:opacity-30 transition"
                    title="Flip camera"
                >
                    {isFlipping
                        ? <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                        : <SwitchCamera size={20} />}
                </button>
            )}

            <div className="w-full bg-slate-100 p-4 flex justify-around items-center border-t border-slate-200">
                {!recordedBlob ? (
                    !isRecording ? (
                        <button
                            onClick={handleStartRecording}
                            className="w-16 h-16 rounded-full border-4 border-slate-200 flex items-center justify-center bg-red-500 hover:bg-red-600 transition shadow-md hover:scale-105"
                        >
                            <Camera className="text-white w-8 h-8" />
                        </button>
                    ) : (
                        <button
                            onClick={handleStopRecording}
                            className="w-16 h-16 rounded-full border-4 border-slate-200 flex items-center justify-center bg-slate-800 hover:bg-slate-700 transition shadow-md hover:scale-105"
                        >
                            <StopCircle className="text-red-500 w-10 h-10" />
                        </button>
                    )
                ) : (
                    <div className="flex w-full justify-between px-8">
                        <button
                            onClick={handleRetake}
                            className="flex flex-col items-center text-slate-500 hover:text-slate-800 transition"
                        >
                            <RotateCcw className="mb-1 w-6 h-6" />
                            <span className="text-xs font-medium">{labels.retake}</span>
                        </button>
                        <button
                            onClick={() => onSave(recordedBlob)}
                            className="flex flex-col items-center text-indigo-600 hover:text-indigo-500 transition"
                        >
                            <Save className="mb-1 w-8 h-8" />
                            <span className="text-xs font-bold">{labels.save}</span>
                        </button>
                    </div>
                )}
            </div>

            <button
                onClick={onCancel}
                className="absolute bottom-20 right-4 text-slate-600 hover:text-slate-900 text-xs bg-white/80 px-3 py-1.5 rounded-full font-bold shadow-sm backdrop-blur-sm"
            >
                {labels.cancel}
            </button>

            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 gap-4 p-6 text-center">
                    <Camera className="text-slate-400 w-12 h-12" />
                    <p className="text-white font-semibold">{error}</p>
                    <button
                        onClick={() => startCamera(facingMode)}
                        className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-500 transition"
                    >
                        Try Again
                    </button>
                    <button onClick={onCancel} className="text-slate-400 text-xs underline">Cancel</button>
                </div>
            )}
        </div>
    );
};

export default VideoRecorder;