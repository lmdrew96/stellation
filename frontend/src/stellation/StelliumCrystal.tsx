import type { ThreeEvent } from '@react-three/fiber'
import { useMemo } from 'react'
import type { PointerDownRef } from './clickVsDrag'
import { recordPointerDown, wasDrag } from './clickVsDrag'
import { CrystalMaterial } from './CrystalMaterial'
import type { StelliumSpec } from './stellatedSphere'
import { buildStelliumPlateaus } from './stelliumPlateauLayout'

interface StelliumCrystalProps {
  stellium: StelliumSpec
  pointerDownAt: PointerDownRef
  onSelect: () => void
}

// Stellium's own crystal shape - a main flat-topped hexagonal prism plus a
// couple of shorter, skinnier companions sharing its base (Beryl's
// tabular habit - see stelliumPlateauLayout.ts), a deliberate contrast to
// every other pattern's fan of pointed quartz-style shards
// (CrystalCluster.tsx): a Stellium is one solid mass of banded planets,
// not a spiky point.
export function StelliumCrystal({ stellium, pointerDownAt, onSelect }: StelliumCrystalProps) {
  const plateaus = useMemo(
    () => buildStelliumPlateaus(stellium.center, stellium.memberCount, stellium.moundHeight, stellium.moundAngularRadius),
    [stellium]
  )

  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation()
    if (wasDrag(pointerDownAt, event)) return
    onSelect()
  }

  function handlePointerOver() {
    document.body.style.cursor = 'pointer'
  }

  function handlePointerOut() {
    document.body.style.cursor = 'auto'
  }

  return (
    <>
      {plateaus.map((plateau, index) => (
        <mesh
          key={index}
          geometry={plateau.geometry}
          position={plateau.position}
          quaternion={plateau.quaternion}
          onPointerDown={recordPointerDown(pointerDownAt)}
          onClick={handleClick}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <CrystalMaterial color={stellium.color} />
        </mesh>
      ))}
    </>
  )
}
