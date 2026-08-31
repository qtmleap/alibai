import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import appCss from '@/client/index.css?url'

/**
 * HTML の殻。index.html を置く代わりに、ここがドキュメント全体を描く。
 *
 * lang="ja" と viewport-fit=cover は index.html から引き継いだもの。
 * 後者はノッチのある端末で画面の端まで背景を塗るために要る。
 *
 * component を書いていないのは既定が <Outlet /> だから。ここに置くのは
 * 全ページ共通の殻だけにして、画面そのものは子ルートに任せる。
 */
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'UTF-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1.0, viewport-fit=cover' },
      { title: 'AlibAI' },
      // ホーム画面から開いたときブラウザの殻を外す。display: standalone を読まない
      // 古い iOS はこの2枚だけが頼りで、black-translucent は
      // viewport-fit=cover と対で効く（時計の下まで墨で塗る）。
      { name: 'theme-color', content: '#141317' },
      { name: 'mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
    ],
    links: [
      { rel: 'manifest', href: '/manifest.webmanifest' },
      { rel: 'icon', href: '/icon.svg', type: 'image/svg+xml' },
      // マニフェストの icons を読まない古い iOS 用。
      { rel: 'apple-touch-icon', href: '/icon-192.png' },
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  shellComponent: ({ children }: { children: ReactNode }) => (
    <html lang="ja">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  ),
})
