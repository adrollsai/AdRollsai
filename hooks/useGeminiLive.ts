import { useState, useRef, useCallback } from 'react';

export type Logger = {
  log: (msg: string, type?: 'info' | 'error' | 'success') => void;
  logs: { time: string; msg: string; type: 'info' | 'error' | 'success' }[];
};

export const useGeminiLive = (apiKey: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [logs, setLogs] = useState<{ time: string; msg: string; type: 'info' | 'error' | 'success' }[]>([]);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  
  // Analysers for the Orb
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);

  const addLog = (msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    const time = new Date().toLocaleTimeString().split(' ')[0];
    setLogs(prev => [{ time, msg, type }, ...prev].slice(0, 50)); 
  };

  const connect = useCallback(async (systemInstruction: string, tools: any[]) => {
    if (!apiKey) {
        addLog("Missing API Key", 'error');
        return;
    }

    try {
        addLog("Initializing Audio...");
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        
        // 1. Audio Context: Use standard settings (don't force sampleRate here as it can fail)
        audioContextRef.current = new AudioContextClass();
        
        // Setup Visualizers
        inputAnalyserRef.current = audioContextRef.current.createAnalyser();
        outputAnalyserRef.current = audioContextRef.current.createAnalyser();
        // Optimize for visuals
        inputAnalyserRef.current.fftSize = 64; 
        inputAnalyserRef.current.smoothingTimeConstant = 0.5;
        outputAnalyserRef.current.fftSize = 64;
        outputAnalyserRef.current.smoothingTimeConstant = 0.5;

        // WebSocket
        addLog("Connecting to Gemini...");
        const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            addLog("Connected! 🟢", 'success');
            setIsConnected(true);
            nextStartTimeRef.current = audioContextRef.current?.currentTime || 0;

            const setupMsg = {
                setup: {
                    model: "models/gemini-2.5-flash-native-audio-preview-09-2025",
                    generationConfig: { 
                        responseModalities: ["AUDIO"],
                        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } }
                    },
                    systemInstruction: { parts: [{ text: systemInstruction }] },
                    tools: [{ functionDeclarations: tools }]
                }
            };
            ws.send(JSON.stringify(setupMsg));
        };

        ws.onmessage = async (event) => {
            try {
                let textData = event.data instanceof Blob ? await event.data.text() : event.data;
                const data = JSON.parse(textData);

                if (data.serverContent?.modelTurn?.parts?.[0]?.inlineData) {
                    playAudio(data.serverContent.modelTurn.parts[0].inlineData.data);
                    if (!isSpeaking) setIsSpeaking(true);
                }

                if (data.serverContent?.turnComplete) {
                    setIsSpeaking(false);
                }

                if (data.toolUse) {
                    const call = data.toolUse.functionCalls[0];
                    addLog(`Tool: ${call.name}`, 'success');
                    ws.send(JSON.stringify({
                        toolResponse: {
                            functionResponses: [{
                                name: call.name,
                                id: call.id,
                                response: { result: "Success" } 
                            }]
                        }
                    }));
                }
            } catch (e) { console.error(e); }
        };

        ws.onclose = () => { setIsConnected(false); };
        
        await startMicrophone(ws);

    } catch (err: any) {
        addLog(`Error: ${err.message}`, 'error');
        disconnect();
    }
  }, [apiKey]);

  const startMicrophone = async (ws: WebSocket) => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        
        const context = audioContextRef.current!;
        const source = context.createMediaStreamSource(stream);
        sourceRef.current = source;
        source.connect(inputAnalyserRef.current!);

        // BUFFER SIZE: 512 is safe for most devices. 256 can cause crackling on slow CPUs.
        const processor = context.createScriptProcessor(512, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
            if (ws.readyState !== WebSocket.OPEN) return;

            const inputData = e.inputBuffer.getChannelData(0);
            
            // Visualizer Volume
            let sum = 0;
            for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
            setVolumeLevel(Math.sqrt(sum / inputData.length));

            // CRITICAL: RESAMPLING
            // Convert whatever the browser gave us (48k/44.1k) to 16k
            const downsampledData = downsampleBuffer(inputData, context.sampleRate, 16000);
            
            // Convert to PCM16
            const pcm16 = new Int16Array(downsampledData.length);
            for (let i = 0; i < downsampledData.length; i++) {
                const s = Math.max(-1, Math.min(1, downsampledData[i]));
                pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }

            // Send to Gemini
            const base64Audio = arrayBufferToBase64(pcm16.buffer);
            ws.send(JSON.stringify({
                realtimeInput: {
                    mediaChunks: [{ mimeType: "audio/pcm", data: base64Audio }]
                }
            }));
        };

        source.connect(processor);
        processor.connect(context.destination);

    } catch (err: any) {
        addLog(`Mic Error: ${err.message}`, 'error');
        disconnect();
    }
  };

  const playAudio = (base64String: string) => {
    if (!audioContextRef.current) return;
    
    const binaryString = window.atob(base64String);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    
    // Gemini sends 24kHz audio. We need to play it at 24kHz.
    // If our context is 48kHz, we need to upsample or let the buffer handle it.
    // The Web Audio API handles buffer resampling automatically if we set sampleRate correctly.
    
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768;
    }

    // Create a buffer at 24kHz (Gemini native rate)
    const buffer = audioContextRef.current.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(outputAnalyserRef.current!);
    source.connect(audioContextRef.current.destination);
    
    const now = audioContextRef.current.currentTime;
    // Aggressive catch-up: If we are behind, jump to now
    if (nextStartTimeRef.current < now) {
        nextStartTimeRef.current = now;
    }
    
    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += buffer.duration;
  };

  const disconnect = useCallback(() => {
    setIsConnected(false);
    setIsSpeaking(false);
    wsRef.current?.close();
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    // Don't close context to allow restart, just suspend or keep
    // mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    addLog("Session Ended", 'info');
  }, []);

  return { 
    connect, disconnect, isConnected, isSpeaking, 
    volumeLevel, inputAnalyser: inputAnalyserRef.current, 
    outputAnalyser: outputAnalyserRef.current, logs 
  };
};

// --- UTILS ---

// Robust Downsampler (Linear Interpolation)
const downsampleBuffer = (buffer: Float32Array, sampleRate: number, outSampleRate: number) => {
    if (outSampleRate === sampleRate) {
        return buffer;
    }
    if (outSampleRate > sampleRate) {
        // console.warn("Upsampling not supported in this simple implementation");
        return buffer;
    }
    const sampleRateRatio = sampleRate / outSampleRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
        const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
        // Use average value of accumulated samples (simple box filter)
        let accum = 0, count = 0;
        for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
            accum += buffer[i];
            count++;
        }
        result[offsetResult] = count > 0 ? accum / count : 0;
        offsetResult++;
        offsetBuffer = nextOffsetBuffer;
    }
    return result;
}

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}