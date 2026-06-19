export function buildManifest(rows) {
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    title: r.title,
    image: r.imagePath,
    createdAt: r.createdAt,
  }))
}
