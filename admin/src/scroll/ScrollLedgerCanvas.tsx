import { useEffect, useRef, type RefObject } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import * as THREE from 'three'

gsap.registerPlugin(ScrollTrigger)

type Props = {
  scrollerRoot: RefObject<HTMLElement | null>
}

/**
 * Amazing SEIRAN 型:
 * 事前計算した複数形状を頂点シェーダで混合し、
 * スクロールタイムラインがそのまま変形の再生ヘッドになる。
 * よやく台帳向け: 嵐(着信) → 整流 → 波形(今夜) → 星座(台帳)
 */
export function ScrollLedgerCanvas({ scrollerRoot }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    const root = scrollerRoot.current
    if (!host || !root) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      host.dataset.fallback = '1'
      return
    }

    let disposed = false
    let raf = 0
    let scrollTl: gsap.core.Timeline | null = null
    const isMobile = window.matchMedia('(max-width: 760px)').matches

    const canvas = document.createElement('canvas')
    host.appendChild(canvas)

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false })
    } catch {
      host.dataset.fallback = '1'
      host.removeChild(canvas)
      return
    }

    renderer.setClearColor(0x05070d, 1)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2))

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 60)
    camera.position.set(0, 0, 8.2)

    const view = { w0: 1, w1: 0, w2: 0, w3: 0, rot: 0, px: 1.4, tilt: 0.12 }

    const rng = (() => {
      let s = 20261121
      return () => {
        s = (s * 1664525 + 1013904223) >>> 0
        return s / 4294967296
      }
    })()
    const rand = (a: number, b: number) => a + (b - a) * rng()

    const N = isMobile ? 7000 : 16000
    const p0 = new Float32Array(N * 3)
    const p1 = new Float32Array(N * 3)
    const p2 = new Float32Array(N * 3)
    const p3 = new Float32Array(N * 3)
    const seed = new Float32Array(N)

    // 嵐: 着信の嵐
    for (let i = 0; i < N; i++) {
      const u = rng()
      const v = rng()
      const th = u * Math.PI * 2
      const ph = Math.acos(2 * v - 1)
      const r = 2.5 * (0.55 + 0.45 * Math.pow(rng(), 0.6)) * (1 + 0.35 * Math.sin(th * 3 + ph * 5))
      const sw = th + r * 0.9
      p0[i * 3] = Math.sin(ph) * Math.cos(sw) * r
      p0[i * 3 + 1] = Math.cos(ph) * r * 0.72
      p0[i * 3 + 2] = Math.sin(ph) * Math.sin(sw) * r
      seed[i] = rng()
    }

    // 整流: トーラスノット
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2 * 2
      const pq = 3 / 2
      const R = 1.75
      const tube = 0.42
      const cx = (R + 0.62 * Math.cos(pq * t)) * Math.cos(t)
      const cy = 0.62 * Math.sin(pq * t) * 1.35
      const cz = (R + 0.62 * Math.cos(pq * t)) * Math.sin(t)
      const a = rng() * Math.PI * 2
      const rr = tube * Math.sqrt(rng())
      p1[i * 3] = cx + Math.cos(a) * rr
      p1[i * 3 + 1] = cy + Math.sin(a) * rr * 0.9
      p1[i * 3 + 2] = cz + Math.sin(a + 1.3) * rr
    }

    // 波形: 今夜の予約の時間軸
    for (let i = 0; i < N; i++) {
      const x = rand(-4.6, 4.6)
      const z = rand(-2.4, 2.4)
      const layer = i % 2
      const y =
        Math.sin(x * 1.5 + z * 0.8) * 0.55 +
        Math.sin(x * 3.1 - z * 1.7) * 0.28 +
        (layer ? 0.85 : -0.85)
      p2[i * 3] = x
      p2[i * 3 + 1] = y
      p2[i * 3 + 2] = z
    }

    // 星座: 台帳の行として結ばれた予約
    const HUBS = 22
    const hubs: THREE.Vector3[] = []
    for (let h = 0; h < HUBS; h++) {
      const u = rng()
      const v = rng()
      const th = u * Math.PI * 2
      const ph = Math.acos(2 * v - 1)
      const r = rand(1.5, 2.6)
      hubs.push(
        new THREE.Vector3(
          Math.sin(ph) * Math.cos(th) * r,
          Math.cos(ph) * r * 0.8,
          Math.sin(ph) * Math.sin(th) * r,
        ),
      )
    }
    for (let i = 0; i < N; i++) {
      const hub = hubs[i % HUBS]
      const spread = rng() < 0.12 ? 0.9 : 0.28
      p3[i * 3] = hub.x + rand(-spread, spread)
      p3[i * 3 + 1] = hub.y + rand(-spread, spread)
      p3[i * 3 + 2] = hub.z + rand(-spread, spread)
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(p0, 3))
    geo.setAttribute('aP0', new THREE.BufferAttribute(p0, 3))
    geo.setAttribute('aP1', new THREE.BufferAttribute(p1, 3))
    geo.setAttribute('aP2', new THREE.BufferAttribute(p2, 3))
    geo.setAttribute('aP3', new THREE.BufferAttribute(p3, 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))

    const uniforms = {
      uTime: { value: 0 },
      uW: { value: new THREE.Vector4(1, 0, 0, 0) },
      uSize: { value: (isMobile ? 5.0 : 6.2) * renderer.getPixelRatio() },
      uColStorm: { value: new THREE.Color(0x2dd4bf) },
      uColKnot: { value: new THREE.Color(0x5eead4) },
      uColWave: { value: new THREE.Color(0x7dd3fc) },
      uColNet: { value: new THREE.Color(0xf0d89a) },
    }

    const points = new THREE.Points(
      geo,
      new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          attribute vec3 aP0, aP1, aP2, aP3;
          attribute float aSeed;
          uniform float uTime, uSize;
          uniform vec4 uW;
          varying float vSeed;
          varying vec4 vW;
          void main() {
            vSeed = aSeed;
            vW = uW;
            vec3 pos = aP0 * uW.x + aP1 * uW.y + aP2 * uW.z + aP3 * uW.w;
            float amp = 0.05 + 0.11 * uW.x + 0.03 * uW.z;
            pos += amp * vec3(
              sin(uTime * 0.8 + pos.y * 2.1 + aSeed * 6.28),
              sin(uTime * 0.7 + pos.z * 1.7 + aSeed * 4.2),
              sin(uTime * 0.9 + pos.x * 1.9 + aSeed * 2.6)
            );
            pos.x += uW.z * sin(uTime * 0.5 + aSeed * 6.28) * 0.14;
            vec4 mv = modelViewMatrix * vec4(pos, 1.0);
            float tw = 0.75 + 0.45 * sin(uTime * 1.6 + aSeed * 6.28);
            gl_PointSize = uSize * tw * (3.4 / -mv.z);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          precision mediump float;
          uniform vec3 uColStorm, uColKnot, uColWave, uColNet;
          varying float vSeed;
          varying vec4 vW;
          void main() {
            vec2 c = gl_PointCoord - 0.5;
            float d = length(c);
            float alpha = smoothstep(0.5, 0.06, d);
            float wsum = max(vW.x + vW.y + vW.z + vW.w, 0.001);
            vec3 col = (uColStorm * vW.x + uColKnot * vW.y + uColWave * vW.z + uColNet * vW.w) / wsum;
            col = mix(col, vec3(1.0), step(0.93, vSeed) * 0.75);
            gl_FragColor = vec4(col, alpha * 0.75);
          }
        `,
      }),
    )

    const cloud = new THREE.Group()
    cloud.add(points)
    scene.add(cloud)

    const linePos: number[] = []
    for (let i = 0; i < HUBS; i++) {
      const dists = hubs
        .map((h, j) => ({ j, d: hubs[i].distanceTo(h) }))
        .filter((o) => o.j !== i)
        .sort((a, b) => a.d - b.d)
      for (let k = 0; k < 2; k++) {
        const o = hubs[dists[k].j]
        linePos.push(hubs[i].x, hubs[i].y, hubs[i].z, o.x, o.y, o.z)
      }
    }
    const lg = new THREE.BufferGeometry()
    lg.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3))
    const netLines = new THREE.LineSegments(
      lg,
      new THREE.LineBasicMaterial({
        color: 0xf0d89a,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    cloud.add(netLines)

    const glowTex = (() => {
      const c = document.createElement('canvas')
      c.width = c.height = 128
      const ctx = c.getContext('2d')!
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
      g.addColorStop(0, 'rgba(255,255,255,1)')
      g.addColorStop(0.4, 'rgba(255,255,255,.35)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 128, 128)
      const tex = new THREE.CanvasTexture(c)
      tex.colorSpace = THREE.SRGBColorSpace
      return tex
    })()

    const core = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: 0x2dd4bf,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    core.scale.setScalar(5.5)
    cloud.add(core)

    function addHaze(color: number, x: number, y: number, z: number, scale: number, opacity: number) {
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTex,
          color,
          transparent: true,
          opacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
      sp.position.set(x, y, z)
      sp.scale.setScalar(scale)
      scene.add(sp)
    }
    addHaze(0x0f766e, -5, 3, -9, 20, 0.14)
    addHaze(0x5eead4, 6, -3, -10, 16, 0.08)

    const mount = host
    function resize() {
      const w = mount.clientWidth || window.innerWidth
      const h = mount.clientHeight || window.innerHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h, false)
    }
    resize()
    window.addEventListener('resize', resize)

    scrollTl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: root,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.8,
      },
    })
    scrollTl
      .to(view, { rot: 0.5, px: 1.4, duration: 0.12 }, 0)
      .to(view, { rot: 1.1, px: 0, duration: 0.19 }, 0.12)
      .to(view, { w0: 0, w1: 1, rot: 1.9, duration: 0.14 }, 0.31)
      .to(view, { rot: 2.4, duration: 0.05 }, 0.45)
      .to(view, { w1: 0, w2: 1, rot: 2.9, tilt: 0.5, duration: 0.13 }, 0.5)
      .to(view, { rot: 3.2, duration: 0.05 }, 0.63)
      .to(view, { w2: 0, w3: 1, rot: 3.9, px: -1.2, tilt: 0.12, duration: 0.14 }, 0.68)
      .to(view, { rot: 4.3, duration: 0.04 }, 0.82)
      .to(view, { w3: 0.55, w0: 0.45, px: 0, rot: 5.0, duration: 0.14 }, 0.86)

    root.querySelectorAll('[data-reveal]').forEach((el) => {
      gsap.fromTo(
        el,
        { opacity: 0, y: 28 },
        {
          opacity: 1,
          y: 0,
          duration: 1.05,
          ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 86%', once: true },
        },
      )
    })

    const clock = new THREE.Clock()
    function frame() {
      if (disposed) return
      raf = requestAnimationFrame(frame)
      if (document.hidden) return
      const t = clock.getElapsedTime()
      uniforms.uTime.value = t
      uniforms.uW.value.set(view.w0, view.w1, view.w2, view.w3)
      cloud.rotation.y = view.rot + t * 0.03
      cloud.rotation.x = view.tilt + Math.sin(t * 0.2) * 0.02
      cloud.position.x = view.px
      ;(netLines.material as THREE.LineBasicMaterial).opacity = view.w3 * 0.5
      core.material.opacity = 0.1 + view.w0 * 0.14
      renderer.render(scene, camera)
    }
    frame()

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      scrollTl?.scrollTrigger?.kill()
      scrollTl?.kill()
      ScrollTrigger.getAll().forEach((st) => st.kill())
      geo.dispose()
      ;(points.material as THREE.Material).dispose()
      lg.dispose()
      ;(netLines.material as THREE.Material).dispose()
      glowTex.dispose()
      renderer.dispose()
      if (canvas.parentElement === mount) mount.removeChild(canvas)
    }
  }, [scrollerRoot])

  return <div className="sx-canvas" ref={hostRef} aria-hidden />
}
