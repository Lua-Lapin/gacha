// ローカルで起動しているギャラリーの URL。
// メインのフロントが 5173 を使うため、`npm run gallery:dev` は 5174 にフォールバックする。
// 別のポートで動かす場合は VITE_GALLERY_URL で上書きする。
export const galleryUrl = import.meta.env.VITE_GALLERY_URL ?? 'http://localhost:5174'
