import type { ThreeEvent } from '@react-three/fiber'
import { useMemo } from 'react'
import type { PointerDownRef } from './clickVsDrag'
import { recordPointerDown, wasDrag } from './clickVsDrag'
import { CrystalMaterial } from './CrystalMaterial'
import { buildClusterShards, CLUSTER_SIZES } from './crystalClusterLayout'
import type { ClusterSpec } from './stellatedSphere'

interface CrystalClusterProps {
  cluster: ClusterSpec
  pointerDownAt: PointerDownRef
  onSelect: () => void
}

// A fan of separate glassy shard meshes growing out of the pattern's
// mound - see crystalCluster.ts for the placement math and the ChaosPatch
// notes on why this replaced a single deformed-mesh spike (a shared
// surface can't produce several distinct, differently-angled crystals in
// one spot; only actual separate solids can).
export function CrystalCluster({ cluster, pointerDownAt, onSelect }: CrystalClusterProps) {
  const shards = useMemo(
    () =>
      buildClusterShards(
        cluster.center,
        CLUSTER_SIZES[cluster.size],
        cluster.moundHeight,
        cluster.moundAngularRadius
      ),
    [cluster]
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
      {shards.map((shard, index) => (
        <mesh
          key={index}
          geometry={shard.geometry}
          position={shard.position}
          quaternion={shard.quaternion}
          onPointerDown={recordPointerDown(pointerDownAt)}
          onClick={handleClick}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <CrystalMaterial color={cluster.color} />
        </mesh>
      ))}
    </>
  )
}
