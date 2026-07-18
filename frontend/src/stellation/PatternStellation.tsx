import { useMemo } from 'react'
import type { RefObject } from 'react'
import type { Mesh } from 'three'
import type { ChartData, Pattern } from '../types'
import type { PointerDownRef } from './clickVsDrag'
import { CrystalCluster } from './CrystalCluster'
import { buildAspectBulgeSpecs, buildBulgeSpecs, buildClusterSpecs, buildStellatedGeometry } from './stellatedSphere'

interface PatternStellationProps {
  chart: ChartData
  onSelectPattern: (pattern: Pattern, key: string) => void
  meshRef: RefObject<Mesh>
  pointerDownAt: PointerDownRef
}

// The globe itself (sphere + aspect studs + every pattern's small growth
// mound) is one continuous deformed mesh (see stellatedSphere.ts) and is
// purely decorative now - the dramatic, clickable shape for each pattern
// is an actual crystal cluster of separate shard meshes growing out of
// its mound (see CrystalCluster.tsx), not a deformation of this shared
// surface. flatShading (see the material below) is what sells "gem-cut
// facets" for the base globe - it computes each triangle's own face
// normal on the fly, so it works on this geometry with no extra vertex
// duplication needed.
export function PatternStellation({ chart, onSelectPattern, meshRef, pointerDownAt }: PatternStellationProps) {
  const bulges = useMemo(() => [...buildBulgeSpecs(chart), ...buildAspectBulgeSpecs(chart)], [chart])
  const geometry = useMemo(() => buildStellatedGeometry(bulges), [bulges])
  const clusters = useMemo(() => buildClusterSpecs(chart), [chart])

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
    </>
  )
}
