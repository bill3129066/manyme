import type { Metadata } from 'next'
import { Noto_Sans_TC } from 'next/font/google'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import './globals.css'
import { NavBar } from '@/components/NavBar'

const Providers = dynamic(
  () => import('./providers').then(mod => ({ default: mod.Providers })),
  { ssr: false }
)

const bodyFont = Noto_Sans_TC({ subsets: ['latin'], variable: '--font-body', weight: ['400', '500', '600', '700', '800', '900'], display: 'swap' })

export const metadata: Metadata = {
  title: 'ManyMe 分身有術 — 按需使用達人經驗',
  description: '讓人們按需使用達人經驗的 AI 服務市集。攻略我看過了,但我家不是範例家庭。',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-Hant">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${bodyFont.variable} font-sans min-h-screen bg-background text-text-primary`}
        suppressHydrationWarning
      >
        <Providers>
          <div className="flex flex-col min-h-screen">
            <a href="#main-content" className="skip-link">跳到主要內容</a>
            <NavBar />
            <main id="main-content" className="flex-grow w-full">
              {children}
            </main>
            <footer className="site-footer page-width"><Link href="/" className="footer-brand">分身有術<span>讓好建議，不必靠人脈。</span></Link><div><Link href="/agents">探索服務</Link><Link href="/agents/new">上架服務</Link><Link href="/settings">付款與預算</Link><Link href="/query">單次查詢</Link></div><p>目前使用 Base Sepolia 測試網與 test USDC。</p></footer>
          </div>
        </Providers>
      </body>
    </html>
  )
}
