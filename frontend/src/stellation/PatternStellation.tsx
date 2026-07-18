import { useMemo } from 'react'
import type { RefObject } from 'react'
import type { Mesh } from 'three'
import type { ChartData, Pattern } from '../types'
import type { PointerDownRef } from './clickVsDrag'
import { CrystalCluster } from './CrystalCluster'
import { buildBulgeSpecs, buildClusterSpecs, buildStelliumSpecs, buildStellatedGeometry } from './stellatedSphere'
import { StelliumCrystal } from './StelliumCrystal'

interface PatternStellationProps {
  chart: ChartData
  onSelectPattern: (pattern: Pattern, key: string) => void
  meshRef: RefObject<Mesh>
  pointerDownAt: PointerDownRef
}

// The globe itself (sphere + every named pattern's small growth mound) is
// one continuous deformed mesh (see stellatedSphere.ts) and is purely
// decorative now - the dramatic, clickable shape for each pattern is an
// actual crystal solid growing out of its mound, not a deformation of this
// shared surface: a fan of pointed shards for most patterns
// (CrystalCluster.tsx), a single flat-topped Beryl-style plateau for
// Stellium (StelliumCrystal.tsx). Every real aspect gets its own solid
// shard too (AspectShards.tsx), rendered as a sibling in StellationScene
// rather than here since it doesn't need this mesh's mound underneath it.
// flatShading (see the material below) is what sells "gem-cut facets" for
// the base globe - it computes each triangle's own face normal on the
// fly, so it works on this geometry with no extra vertex duplication
// needed.
export function PatternStellation({ chart, onSelectPattern, meshRef, pointerDownAt }: PatternStellationProps) {
  const bulges = useMemo(() => buildBulgeSpecs(chart), [chart])
  const geometry = useMemo(() => buildStellatedGeometry(bulges), [bulges])
  const clusters = useMemo(() => buildClusterSpecs(chart), [chart])
  const stelliums = useMemo(() => buildStelliumSpecs(chart), [chart])

  return (
    <>
      <mesh ref={meshRef} geometry={geometry}>
        <meshPhysicalMaterial
          vertexColors
          flatShading
          roughness={0.25}
          metalness={0.1}
          clearcoat={0.6}
          clearcoatRoughness={0.2}
        />
      </mesh>
      {clusters.map((cluster, index) => (
        <CrystalCluster
          key={`${cluster.key}-${index}`}
          cluster={cluster}
          pointerDownAt={pointerDownAt}
          onSelect={() => onSelectPattern(cluster.pattern, cluster.key)}
        />
      ))}
      {stelliums.map((stellium, index) => (
        <StelliumCrystal
          key={`${stellium.key}-${index}`}
          stellium={stellium}
          pointerDownAt={pointerDownAt}
          onSelect={() => onSelectPattern(stellium.pattern, stellium.key)}
        />
      ))}
    </>
  )
}
