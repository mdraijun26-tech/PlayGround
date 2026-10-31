import * as THREE from '../vendor/three.module.js'

/**
 * Merge a list of BufferGeometries into one non-indexed geometry.
 * All inputs must share the same attributes (three.js primitives do).
 */
export function mergeGeometries(geometries) {
  const flat = geometries.map((g) => (g.index ? g.toNonIndexed() : g))
  if (!flat.length) return new THREE.BufferGeometry()
  const merged = new THREE.BufferGeometry()
  for (const name of ['position', 'normal', 'uv']) {
    if (!flat[0].attributes[name]) continue
    const total = flat.reduce((sum, g) => sum + g.attributes[name].count, 0)
    const itemSize = flat[0].attributes[name].itemSize
    const ArrayType = flat[0].attributes[name].array.constructor
    const array = new ArrayType(total * itemSize)
    let offset = 0
    for (const g of flat) {
      array.set(g.attributes[name].array, offset)
      offset += g.attributes[name].array.length
    }
    merged.setAttribute(name, new THREE.BufferAttribute(array, itemSize))
  }
  return merged
}

/**
 * Collapse the direct mesh children of a Group into one mesh per material.
 * Sprites, multi-material meshes, and anything rejected by `keep` are left
 * untouched. `keep` receives each child and returns false to skip it.
 */
export function mergeGroupByMaterial(group, keep = null) {
  const buckets = new Map()
  const children = [...group.children]
  for (const child of children) {
    if (!child.isMesh || Array.isArray(child.material)) continue
    if (keep && !keep(child)) continue
    child.updateMatrix()
    const geometry = child.geometry.clone().applyMatrix4(child.matrix)
    const key = child.material.uuid
    if (!buckets.has(key)) buckets.set(key, { material: child.material, geometries: [] })
    buckets.get(key).geometries.push(geometry)
    group.remove(child)
  }
  for (const { material, geometries } of buckets.values()) {
    group.add(new THREE.Mesh(mergeGeometries(geometries), material))
  }
}

/**
 * Return a non-indexed copy of a box geometry containing only the triangles
 * whose face normal satisfies `test(nx, ny, nz)`. Used to split a box into
 * groups of walls that can share one material / draw call.
 */
export function extractFaces(geometry, test) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry
  const position = source.attributes.position
  const normal = source.attributes.normal
  const uv = source.attributes.uv
  const positions = []
  const normals = []
  const uvs = []
  for (let i = 0; i < position.count; i += 3) {
    const nx = normal.getX(i)
    const ny = normal.getY(i)
    const nz = normal.getZ(i)
    if (!test(nx, ny, nz)) continue
    for (let k = 0; k < 3; k++) {
      positions.push(position.getX(i + k), position.getY(i + k), position.getZ(i + k))
      normals.push(normal.getX(i + k), normal.getY(i + k), normal.getZ(i + k))
      if (uv) uvs.push(uv.getX(i + k), uv.getY(i + k))
    }
  }
  const result = new THREE.BufferGeometry()
  result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  result.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  if (uvs.length) result.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  return result
}
