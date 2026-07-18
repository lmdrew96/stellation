interface CrystalMaterialProps {
  color: string
}

// Shared glassy-gem material for every crystal in the scene (pattern
// clusters, single aspect shards, Stellium's plateau). Transmission is
// kept moderate rather than near-1 (pure glass) - a facet pointed straight
// at the camera would otherwise collapse to see-through, since Fresnel
// reflectance is lowest at normal incidence.
export function CrystalMaterial({ color }: CrystalMaterialProps) {
  return (
    <meshPhysicalMaterial
      color={color}
      flatShading
      roughness={0.12}
      metalness={0}
      transmission={0.4}
      thickness={0.8}
      ior={1.5}
      clearcoat={1}
      clearcoatRoughness={0.08}
    />
  )
}
