import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/Button'
import {
  MenuIcon,
  PlusIcon,
  SearchIcon,
  SignOutIcon,
  ToothIcon,
  UsersIcon,
} from '@/components/ui/icons'
import { initials } from '@/lib/format'

const NAV = [
  { to: '/patients', label: 'Patients', icon: SearchIcon, end: true },
  { to: '/patients/new', label: 'New patient', icon: PlusIcon, end: false },
  { to: '/users', label: 'Clinic users', icon: UsersIcon, end: false },
]

/**
 * Application frame.
 *
 * The sidebar is permanent from `lg` up for desktop reception use and becomes a slide-over below
 * that, so the same build works chairside on a tablet (SRS §6).
 */
export function AppShell() {
  const { profile, signOutUser } = useAuth()
  const [navOpen, setNavOpen] = useState(false)
  const location = useLocation()

  // Navigating on a tablet should dismiss the slide-over, otherwise it covers the page just opened.
  useEffect(() => setNavOpen(false), [location.pathname])

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
              isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`
          }
        >
          <item.icon className="size-5" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )

  const sidebarBody = (
    <>
      <div className="flex items-center gap-3 px-3 py-5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-white/10 text-aqua">
          <ToothIcon className="size-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-white">Dental Flow</p>
          <p className="text-xs text-white/60">Patient Registry</p>
        </div>
      </div>

      <div className="flex-1 px-3">{nav}</div>

      <div className="border-t border-white/10 px-3 py-4">
        <div className="mb-3 flex items-center gap-3 px-1">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-aqua text-sm font-semibold text-navy">
            {initials(profile?.displayName || profile?.email || '?')}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">
              {profile?.displayName || 'Clinic user'}
            </p>
            <p className="truncate text-xs text-white/60">{profile?.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void signOutUser()}
          className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <SignOutIcon className="size-5" />
          Sign out
        </button>

        {/* The mark is navy, so it needs a light plate to read against the navy sidebar. */}
        <div className="mt-4 flex items-center gap-2.5 px-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white p-1">
            <img src="/favicon.png" alt="" className="size-full object-contain" />
          </span>
          <p className="text-xs leading-tight text-white/40">
            Built by
            <br />
            <span className="font-medium text-white/60">Apex Flow Technologies</span>
          </p>
        </div>
      </div>
    </>
  )

  return (
    <div className="min-h-dvh lg:flex">
      {/* Permanent sidebar — desktop only. */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-navy lg:flex">
        {sidebarBody}
      </aside>

      {/* Slide-over sidebar — tablet and phone. */}
      {navOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-navy-900/50"
            onClick={() => setNavOpen(false)}
          />
          <aside className="relative flex h-full w-64 flex-col bg-navy">{sidebarBody}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-white px-4 py-3 lg:hidden">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Open navigation"
            onClick={() => setNavOpen(true)}
          >
            <MenuIcon />
          </Button>
          <span className="font-semibold text-navy">Dental Flow</span>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
