// クライアント描画のカードPNGは prompt='card' で記録されている。
// ギャラリーには AI 生成画像のみを載せるため、ここで除外する。
export function buildManifest(rows) {
  return rows
    .filter((r) => r.prompt !== 'card')
    .map((r) => ({
      id: r.id,
      name: r.name,
      title: r.title,
      image: r.imagePath,
      createdAt: r.createdAt,
      gachaId: r.gachaId,
    }))
}
