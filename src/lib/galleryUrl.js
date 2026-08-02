// ローカルで起動しているギャラリーの URL。
// ギャラリーは gallery/vite.config.js で 5175 に固定している
// （.claude/launch.json の gallery 設定も同じポート）。
// 別のポートで動かす場合は VITE_GALLERY_URL で上書きする。
export const galleryUrl = import.meta.env.VITE_GALLERY_URL || 'http://localhost:5175'
