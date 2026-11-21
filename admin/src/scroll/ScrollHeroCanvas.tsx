import { useEffect, useRef, type RefObject } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import * as THREE from 'three'

gsap.registerPlugin(ScrollTrigger)

type Props = {
  scrollerRoot: RefObject<HTMLElement | null>
  mode?: 'story' | 'ambient'
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Oryzo / The Watch 型: 固定キャンバス + 主役オブジェクト1つ。
 * スクロール進捗で「着信の粒 → 台帳スラブ」へ遷移する。
 * 明るい SaaS LP 向けに右側配置・淡色ライティング。
 */
export function ScrollHeroCanvas({ scrollerRoot, mode = 'story' }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    const root = scrollerRoot.current
    if (!host || !root) return

    if (prefersReducedMotion()) {
      host.dataset.fallback = '1'
      return
    }

    let disposed = false
    let raf = 0
    let trigger: ScrollTrigger | null = null
    let lenis: Lenis | null = null
    const progress = { value: mode === 'ambient' ? 0.35 : 0 }
    const smooth = { value: mode === 'ambient' ? 0.35 : 0 }

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40)
    camera.position.set(0.1, 0.15, 5.2)

    scene.add(new THREE.AmbientLight(0xffffff, 0.85))
    const key = new THREE.DirectionalLight(0xffffff, 1.05)
    key.position.set(2.4, 4.2, 3.2)
    const fill = new THREE.DirectionalLight(0x99f6e4, 0.55)
    fill.position.set(-2.8, 1.4, -1.2)
    const rim = new THREE.DirectionalLight(0xcbd5e1, 0.35)
    rim.position.set(0.5, -2, -3)
    scene.add(key, fill, rim)

    const hero = new THREE.Group()
    scene.add(hero)

    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 2.75, 0.07, 1, 1, 1),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.04,
        roughness: 0.42,
      }),
    )
    hero.add(slab)

    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(2.22, 2.77, 0.02),
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        metalness: 0.1,
        roughness: 0.6,
      }),
    )
    edge.position.z = -0.045
    hero.add(edge)

    const rows: THREE.Mesh[] = []
    const rowColors = [0xf1f5f9, 0xdbeafe, 0xf1f5f9, 0xccfbf1]
    for (let i = 0; i < 4; i++) {
      const row = new THREE.Mesh(
        new THREE.BoxGeometry(1.82, 0.26, 0.03),
        new THREE.MeshStandardMaterial({
          color: rowColors[i],
          metalness: 0.02,
          roughness: 0.72,
        }),
      )
      row.position.set(0, 0.78 - i * 0.44, 0.055)
      hero.add(row)
      rows.push(row)
    }

    const COUNT = 220
    const positions = new Float32Array(COUNT * 3)
    const seeds = new Float32Array(COUNT)
    for (let i = 0; i < COUNT; i++) {
      seeds[i] = Math.random()
      const a = (i / COUNT) * Math.PI * 2
      positions[i * 3] = Math.cos(a) * 0.85
      positions[i * 3 + 1] = (seeds[i] - 0.5) * 0.35
      positions[i * 3 + 2] = Math.sin(a) * 0.85
    }
    const pGeo = new THREE.BufferGeometry()
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const pMat = new THREE.PointsMaterial({
      color: 0x0f766e,
      size: 0.026,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      sizeAttenuation: true,
    })
    const points = new THREE.Points(pGeo, pMat)
    scene.add(points)

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

    if (mode === 'story') {
      lenis = new Lenis({
        duration: 1.2,
        smoothWheel: true,
        autoRaf: false,
      })
      lenis.on('scroll', ScrollTrigger.update)
      trigger = ScrollTrigger.create({
        trigger: root,
        start: 'top top',
        end: 'bottom bottom',
        scrub: false,
        onUpdate: (self) => {
          progress.value = self.progress
        },
      })
    }

    const clock = new THREE.Clock()
    const posAttr = pGeo.getAttribute('position') as THREE.BufferAttribute
    const mobile = () => window.matchMedia('(max-width: 860px)').matches

    function frame(timeMs = 0) {
      if (disposed) return
      raf = requestAnimationFrame(frame)
      if (document.hidden) return

      if (lenis) lenis.raf(timeMs)

      const t = clock.getElapsedTime()
      const target = mode === 'ambient' ? 0.28 + Math.sin(t * 0.2) * 0.04 : progress.value
      smooth.value += (target - smooth.value) * 0.05
      const p = smooth.value

      const ringPhase = 1 - THREE.MathUtils.smoothstep(p, 0.12, 0.48)
      const slabPhase = THREE.MathUtils.smoothstep(p, 0.16, 0.62)
      const isMobile = mobile()

      pMat.opacity = 0.12 + ringPhase * 0.58
      points.visible = ringPhase > 0.05
      for (let i = 0; i < COUNT; i++) {
        const a = t * (0.4 + seeds[i] * 0.32) + i * 0.12
        const r = (0.5 + seeds[i] * 0.8) * (0.5 + ringPhase * 1.05)
        posAttr.setXYZ(i, Math.cos(a) * r, Math.sin(a * 1.55) * 0.26 * ringPhase, Math.sin(a) * r)
      }
      posAttr.needsUpdate = true
      points.position.set(
        THREE.MathUtils.lerp(isMobile ? 0.15 : 1.05, isMobile ? 0 : 0.55, slabPhase),
        isMobile ? -0.55 : 0.08,
        THREE.MathUtils.lerp(0.35, -0.15, slabPhase),
      )

      hero.rotation.y = THREE.MathUtils.lerp(-0.48, -0.22, slabPhase) + Math.sin(t * 0.32) * 0.025
      hero.rotation.x = THREE.MathUtils.lerp(0.36, 0.1, slabPhase)
      hero.position.x = isMobile
        ? THREE.MathUtils.lerp(0.05, 0.1, p)
        : THREE.MathUtils.lerp(1.05, 1.25, p)
      hero.position.y = (isMobile ? -0.65 : 0.05) + Math.sin(t * 0.5) * 0.035
      hero.scale.setScalar((isMobile ? 0.78 : 0.94) + slabPhase * 0.18)
      // 最初から台帳は見える（有名Three.js同様、主役は常に存在）
      ;(slab.material as THREE.MeshStandardMaterial).opacity = 0.82 + slabPhase * 0.18
      ;(slab.material as THREE.MeshStandardMaterial).transparent = true
      ;(edge.material as THREE.MeshStandardMaterial).opacity = 0.7 + slabPhase * 0.3
      ;(edge.material as THREE.MeshStandardMaterial).transparent = true
      rows.forEach((row, i) => {
        const mat = row.material as THREE.MeshStandardMaterial
        mat.transparent = true
        mat.opacity = THREE.MathUtils.clamp(0.35 + slabPhase * 0.85 - i * 0.08, 0, 1)
        row.position.z = 0.055 + (1 - mat.opacity) * -0.12
      })

      camera.position.z = THREE.MathUtils.lerp(5.3, 4.6, p)
      camera.lookAt(isMobile ? 0.05 : 0.7, isMobile ? -0.4 : 0.02, 0)
      renderer.render(scene, camera)
    }
    frame()

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      trigger?.kill()
      lenis?.destroy()
      pGeo.dispose()
      pMat.dispose()
      slab.geometry.dispose()
      ;(slab.material as THREE.Material).dispose()
      edge.geometry.dispose()
      ;(edge.material as THREE.Material).dispose()
      rows.forEach((r) => {
        r.geometry.dispose()
        ;(r.material as THREE.Material).dispose()
      })
      renderer.dispose()
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement)
    }
  }, [scrollerRoot, mode])

  return <div className="story-canvas" ref={hostRef} aria-hidden />
}
