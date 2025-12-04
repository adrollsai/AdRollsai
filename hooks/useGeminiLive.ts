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
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  
  // Analysers
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
        
        // 1. Audio Context (Standard, let browser decide rate to avoid glitches)
        audioContextRef.current = new AudioContextClass({ latencyHint: 'interactive' });
        
        // Setup Visualizers
        inputAnalyserRef.current = audioContextRef.current.createAnalyser();
        outputAnalyserRef.current = audioContextRef.current.createAnalyser();
        inputAnalyserRef.current.fftSize = 32; 
        inputAnalyserRef.current.smoothingTimeConstant = 0.5;
        outputAnalyserRef.current.fftSize = 32;
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

                if (data.serverContent?.interrupted) {
                    addLog("Interrupted", 'info');
                    setIsSpeaking(false);
                    // Clear buffer to stop talking immediately
                    if (audioContextRef.current) {
                        nextStartTimeRef.current = audioContextRef.current.currentTime;
                    }
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
    if (!audioContextRef.current) return;

    try {
        // --- 1. Load AudioWorklet (The Magic Fix) ---
        // This runs in a separate thread, preventing UI lag from stopping audio
        const workletCode = `
          class RecorderProcessor extends AudioWorkletProcessor {
            constructor() {
              super();
              this.bufferSize = 2048; // Process in chunks (balanced latency)
              this.buffer = new Float32Array(this.bufferSize);
              this.bufferIndex = 0;
            }
            process(inputs, outputs, parameters) {
              const input = inputs[0];
              if (!input || !input[0]) return true;
              
              const channel = input[0];
              for (let i = 0; i < channel.length; i++) {
                this.buffer[this.bufferIndex++] = channel[i];
                
                if (this.bufferIndex === this.bufferSize) {
                  // Send full buffer to main thread
                  this.port.postMessage(this.buffer);
                  this.bufferIndex = 0;
                }
              }
              return true;
            }
          }
          registerProcessor('recorder-worklet', RecorderProcessor);
        `;
        
        const blob = new Blob([workletCode], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        
        await audioContextRef.current.audioWorklet.addModule(url);

        // --- 2. Start Stream ---
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        
        const source = audioContextRef.current.createMediaStreamSource(stream);
        sourceRef.current = source;
        source.connect(inputAnalyserRef.current!);

        // --- 3. Connect Worklet ---
        const recorderNode = new AudioWorkletNode(audioContextRef.current, 'recorder-worklet');
        workletNodeRef.current = recorderNode;
        
        recorderNode.port.onmessage = (event) => {
            if (ws.readyState !== WebSocket.OPEN) return;

            const inputData = event.data as Float32Array;
            
            // Visualizer Volume
            let sum = 0;
            for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
            setVolumeLevel(Math.sqrt(sum / inputData.length));

            // CRITICAL: RESAMPLING (Fixes Gibberish)
            // If browser is 48k, downsample to 16k for Gemini
            let pcm16;
            const currentRate = audioContextRef.current!.sampleRate;
            if (currentRate !== 16000) {
                const downsampled = downsampleTo16k(inputData, currentRate);
                pcm16 = floatTo16BitPCM(downsampled);
            } else {
                pcm16 = floatTo16BitPCM(inputData);
            }

            // Send
            const base64Audio = arrayBufferToBase64(pcm16.buffer);
            ws.send(JSON.stringify({
                realtimeInput: {
                    mediaChunks: [{ mimeType: "audio/pcm", data: base64Audio }]
                }
            }));
        };

        source.connect(recorderNode);
        recorderNode.connect(audioContextRef.current.destination); // Keep graph alive

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
    
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768;
    }

    // Gemini 2.5 Native Output is 24kHz
    const buffer = audioContextRef.current.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(outputAnalyserRef.current!);
    source.connect(audioContextRef.current.destination);
    
    const now = audioContextRef.current.currentTime;
    // Catch up if lagging
    if (nextStartTimeRef.current < now || nextStartTimeRef.current > now + 0.5) {
        nextStartTimeRef.current = now;
    }
    
    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += buffer.duration;
  };

  const disconnect = useCallback(() => {
    setIsConnected(false);
    setIsSpeaking(false);
    wsRef.current?.close();
    workletNodeRef.current?.disconnect(); // Disconnect worklet
    sourceRef.current?.disconnect();
    audioContextRef.current?.close();
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    addLog("Session Ended", 'info');
  }, []);

  return { 
    connect, disconnect, isConnected, isSpeaking, 
    volumeLevel, inputAnalyser: inputAnalyserRef.current, 
    outputAnalyser: outputAnalyserRef.current, logs 
  };
};

// --- UTILS ---

const downsampleTo16k = (buffer: Float32Array, sampleRate: number) => {
    if (sampleRate === 16000) return buffer;
    const ratio = sampleRate / 16000;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
        result[i] = buffer[Math.round(i * ratio)];
    }
    return result;
}

const floatTo16BitPCM = (input: Float32Array) => {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
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