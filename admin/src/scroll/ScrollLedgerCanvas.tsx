import { useEffect, useRef, type RefObject } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import * as THREE from 'three'

gsap.registerPlugin(ScrollTrigger)

type Props = {
  scrollerRoot: RefObject<HTMLElement | null>
}

type Part = {
  mesh: THREE.Object3D
  home: THREE.Vector3
  exploded: THREE.Vector3
  homeRot: THREE.Euler
  explodedRot: THREE.Euler
}

/**
 * Amazing OTOWA 型: プロダクトのコードモデリング + スクロール分解／再結合。
 * よやく台帳向けの実物モデル = 台帳タブレット + 予約行 + 電話。
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
    const mount = host

    const canvas = document.createElement('canvas')
    mount.appendChild(canvas)

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      })
    } catch {
      mount.dataset.fallback = '1'
      mount.removeChild(canvas)
      return
    }

    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 1.75))
    renderer.outputColorSpace = THREE.SRGBColorSpace

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40)
    camera.position.set(0.15, 0.2, 7.2)

    scene.add(new THREE.AmbientLight(0xffffff, 0.72))
    const key = new THREE.DirectionalLight(0xffffff, 1.2)
    key.position.set(3.2, 4.8, 3.2)
    const fill = new THREE.DirectionalLight(0x99f6e4, 0.55)
    fill.position.set(-3.4, 1.2, -1.5)
    const rim = new THREE.DirectionalLight(0xcbd5e1, 0.35)
    rim.position.set(0.4, -2.2, -3)
    scene.add(key, fill, rim)

    const product = new THREE.Group()
    scene.add(product)

    const white = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      metalness: 0.08,
      roughness: 0.42,
    })
    const slate = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.12,
      roughness: 0.55,
    })
    const ink = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.2,
      roughness: 0.5,
    })
    const teal = new THREE.MeshStandardMaterial({
      color: 0x0f766e,
      metalness: 0.25,
      roughness: 0.4,
    })
    const phoneBlue = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      metalness: 0.15,
      roughness: 0.45,
    })

    // —— 台帳本体（タブレット） ——
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.55, 3.2, 0.12), white)
    product.add(body)
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(2.62, 3.27, 0.04), slate)
    bezel.position.z = -0.08
    product.add(bezel)
    const chrome = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.28, 0.02), slate)
    chrome.position.set(0, 1.38, 0.07)
    product.add(chrome)
    const dotColors = [0xf87171, 0xfbbf24, 0x34d399]
    for (let i = 0; i < 3; i++) {
      const dot = new THREE.Mesh(
        new THREE.CircleGeometry(0.035, 16),
        new THREE.MeshStandardMaterial({ color: dotColors[i], roughness: 0.5 }),
      )
      dot.position.set(-1.05 + i * 0.12, 1.38, 0.085)
      product.add(dot)
    }

    const parts: Part[] = []
    function addPart(
      mesh: THREE.Object3D,
      home: THREE.Vector3,
      exploded: THREE.Vector3,
      explodedRot: THREE.Euler,
    ) {
      mesh.position.copy(exploded)
      mesh.rotation.copy(explodedRot)
      product.add(mesh)
      parts.push({
        mesh,
        home,
        exploded,
        homeRot: new THREE.Euler(0, 0, 0),
        explodedRot,
      })
    }

    // —— 予約行（分解パーツ） ——
    const rowMats = [
      new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.04, roughness: 0.65 }),
      new THREE.MeshStandardMaterial({ color: 0xdbeafe, metalness: 0.04, roughness: 0.55 }),
      new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.04, roughness: 0.65 }),
      new THREE.MeshStandardMaterial({ color: 0xccfbf1, metalness: 0.04, roughness: 0.6 }),
    ]
    const rowExplode = [
      new THREE.Vector3(-1.85, 1.55, 1.1),
      new THREE.Vector3(2.05, 0.95, 1.35),
      new THREE.Vector3(-1.55, -0.75, 1.25),
      new THREE.Vector3(1.75, -1.45, 0.95),
    ]
    for (let i = 0; i < 4; i++) {
      const row = new THREE.Group()
      const plate = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.38, 0.05), rowMats[i])
      row.add(plate)
      const timeChip = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.03), ink)
      timeChip.position.set(-0.72, 0, 0.04)
      row.add(timeChip)
      const count = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 20), teal)
      count.rotation.x = Math.PI / 2
      count.position.set(-0.28, 0, 0.04)
      row.add(count)
      addPart(
        row,
        new THREE.Vector3(0, 0.85 - i * 0.52, 0.1),
        rowExplode[i],
        new THREE.Euler((Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 1.1, (Math.random() - 0.5) * 0.5),
      )
    }

    // —— 電話（着信元） ——
    const phone = new THREE.Group()
    const phoneBody = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.05, 0.08), ink)
    phone.add(phoneBody)
    const phoneScreen = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.78, 0.02), phoneBlue)
    phoneScreen.position.z = 0.05
    phone.add(phoneScreen)
    const phoneEar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.02), slate)
    phoneEar.position.set(0, 0.42, 0.05)
    phone.add(phoneEar)
    addPart(
      phone,
      new THREE.Vector3(-1.85, 0.15, 0.55),
      new THREE.Vector3(-2.8, 1.6, 1.8),
      new THREE.Euler(0.55, -0.8, 0.35),
    )

    // —— 着信リング（薄い円、電話まわり） ——
    const rings: THREE.Mesh[] = []
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.55 + i * 0.22, 0.012, 8, 48),
        new THREE.MeshStandardMaterial({
          color: 0x2dd4bf,
          transparent: true,
          opacity: 0.35 - i * 0.08,
          metalness: 0.1,
          roughness: 0.4,
        }),
      )
      ring.rotation.x = Math.PI / 2.4
      product.add(ring)
      rings.push(ring)
    }

    const view = {
      assemble: 0,
      settle: 0,
      phoneIn: 0,
      orbit: 0,
      zoom: 0,
    }

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
        scrub: 0.75,
      },
    })
    // ヒーロー: 分解された状態で見せる → スクロールで台帳に組み上がる
    scrollTl
      .to(view, { phoneIn: 1, duration: 0.18 }, 0)
      .to(view, { assemble: 1, duration: 0.28 }, 0.16)
      .to(view, { settle: 1, orbit: 0.35, duration: 0.2 }, 0.42)
      .to(view, { zoom: 1, orbit: 0.7, duration: 0.22 }, 0.62)
      .to(view, { orbit: 1, duration: 0.16 }, 0.84)

    root.querySelectorAll('[data-reveal]').forEach((el) => {
      gsap.fromTo(
        el,
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
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
      const a = view.assemble
      const s = view.settle

      parts.forEach((part, i) => {
        // 電話は少し遅れて近づく
        const local = i === parts.length - 1 ? Math.min(1, a * 0.85 + view.phoneIn * 0.35) : a
        part.mesh.position.lerpVectors(part.exploded, part.home, local)
        part.mesh.rotation.x = THREE.MathUtils.lerp(part.explodedRot.x, part.homeRot.x, local)
        part.mesh.rotation.y = THREE.MathUtils.lerp(part.explodedRot.y, part.homeRot.y, local)
        part.mesh.rotation.z = THREE.MathUtils.lerp(part.explodedRot.z, part.homeRot.z, local)
      })

      // 電話の着信リングは組み立て前〜電話接近時に強く
      const ringStrength = (1 - a) * 0.55 + view.phoneIn * (1 - s) * 0.45
      rings.forEach((ring, i) => {
        const mat = ring.material as THREE.MeshStandardMaterial
        mat.opacity = Math.max(0, ringStrength * (0.4 - i * 0.1))
        ring.visible = mat.opacity > 0.02
        const phonePart = parts[parts.length - 1]
        ring.position.copy(phonePart.mesh.position)
        ring.scale.setScalar(1 + i * 0.08 + Math.sin(t * 2.2 + i) * 0.04)
        ring.rotation.z = t * (0.4 + i * 0.15)
      })

      product.rotation.y =
        THREE.MathUtils.lerp(-0.55, -0.22, a) +
        view.orbit * 0.55 +
        Math.sin(t * 0.35) * 0.025
      product.rotation.x = THREE.MathUtils.lerp(0.38, 0.1, a) - view.zoom * 0.05
      product.position.x = isMobile
        ? THREE.MathUtils.lerp(0.05, 0.1, s)
        : THREE.MathUtils.lerp(1.15, 1.35, s)
      product.position.y = (isMobile ? -0.55 : 0.05) + Math.sin(t * 0.45) * 0.03
      product.scale.setScalar((isMobile ? 0.78 : 0.98) + s * 0.08 + view.zoom * 0.06)

      camera.position.z = THREE.MathUtils.lerp(7.4, 5.6, a * 0.7 + view.zoom * 0.3)
      camera.lookAt(isMobile ? 0.05 : 0.9, isMobile ? -0.35 : 0.05, 0)
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
      product.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose()
          const mat = obj.material
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
          else mat.dispose()
        }
      })
      renderer.dispose()
      if (canvas.parentElement === mount) mount.removeChild(canvas)
    }
  }, [scrollerRoot])

  return <div className="sx-canvas" ref={hostRef} aria-hidden />
}
