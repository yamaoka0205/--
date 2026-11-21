import { lazy, Suspense, type RefObject } from 'react'

const ScrollHeroCanvas = lazy(() =>
  import('./ScrollHeroCanvas').then((m) => ({ default: m.ScrollHeroCanvas })),
)

type Props = {
  scrollerRoot: RefObject<HTMLElement | null>
  mode?: 'story' | 'ambient'
  className?: string
}

/** HTML を先に出し、Three.js は後から読み込む（Core Web Vitals 向け）。 */
export function ScrollStage({ scrollerRoot, mode = 'story', className }: Props) {
  return (
    <div className={className ?? 'story-stage'} aria-hidden>
      <Suspense fallback={<div className="story-canvas" data-fallback="1" />}>
        <ScrollHeroCanvas scrollerRoot={scrollerRoot} mode={mode} />
      </Suspense>
      <div className="story-veil" />
    </div>
  )
}
