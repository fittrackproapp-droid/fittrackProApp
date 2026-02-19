import React, { useRef, useState, useEffect } from 'react';
import { Camera, StopCircle, RotateCcw, Save } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Camera as CapCamera } from '@capacitor/camera';

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

    const [isRecording, setIsRecording] = useState(false);
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
    const [error, setError] = useState<string>('');
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [timer, setTimer] = useState(0);

    useEffect(() => {
        startCamera();
        return () => { stopCamera(); };
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

    const startCamera = async () => {
        try {
            // On native Android, ask Capacitor for camera + mic permissions first,
            // then fall through to getUserMedia which works fine in Capacitor's WebView.
            if (Capacitor.isNativePlatform()) {
                // @capacitor/camera only manages 'camera' and 'photos' permissions.
                // Microphone permission is requested automatically by getUserMedia below.
                const perms = await CapCamera.requestPermissions({ permissions: ['camera'] });
                if (perms.camera === 'denied') {
                    setError(labels.error);
                    return;
                }
            }

            const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setStream(s);
            if (videoRef.current) {
                videoRef.current.srcObject = s;
            }
        } catch {
            setError(labels.error);
        }
    };

    const stopCamera = () => {
        stream?.getTracks().forEach(track => track.stop());
        setStream(null);
    };

    const handleStartRecording = () => {
        if (!stream) return;
        chunksRef.current = [];

        // video/mp4 is preferred on Android; fall back to webm for desktop browsers
        const mimeType = MediaRecorder.isTypeSupported('video/mp4')
            ? 'video/mp4'
            : 'video/webm';

        const recorder = new MediaRecorder(stream, { mimeType });

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
            videoRef.current.srcObject = stream;
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (error) {
        return <div className="p-4 text-red-500 bg-red-100 rounded">{error}</div>;
    }

    return (
        <div className="flex flex-col items-center bg-slate-200 rounded-2xl overflow-hidden relative shadow-lg border border-slate-300">
            <video
                ref={videoRef}
                autoPlay
                muted={!recordedBlob}
                playsInline
                className="w-full h-96 object-cover bg-slate-300 scale-x-[-1]"
            />

            {/* Recording status overlay */}
            <div className="absolute top-4 right-4 rtl:left-4 rtl:right-auto bg-white/80 backdrop-blur-sm text-slate-800 px-3 py-1 rounded-full text-sm font-bold font-mono shadow-sm">
                {isRecording
                    ? <span className="text-red-500 animate-pulse">● {labels.rec} {formatTime(timer)}</span>
                    : labels.ready}
            </div>

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
                className="absolute top-4 left-4 rtl:right-4 rtl:left-auto text-slate-600 hover:text-slate-900 text-xs bg-white/80 px-3 py-1.5 rounded-full font-bold shadow-sm backdrop-blur-sm"
            >
                {labels.cancel}
            </button>
        </div>
    );
};

export default VideoRecorder;
