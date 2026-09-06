'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ConnectWalletButton } from './wallet/ConnectWalletButton'
import { Icon } from './Icon'

export function NavBar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const links = [
    {
      href: '/agents',
      label: '探索服務',
      active: pathname.startsWith('/agents') && pathname !== '/agents/new',
    },
    {
      href: '/sessions',
      label: '我的紀錄',
      active: pathname.startsWith('/sessions') || pathname.startsWith('/session/'),
    },
    { href: '/settings', label: '我的錢包', active: pathname === '/settings' },
    {
      href: '/studio',
      label: '達人工作室',
      active: pathname === '/studio' || pathname === '/agents/new',
    },
  ]
  return (
    <header className="site-header">
      <nav className="site-nav" aria-label="主要導覽">
        <Link href="/" className="wordmark" aria-label="分身有術，回首頁">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
          </span>
          分身有術
        </Link>
        <div className="nav-links">
          {links.map((link) => (
            <Link key={link.href} href={link.href} aria-current={link.active ? 'page' : undefined}>
              {link.label}
            </Link>
          ))}
        </div>
        <div className="nav-actions">
          <details className="wallet-menu">
            <summary>錢包連線</summary>
            <div className="wallet-panel">
              <h2>我的錢包</h2>
              <ConnectWalletButton />
              <Link href="/settings" className="text-link">
                開啟我的錢包
                <Icon />
              </Link>
            </div>
          </details>
          <button
            className="mobile-toggle"
            type="button"
            aria-label={open ? '關閉選單' : '開啟選單'}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen(!open)}
          >
            <Icon name={open ? 'close' : 'menu'} />
          </button>
        </div>
      </nav>
      {open && (
        <nav id="mobile-nav" className="mobile-nav" aria-label="手機導覽">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={link.active ? 'page' : undefined}
              onClick={() => setOpen(false)}
            >
              {link.label}
              <Icon />
            </Link>
          ))}
          <Link href="/agents/new" onClick={() => setOpen(false)}>
            上架我的服務
            <Icon name="plus" />
          </Link>
        </nav>
      )}
    </header>
  )
}
