'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

interface OrbProps {
  isSpeaking: boolean
  inputAnalyser: AnalyserNode | null
  outputAnalyser: AnalyserNode | null
}

export default function Orb({ isSpeaking, inputAnalyser, outputAnalyser }: OrbProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  
  // Ref for cleanup tracking
  const sceneRef = useRef<{ renderer: THREE.WebGLRenderer, animationId: number } | null>(null)

  useEffect(() => {
    if (!mountRef.current) return

    // --- SETUP ---
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x050505)

    const camera = new THREE.PerspectiveCamera(75, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 1000)
    camera.position.z = 4

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    mountRef.current.appendChild(renderer.domElement)

    // --- ORB ---
    const geometry = new THREE.IcosahedronGeometry(1.5, 20)
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uInput: { value: 0 },
        uOutput: { value: 0 },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uInput;
        uniform float uOutput;
        varying vec2 vUv;
        varying float vDistort;
        
        // Simplex Noise (Simplified for stability)
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
        float snoise(vec3 v) {
            const vec2  C = vec2(1.0/6.0, 1.0/3.0);
            const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
            vec3 i  = floor(v + dot(v, C.yyy) );
            vec3 x0 = v - i + dot(i, C.xxx) ;
            vec3 g = step(x0.yzx, x0.xyz);
            vec3 l = 1.0 - g;
            vec3 i1 = min( g.xyz, l.zxy );
            vec3 i2 = max( g.xyz, l.zxy );
            vec3 x1 = x0 - i1 + C.xxx;
            vec3 x2 = x0 - i2 + C.yyy;
            vec3 x3 = x0 - D.yyy;
            i = mod289(i);
            vec4 p = permute( permute( permute( 
                        i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                        + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
                        + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
            float n_ = 0.142857142857;
            vec3  ns = n_ * D.wyz - D.xzx;
            vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
            vec4 x_ = floor(j * ns.z);
            vec4 y_ = floor(j - 7.0 * x_ );
            vec4 x = x_ *ns.x + ns.yyyy;
            vec4 y = y_ *ns.x + ns.yyyy;
            vec4 h = 1.0 - abs(x) - abs(y);
            vec4 b0 = vec4( x.xy, y.xy );
            vec4 b1 = vec4( x.zw, y.zw );
            vec4 s0 = floor(b0)*2.0 + 1.0;
            vec4 s1 = floor(b1)*2.0 + 1.0;
            vec4 sh = -step(h, vec4(0.0));
            vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
            vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
            vec3 p0 = vec3(a0.xy,h.x);
            vec3 p1 = vec3(a0.zw,h.y);
            vec3 p2 = vec3(a1.xy,h.z);
            vec3 p3 = vec3(a1.zw,h.w);
            vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
            p0 *= norm.x;
            p1 *= norm.y;
            p2 *= norm.z;
            p3 *= norm.w;
            vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
            m = m * m;
            return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                            dot(p2,x2), dot(p3,x3) ) );
        }

        void main() {
            vUv = uv;
            float noise = snoise(position + vec3(uTime));
            float distortion = noise * (0.2 + uInput + uOutput * 2.0);
            vec3 newPos = position + (normal * distortion);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
            vDistort = distortion;
        }
      `,
      fragmentShader: `
        varying float vDistort;
        void main() {
            vec3 color = mix(vec3(0.1, 0.4, 0.8), vec3(0.9, 0.1, 0.2), vDistort * 2.0);
            gl_FragColor = vec4(color, 1.0);
        }
      `,
      wireframe: true,
      transparent: true
    })

    const sphere = new THREE.Mesh(geometry, material)
    scene.add(sphere)

    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85))

    const dataArray = new Uint8Array(32)
    
    const animate = () => {
        const id = requestAnimationFrame(animate)
        if (sceneRef.current) sceneRef.current.animationId = id

        material.uniforms.uTime.value += 0.01
        
        if (inputAnalyser) {
            inputAnalyser.getByteFrequencyData(dataArray)
            material.uniforms.uInput.value = THREE.MathUtils.lerp(material.uniforms.uInput.value, dataArray[4] / 255, 0.1)
        }
        if (outputAnalyser) {
            outputAnalyser.getByteFrequencyData(dataArray)
            material.uniforms.uOutput.value = THREE.MathUtils.lerp(material.uniforms.uOutput.value, dataArray[4] / 255, 0.1)
        }

        sphere.rotation.y += 0.002
        composer.render()
    }
    
    animate()
    
    // Store cleanup data
    sceneRef.current = { renderer, animationId: 0 }

    const handleResize = () => {
        if (!mountRef.current) return
        const w = mountRef.current.clientWidth
        const h = mountRef.current.clientHeight
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
        composer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    return () => {
        window.removeEventListener('resize', handleResize)
        if (sceneRef.current) {
            cancelAnimationFrame(sceneRef.current.animationId)
            sceneRef.current.renderer.dispose()
            mountRef.current?.removeChild(sceneRef.current.renderer.domElement)
        }
    }
  }, [inputAnalyser, outputAnalyser]) // Depend on analysers to re-bind if they change

  return <div ref={mountRef} className="w-full h-full" />
}