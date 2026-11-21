import { useEffect, useRef, type RefObject } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import * as THREE from 'three'

gsap.registerPlugin(ScrollTrigger)

type Props = {
  scrollerRoot: RefObject<HTMLElement | null>
  mode?: 'story' | 'ambient'
}

const STILLS = [
  '/media/dining.jpg',
  '/media/phone-counter.jpg',
  '/media/evening-table.jpg',
]

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function loadTexture(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader()
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        tex.minFilter = THREE.LinearFilter
        tex.magFilter = THREE.LinearFilter
        resolve(tex)
      },
      undefined,
      reject,
    )
  })
}

/**
 * 実写プレートをスクロールでクロスフェードするシネマティック背景。
 * 箱電話などのデモ形状は使わない。
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
    const progress = { value: mode === 'ambient' ? 0.35 : 0 }
    const disposables: THREE.Object3D[] = []
    const textures: THREE.Texture[] = []

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
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 40)
    camera.position.set(0, 0, 5.2)

    const planes: THREE.Mesh[] = []
    const mats: THREE.MeshBasicMaterial[] = []

    let dust: THREE.Points | null = null
    let dustAttr: THREE.BufferAttribute | null = null
    const dustSeeds = new Float32Array(180)

    ;(async () => {
      try {
        const loaded = await Promise.all(STILLS.map((u) => loadTexture(u)))
        if (disposed) {
          loaded.forEach((t) => t.dispose())
          return
        }
        textures.push(...loaded)

        loaded.forEach((tex, i) => {
          const aspect = (tex.image as HTMLImageElement).width / (tex.image as HTMLImageElement).height
          const h = 3.55
          const w = h * aspect
          const mat = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            opacity: i === 0 ? 1 : 0,
            depthWrite: false,
          })
          const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat)
          mesh.position.z = -i * 0.08
          scene.add(mesh)
          planes.push(mesh)
          mats.push(mat)
          disposables.push(mesh)
        })

        const dustPos = new Float32Array(180 * 3)
        for (let i = 0; i < 180; i++) {
          dustPos[i * 3] = (Math.random() - 0.5) * 6
          dustPos[i * 3 + 1] = (Math.random() - 0.5) * 4
          dustPos[i * 3 + 2] = Math.random() * 1.5
          dustSeeds[i] = Math.random()
        }
        const geo = new THREE.BufferGeometry()
        dustAttr = new THREE.BufferAttribute(dustPos, 3)
        geo.setAttribute('position', dustAttr)
        const pmat = new THREE.PointsMaterial({
          color: 0xfff7ed,
          size: 0.012,
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
          sizeAttenuation: true,
        })
        dust = new THREE.Points(geo, pmat)
        scene.add(dust)
      } catch {
        if (!disposed) host.dataset.fallback = '1'
      }
    })()

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
        scrub: 0.8,
        onUpdate: (self) => {
          progress.value = self.progress
        },
      })
    }

    const clock = new THREE.Clock()

    function frame() {
      if (disposed) return
      raf = requestAnimationFrame(frame)
      if (document.hidden) return

      const t = clock.getElapsedTime()
      let p = progress.value
      if (mode === 'ambient') {
        p = 0.28 + Math.sin(t * 0.12) * 0.08
      }

      // 3枚を滑らかにクロスフェード
      if (mats.length === 3) {
        const stops = [0, 0.42, 0.78]
        mats.forEach((m, i) => {
          const center = stops[i]
          const dist = Math.abs(p - center)
          const next = stops[i + 1] ?? 1.2
          const prev = stops[i - 1] ?? -0.2
          const span = Math.max(next - center, center - prev)
          m.opacity = THREE.MathUtils.clamp(1 - dist / (span * 0.95), 0, 1)
        })
        planes.forEach((mesh, i) => {
          const drift = (p - i * 0.35) * 0.35
          mesh.position.x = Math.sin(t * 0.08 + i) * 0.04 + drift * 0.15
          mesh.position.y = Math.cos(t * 0.07 + i * 0.5) * 0.03
          mesh.scale.setScalar(1.02 + p * 0.06 + i * 0.01)
        })
      }

      camera.position.x = Math.sin(t * 0.05) * 0.05 + p * 0.12
      camera.position.y = 0.02 + Math.sin(t * 0.07) * 0.03
      camera.position.z = THREE.MathUtils.lerp(5.15, 4.55, p)
      camera.lookAt(0, 0, 0)

      if (dust && dustAttr) {
        for (let i = 0; i < 180; i++) {
          const y = dustAttr.getY(i) + 0.0012 + dustSeeds[i] * 0.001
          dustAttr.setY(i, y > 2.2 ? -2.2 : y)
        }
        dustAttr.needsUpdate = true
        dust.rotation.z = t * 0.01
      }

      renderer.render(scene, camera)
    }
    frame()

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      trigger?.kill()
      disposables.forEach((obj) => {
        const mesh = obj as THREE.Mesh
        mesh.geometry?.dispose()
        const mat = mesh.material
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
        else (mat as THREE.Material | undefined)?.dispose()
      })
      textures.forEach((t) => t.dispose())
      if (dust) {
        dust.geometry.dispose()
        ;(dust.material as THREE.Material).dispose()
      }
      renderer.dispose()
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [scrollerRoot, mode])

  return <div className="story-canvas" ref={hostRef} aria-hidden />
}
