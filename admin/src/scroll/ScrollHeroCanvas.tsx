import { useEffect, useRef, type RefObject } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import * as THREE from 'three'

gsap.registerPlugin(ScrollTrigger)

type Props = {
  /** ScrollTrigger の範囲になるルート要素 */
  scrollerRoot: RefObject<HTMLElement | null>
  /** ambient: 応募画面など、弱いドリフトのみ */
  mode?: 'story' | 'ambient'
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * スクロール進捗で「電話 → 声の粒 → 台帳」へ遷移する軽量 Three.js シーン。
 * モデルなし・手続き形状のみ。HTML を先に出し、canvas は装飾。
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
    const progress = { value: mode === 'ambient' ? 0.55 : 0 }

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    renderer.setClearColor(0x000000, 0)
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 40)
    camera.position.set(0, 0.2, 6.2)

    const ambient = new THREE.AmbientLight(0xb6fff3, 0.55)
    const key = new THREE.DirectionalLight(0xffffff, 1.1)
    key.position.set(3, 5, 4)
    const rim = new THREE.DirectionalLight(0x5eead4, 0.7)
    rim.position.set(-4, 1, -2)
    scene.add(ambient, key, rim)

    // —— phone slab ——
    const phone = new THREE.Group()
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.05, 2.05, 0.12, 1, 1, 1),
      new THREE.MeshStandardMaterial({
        color: 0x134e4a,
        metalness: 0.35,
        roughness: 0.35,
      }),
    )
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.86, 1.7),
      new THREE.MeshStandardMaterial({
        color: 0x99f6e4,
        emissive: 0x0f766e,
        emissiveIntensity: 0.85,
        metalness: 0.1,
        roughness: 0.4,
      }),
    )
    screen.position.z = 0.065
    phone.add(body, screen)
    phone.position.set(-1.4, 0.1, 0)
    scene.add(phone)

    // —— voice particles ——
    const COUNT = 420
    const positions = new Float32Array(COUNT * 3)
    const seeds = new Float32Array(COUNT)
    for (let i = 0; i < COUNT; i++) {
      const a = (i / COUNT) * Math.PI * 2
      const r = 0.35 + (i % 7) * 0.04
      positions[i * 3] = Math.cos(a) * r
      positions[i * 3 + 1] = (i % 11) * 0.03 - 0.2
      positions[i * 3 + 2] = Math.sin(a) * r
      seeds[i] = Math.random()
    }
    const pGeo = new THREE.BufferGeometry()
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const pMat = new THREE.PointsMaterial({
      color: 0x5eead4,
      size: 0.035,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      sizeAttenuation: true,
    })
    const points = new THREE.Points(pGeo, pMat)
    points.position.set(0.1, 0.15, 0.4)
    scene.add(points)

    // —— ledger plane + rows ——
    const ledger = new THREE.Group()
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 1.7),
      new THREE.MeshStandardMaterial({
        color: 0xf8faf9,
        metalness: 0.05,
        roughness: 0.7,
      }),
    )
    ledger.add(board)
    const rowMats: THREE.MeshStandardMaterial[] = []
    for (let i = 0; i < 3; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: i === 1 ? 0xdbeafe : 0xe7e5e4,
        roughness: 0.85,
      })
      rowMats.push(mat)
      const row = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.28), mat)
      row.position.set(0, 0.45 - i * 0.42, 0.02)
      ledger.add(row)
    }
    ledger.position.set(1.55, -0.05, -0.2)
    ledger.rotation.y = -0.35
    scene.add(ledger)

    const soft = new THREE.Mesh(
      new THREE.SphereGeometry(2.4, 24, 24),
      new THREE.MeshBasicMaterial({
        color: 0x14b8a6,
        transparent: true,
        opacity: 0.06,
        depthWrite: false,
      }),
    )
    soft.position.set(0.6, 0.1, -1.8)
    scene.add(soft)

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
      trigger = ScrollTrigger.create({
        trigger: root,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.65,
        onUpdate: (self) => {
          progress.value = self.progress
        },
      })
    }

    const clock = new THREE.Clock()
    const posAttr = pGeo.getAttribute('position') as THREE.BufferAttribute

    function frame() {
      if (disposed) return
      raf = requestAnimationFrame(frame)
      if (document.hidden) return

      const t = clock.getElapsedTime()
      const p = progress.value

      // chapter blends
      const phonePhase = THREE.MathUtils.clamp(1 - p / 0.38, 0, 1)
      const voicePhase = THREE.MathUtils.smoothstep(p, 0.12, 0.55)
      const ledgerPhase = THREE.MathUtils.smoothstep(p, 0.42, 0.88)

      phone.rotation.y = -0.55 + p * 1.35 + Math.sin(t * 0.4) * 0.03
      phone.rotation.x = 0.18 - p * 0.35
      phone.position.x = THREE.MathUtils.lerp(-1.35, -2.4, ledgerPhase)
      phone.position.y = 0.1 + Math.sin(t * 0.7) * 0.04
      phone.visible = phonePhase > 0.05
      body.material.opacity = 1
      ;(body.material as THREE.MeshStandardMaterial).transparent = phonePhase < 1
      ;(body.material as THREE.MeshStandardMaterial).opacity = phonePhase
      ;(screen.material as THREE.MeshStandardMaterial).transparent = phonePhase < 1
      ;(screen.material as THREE.MeshStandardMaterial).opacity = phonePhase
      ;(screen.material as THREE.MeshStandardMaterial).emissiveIntensity =
        0.55 + voicePhase * 0.9

      pMat.opacity = 0.15 + voicePhase * 0.75
      points.scale.setScalar(0.7 + voicePhase * 1.6)
      for (let i = 0; i < COUNT; i++) {
        const a = t * (0.35 + seeds[i] * 0.4) + i * 0.09
        const r = (0.25 + seeds[i] * 0.9) * (0.6 + voicePhase * 1.4)
        posAttr.setXYZ(
          i,
          Math.cos(a) * r,
          Math.sin(a * 1.7) * 0.35 * voicePhase,
          Math.sin(a) * r,
        )
      }
      posAttr.needsUpdate = true

      ledger.visible = ledgerPhase > 0.08
      ledger.position.x = THREE.MathUtils.lerp(2.8, 1.15, ledgerPhase)
      ledger.rotation.y = THREE.MathUtils.lerp(-0.9, -0.22, ledgerPhase)
      ledger.rotation.x = THREE.MathUtils.lerp(0.4, 0.08, ledgerPhase)
      const boardMat = board.material as THREE.MeshStandardMaterial
      boardMat.transparent = true
      boardMat.opacity = ledgerPhase * 0.95
      rowMats.forEach((m, i) => {
        m.transparent = true
        m.opacity = THREE.MathUtils.clamp(ledgerPhase * 1.5 - i * 0.12, 0, 1)
      })

      camera.position.z = THREE.MathUtils.lerp(6.4, 4.6, p)
      camera.position.y = THREE.MathUtils.lerp(0.25, 0.05, p)
      camera.lookAt(0.15, 0.05, 0)

      if (mode === 'ambient') {
        // 応募画面は「電話＋声」寄りの穏やかなループ（台帳面は出さない）
        progress.value = 0.22 + Math.sin(t * 0.18) * 0.05
      }

      renderer.render(scene, camera)
    }
    frame()

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      trigger?.kill()
      renderer.dispose()
      pGeo.dispose()
      pMat.dispose()
      body.geometry.dispose()
      ;(body.material as THREE.Material).dispose()
      screen.geometry.dispose()
      ;(screen.material as THREE.Material).dispose()
      board.geometry.dispose()
      ;(board.material as THREE.Material).dispose()
      soft.geometry.dispose()
      ;(soft.material as THREE.Material).dispose()
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [scrollerRoot, mode])

  return <div className="story-canvas" ref={hostRef} aria-hidden />
}
