import { lazy, Suspense, type RefObject } from 'react'

const ScrollLedgerCanvas = lazy(() =>
  import('./ScrollLedgerCanvas').then((m) => ({ default: m.ScrollLedgerCanvas })),
)

type Props = {
  scrollerRoot: RefObject<HTMLElement | null>
}

export function ScrollStage({ scrollerRoot }: Props) {
  return (
    <Suspense fallback={<div className="sx-canvas" data-fallback="1" aria-hidden />}>
      <ScrollLedgerCanvas scrollerRoot={scrollerRoot} />
    </Suspense>
  )
}
