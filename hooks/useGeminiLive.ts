import { useState, useRef, useCallback, useEffect } from 'react';

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
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  
  // Analysers for the Orb
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);

  // Helper to add logs (throttled slightly in UI by React state batching)
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
        
        // 1. INPUT CONTEXT: Force 16kHz to match Gemini's requirement
        // The browser will automatically resample your mic (e.g. 48kHz) to this rate.
        inputContextRef.current = new AudioContextClass({ sampleRate: 16000 });
        
        // 2. OUTPUT CONTEXT: Force 24kHz to match Gemini's output
        outputContextRef.current = new AudioContextClass({ sampleRate: 24000 });
        
        // Setup Visualizers
        inputAnalyserRef.current = inputContextRef.current.createAnalyser();
        inputAnalyserRef.current.fftSize = 32;
        inputAnalyserRef.current.smoothingTimeConstant = 0.1;
        
        outputAnalyserRef.current = outputContextRef.current.createAnalyser();
        outputAnalyserRef.current.fftSize = 32;
        outputAnalyserRef.current.smoothingTimeConstant = 0.1;

        // WebSocket Setup
        addLog("Connecting to Gemini...");
        const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            addLog("Connected! 🟢", 'success');
            setIsConnected(true);
            // Sync play start time
            nextStartTimeRef.current = outputContextRef.current?.currentTime || 0;

            const setupMsg = {
                setup: {
                    model: "models/gemini-2.0-flash-exp",
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
                let textData = "";
                if (event.data instanceof Blob) {
                    textData = await event.data.text();
                } else {
                    textData = event.data as string;
                }

                const data = JSON.parse(textData);

                // Audio Received
                if (data.serverContent?.modelTurn?.parts?.[0]?.inlineData) {
                    playAudio(data.serverContent.modelTurn.parts[0].inlineData.data);
                    setIsSpeaking(true);
                }

                if (data.serverContent?.turnComplete) {
                    setIsSpeaking(false);
                }

                if (data.serverContent?.interrupted) {
                    addLog("User interrupted bot", 'info');
                    setIsSpeaking(false);
                    // In a full app, we would clear the audio queue here
                    // nextStartTimeRef.current = outputContextRef.current?.currentTime || 0;
                }

                if (data.toolUse) {
                    const call = data.toolUse.functionCalls[0];
                    addLog(`Tool Called: ${call.name}`, 'success');
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
            } catch (e) {
                console.error(e);
            }
        };

        ws.onerror = (e) => {
            addLog("WebSocket Error", 'error');
            console.error(e);
            disconnect();
        };

        ws.onclose = () => {
            addLog("Disconnected", 'error');
            disconnect();
        };

        await startMicrophone(ws);

    } catch (err: any) {
        addLog(`Setup Failed: ${err.message}`, 'error');
        disconnect();
    }
  }, [apiKey]);

  const startMicrophone = async (ws: WebSocket) => {
    try {
        addLog("Opening Microphone...");
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { 
                echoCancellation: true, 
                noiseSuppression: true,
                autoGainControl: true
            } 
        });
        
        mediaStreamRef.current = stream;
        
        // Ensure context is running (sometimes browsers suspend it)
        await inputContextRef.current?.resume();
        await outputContextRef.current?.resume();

        const context = inputContextRef.current!;
        const source = context.createMediaStreamSource(stream);
        sourceRef.current = source;
        source.connect(inputAnalyserRef.current!);

        // BUFFER SIZE 256: Critical for low latency (approx 16ms chunks)
        const processor = context.createScriptProcessor(256, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
            if (ws.readyState !== WebSocket.OPEN) return;

            const inputData = e.inputBuffer.getChannelData(0);
            
            // Volume Meter
            let sum = 0;
            for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
            setVolumeLevel(Math.sqrt(sum / inputData.length));

            // Convert Float32 -> PCM16 (Little Endian)
            // Note: inputData is already 16kHz because we created the context with sampleRate: 16000
            const pcm16 = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
                const s = Math.max(-1, Math.min(1, inputData[i]));
                pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }

            // Send base64
            // Using a more efficient approach than string concatenation for large buffers
            let binary = '';
            const bytes = new Uint8Array(pcm16.buffer);
            const len = bytes.byteLength;
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const base64Audio = window.btoa(binary);

            ws.send(JSON.stringify({
                realtimeInput: {
                    mediaChunks: [{ mimeType: "audio/pcm", data: base64Audio }]
                }
            }));
        };

        source.connect(processor);
        processor.connect(context.destination); // Keep graph alive

    } catch (err: any) {
        addLog(`Mic Error: ${err.message}`, 'error');
        disconnect();
    }
  };

  const playAudio = (base64String: string) => {
    if (!outputContextRef.current) return;
    
    // Base64 -> Float32 (24kHz)
    const binaryString = window.atob(base64String);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768;
    }

    const buffer = outputContextRef.current.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);

    const source = outputContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(outputAnalyserRef.current!);
    source.connect(outputContextRef.current.destination);
    
    // Latency handling: If we fall behind by more than 0.2s, snap to current time
    const now = outputContextRef.current.currentTime;
    if (nextStartTimeRef.current < now || nextStartTimeRef.current > now + 0.2) {
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
    inputContextRef.current?.close();
    outputContextRef.current?.close();
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    
    addLog("Session Ended", 'info');
  }, []);

  return { 
    connect, 
    disconnect, 
    isConnected, 
    isSpeaking, 
    volumeLevel,
    inputAnalyser: inputAnalyserRef.current,
    outputAnalyser: outputAnalyserRef.current,
    logs 
  };
};