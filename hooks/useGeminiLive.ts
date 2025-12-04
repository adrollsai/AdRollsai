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

  // Refs for Audio Contexts (Separate Input/Output like the demo)
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  
  // Refs for Audio Graph
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // Playback State
  const nextStartTimeRef = useRef<number>(0);
  const scheduledSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  const addLog = (msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    const time = new Date().toLocaleTimeString().split(' ')[0];
    setLogs(prev => [{ time, msg, type }, ...prev].slice(0, 50)); 
  };

  // --- AUDIO UTILS (From Google Demo) ---
  
  // Converts Float32 (Microphone) to Int16 (Gemini Input)
  const pcmToBase64 = (float32Arr: Float32Array) => {
    const int16Arr = new Int16Array(float32Arr.length);
    for (let i = 0; i < float32Arr.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Arr[i]));
      int16Arr[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    let binary = '';
    const bytes = new Uint8Array(int16Arr.buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  // Converts Base64 (Gemini Output) to AudioBuffer
  const base64ToAudioBuffer = async (base64String: string, context: AudioContext) => {
    const binaryString = window.atob(base64String);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    
    // Create Int16 View of the bytes
    const int16Arr = new Int16Array(bytes.buffer);
    
    // Convert Int16 -> Float32
    const float32Arr = new Float32Array(int16Arr.length);
    for (let i = 0; i < int16Arr.length; i++) {
      float32Arr[i] = int16Arr[i] / 32768.0;
    }

    const buffer = context.createBuffer(1, float32Arr.length, 24000);
    buffer.copyToChannel(float32Arr, 0);
    return buffer;
  };

  const connect = useCallback(async (systemInstruction: string) => {
    if (!apiKey) {
      addLog("Missing API Key", 'error');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      addLog("Initializing Audio...");
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      
      // 1. INPUT: 16kHz (Matches Gemini Requirement)
      inputContextRef.current = new AudioContextClass({ sampleRate: 16000 });
      
      // 2. OUTPUT: 24kHz (Matches Gemini Response)
      outputContextRef.current = new AudioContextClass({ sampleRate: 24000 });

      // Setup Visualizers
      inputAnalyserRef.current = inputContextRef.current.createAnalyser();
      outputAnalyserRef.current = outputContextRef.current.createAnalyser();
      inputAnalyserRef.current.fftSize = 64; 
      inputAnalyserRef.current.smoothingTimeConstant = 0.5;
      outputAnalyserRef.current.fftSize = 64;
      outputAnalyserRef.current.smoothingTimeConstant = 0.5;

      // WebSocket
      addLog("Connecting...");
      // Using BidiGenerateContent as per updated docs
      const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        addLog("Connected! 🟢", 'success');
        setIsConnected(true);
        nextStartTimeRef.current = outputContextRef.current?.currentTime || 0;

        const setupMsg = {
          setup: {
            model: "models/gemini-2.5-flash-native-audio-preview-09-2025",
            generationConfig: { 
              responseModalities: ["AUDIO"],
              speechConfig: { 
                voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } 
              }
            },
            systemInstruction: { parts: [{ text: systemInstruction }] }
          }
        };
        ws.send(JSON.stringify(setupMsg));
      };

      ws.onmessage = async (event) => {
        try {
          let textData = event.data instanceof Blob ? await event.data.text() : event.data;
          const data = JSON.parse(textData);

          // 1. Audio Received
          if (data.serverContent?.modelTurn?.parts?.[0]?.inlineData) {
            const base64 = data.serverContent.modelTurn.parts[0].inlineData.data;
            handleAudioOutput(base64);
            setIsSpeaking(true);
          }

          // 2. Turn Complete
          if (data.serverContent?.turnComplete) {
            setIsSpeaking(false);
          }

          // 3. Interrupted (User spoke while bot was speaking)
          if (data.serverContent?.interrupted) {
            addLog("Interrupted", 'info');
            cancelAudioQueue();
            setIsSpeaking(false);
          }
        } catch (e) { console.error(e); }
      };

      ws.onclose = (e) => { 
        addLog(`Disconnected: ${e.code}`, 'error');
        disconnect();
      };
      
      await startRecording(ws);

    } catch (err: any) {
      addLog(`Error: ${err.message}`, 'error');
      disconnect();
    }
  }, [apiKey]);

  const startRecording = async (ws: WebSocket) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true,
          autoGainControl: true 
        } 
      });
      mediaStreamRef.current = stream;
      
      // Ensure context is running
      if (inputContextRef.current?.state === 'suspended') {
        await inputContextRef.current.resume();
      }

      const source = inputContextRef.current!.createMediaStreamSource(stream);
      sourceNodeRef.current = source;
      source.connect(inputAnalyserRef.current!);

      // Use ScriptProcessor (bufferSize 512 for balance)
      // Ideally this would be AudioWorklet, but SP is simpler for a drop-in file
      const processor = inputContextRef.current!.createScriptProcessor(512, 1, 1);
      scriptProcessorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);
        
        // Volume for Orb
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
        setVolumeLevel(Math.sqrt(sum / inputData.length));

        // Encode and Send
        const base64Audio = pcmToBase64(inputData);
        
        ws.send(JSON.stringify({
          realtimeInput: {
            mediaChunks: [{ 
                mimeType: "audio/pcm;rate=16000", 
                data: base64Audio 
            }]
          }
        }));
      };

      source.connect(processor);
      processor.connect(inputContextRef.current!.destination);

    } catch (err: any) {
      addLog(`Mic Error: ${err.message}`, 'error');
      disconnect();
    }
  };

  const handleAudioOutput = async (base64String: string) => {
    if (!outputContextRef.current) return;
    
    // Ensure context is running
    if (outputContextRef.current.state === 'suspended') {
        await outputContextRef.current.resume();
    }

    const buffer = await base64ToAudioBuffer(base64String, outputContextRef.current);
    
    const source = outputContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(outputAnalyserRef.current!);
    source.connect(outputContextRef.current.destination);
    
    // Schedule Playback
    const now = outputContextRef.current.currentTime;
    
    // If we've drifted far behind, reset to now (Low Latency catch-up)
    if (nextStartTimeRef.current < now) {
        nextStartTimeRef.current = now;
    }
    
    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += buffer.duration;
    
    // Track source for cancellation
    scheduledSourcesRef.current.push(source);
    source.onended = () => {
        scheduledSourcesRef.current = scheduledSourcesRef.current.filter(s => s !== source);
    };
  };

  const cancelAudioQueue = () => {
    // Stop all currently playing or scheduled sources
    scheduledSourcesRef.current.forEach(source => {
        try { source.stop(); } catch(e) {}
    });
    scheduledSourcesRef.current = [];
    
    // Reset time tracker
    if (outputContextRef.current) {
        nextStartTimeRef.current = outputContextRef.current.currentTime;
    }
  };

  const disconnect = useCallback(() => {
    setIsConnected(false);
    setIsSpeaking(false);
    
    wsRef.current?.close();
    wsRef.current = null;
    
    scriptProcessorRef.current?.disconnect();
    sourceNodeRef.current?.disconnect();
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    
    inputContextRef.current?.close();
    outputContextRef.current?.close();
    
    addLog("Session Ended", 'info');
  }, []);

  return { 
    connect, disconnect, isConnected, isSpeaking, 
    volumeLevel, inputAnalyser: inputAnalyserRef.current, 
    outputAnalyser: outputAnalyserRef.current, logs 
  };
};