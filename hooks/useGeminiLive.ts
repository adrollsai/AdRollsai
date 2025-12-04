// hooks/useGeminiLive.ts
import { useState, useRef, useCallback } from 'react';

export const useGeminiLive = (apiKey: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  
  // Audio Nodes for Visualization
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);

  const connect = useCallback(async (systemInstruction: string, tools: any[]) => {
    if (!apiKey) return alert("API Key required");

    // 1. Initialize Audio Context (16kHz for input to match Gemini, 24kHz for output)
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
    
    // Create Analysers for the Orb
    inputAnalyserRef.current = audioContextRef.current.createAnalyser();
    inputAnalyserRef.current.fftSize = 32;
    inputAnalyserRef.current.smoothingTimeConstant = 0.1;

    outputAnalyserRef.current = audioContextRef.current.createAnalyser();
    outputAnalyserRef.current.fftSize = 32;
    outputAnalyserRef.current.smoothingTimeConstant = 0.1;

    // 2. WebSocket Setup
    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("Gemini Connected");
      setIsConnected(true);
      const setupMsg = {
        setup: {
          model: "models/gemini-2.0-flash-exp",
          generationConfig: { 
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } }
            }
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
        
        // Handle Audio
        if (data.serverContent?.modelTurn?.parts?.[0]?.inlineData) {
          const audioData = data.serverContent.modelTurn.parts[0].inlineData.data;
          playAudio(audioData);
          setIsSpeaking(true);
        }

        // Handle Turn Complete
        if (data.serverContent?.turnComplete) {
          setIsSpeaking(false);
        }

        // Handle Tool Calls
        if (data.toolUse) {
          const call = data.toolUse.functionCalls[0];
          // In production, execute the logic here
          console.log("Tool Triggered:", call.name, call.args);
          
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
        console.error("Parse Error:", e);
      }
    };

    ws.onclose = () => setIsConnected(false);

    await startMicrophone(ws);

  }, [apiKey]);

  const startMicrophone = async (ws: WebSocket) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          autoGainControl: true,
          noiseSuppression: true
        } 
      });
      mediaStreamRef.current = stream;
      
      const source = audioContextRef.current!.createMediaStreamSource(stream);
      
      // Connect to Analyser for Visuals
      source.connect(inputAnalyserRef.current!);

      // Processor: Buffer size 512 = ~32ms latency (vs 4096 = ~256ms)
      const processor = audioContextRef.current!.createScriptProcessor(512, 1, 1);
      
      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Simple Volume Meter
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
        setVolumeLevel(Math.sqrt(sum / inputData.length));

        // Convert Float32 -> PCM16
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // Base64 Encode
        let binary = '';
        const bytes = new Uint8Array(pcm16.buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
        const base64Audio = window.btoa(binary);

        ws.send(JSON.stringify({
          realtimeInput: {
            mediaChunks: [{ mimeType: "audio/pcm", data: base64Audio }]
          }
        }));
      };

      source.connect(processor);
      processor.connect(audioContextRef.current!.destination);

    } catch (err) {
      console.error("Mic Error:", err);
      setIsConnected(false);
    }
  };

  const playAudio = (base64String: string) => {
    if (!audioContextRef.current) return;
    
    // Decode Base64 -> PCM16 -> Float32
    const binaryString = window.atob(base64String);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    
    const float32 = new Float32Array(bytes.length / 2);
    const dataView = new DataView(bytes.buffer);
    for (let i = 0; i < bytes.length / 2; i++) {
        float32[i] = dataView.getInt16(i * 2, true) / 32768;
    }

    const buffer = audioContextRef.current.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    
    // Connect to Visuals AND Speaker
    source.connect(outputAnalyserRef.current!);
    source.connect(audioContextRef.current.destination);
    
    // Playback Logic
    const now = audioContextRef.current.currentTime;
    // If we're lagging too much (>0.5s), jump to now to reduce latency
    if (nextStartTimeRef.current < now || nextStartTimeRef.current > now + 0.5) {
        nextStartTimeRef.current = now;
    }
    
    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += buffer.duration;
  };

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    audioContextRef.current?.close();
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    setIsConnected(false);
    setIsSpeaking(false);
  }, []);

  return { 
    connect, 
    disconnect, 
    isConnected, 
    isSpeaking, 
    volumeLevel,
    // Expose analysers for the visualizer
    inputAnalyser: inputAnalyserRef.current,
    outputAnalyser: outputAnalyserRef.current
  };
};