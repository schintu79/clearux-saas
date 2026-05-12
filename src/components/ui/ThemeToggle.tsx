'use client'

import React from 'react'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'
import clsx from 'clsx'

interface ThemeToggleProps {
  /** 'pill' for navbar, 'icon' for a minimal button */
  variant?: 'pill' | 'icon'
  className?: string
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ variant = 'icon', className }) => {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  if (variant === 'pill') {
    return (
      <button
        onClick={toggleTheme}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        className={clsx(
          'relative flex items-center w-14 h-7 rounded-full p-0.5 transition-colors duration-300',
          isDark ? 'bg-white/15 border border-white/20' : 'bg-gray-100 border border-gray-300',
          className
        )}
      >
        <span
          className={clsx(
            'flex items-center justify-center w-6 h-6 rounded-full transition-all duration-300 shadow-sm',
            isDark
              ? 'translate-x-7 bg-white text-gray-900 shadow-md'
              : 'translate-x-0 bg-gray-800 text-white shadow-md'
          )}
        >
          {isDark ? <Moon size={13} /> : <Sun size={13} />}
        </span>
      </button>
    )
  }

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={clsx(
        'p-2 rounded-lg transition-colors duration-200 hover:bg-black/[0.04]',
        className
      )}
      style={{ color: 'var(--m-muted)' }}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}

export default ThemeToggle
