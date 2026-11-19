import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test'
import { stubMatchMedia, type MatchMediaStub } from '@/test/matchMedia'
import { useTheme } from './useTheme'

const STORAGE_KEY = 'renewvan-dashboard-theme'

describe('useTheme', () => {
  let device: MatchMediaStub

  beforeEach(() => {
    window.localStorage.clear()
    delete document.documentElement.dataset.theme
    device = stubMatchMedia(800)
  })

  afterEach(() => {
    device.restore()
    window.localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  it('defaults to dark and marks the document element', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current[0]).toBe('dark')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('dark')
  })

  it('applies a saved theme on load', () => {
    window.localStorage.setItem(STORAGE_KEY, 'light')
    const { result } = renderHook(() => useTheme())
    expect(result.current[0]).toBe('light')
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  })

  it('falls back to dark for an unrecognised saved value', () => {
    window.localStorage.setItem(STORAGE_KEY, 'sepia')
    const { result } = renderHook(() => useTheme())
    expect(result.current[0]).toBe('dark')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  })

  it('updates the document element and storage when the theme changes', () => {
    const { result } = renderHook(() => useTheme())
    act(() => result.current[1]('light'))
    expect(result.current[0]).toBe('light')
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('light')
  })

  it('draws a saved System as the device colour scheme, keeping System as the choice', () => {
    window.localStorage.setItem(STORAGE_KEY, 'system')
    device.setPrefersDark(true)
    const dark = renderHook(() => useTheme())
    expect(dark.result.current[0]).toBe('system')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    dark.unmount()

    device.setPrefersDark(false)
    renderHook(() => useTheme())
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('system')
  })

  it('follows the device while System is chosen', () => {
    window.localStorage.setItem(STORAGE_KEY, 'system')
    renderHook(() => useTheme())
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')

    act(() => device.setPrefersDark(true))
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    act(() => device.setPrefersDark(false))
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  })

  it('stops following the device once a fixed theme is picked', () => {
    window.localStorage.setItem(STORAGE_KEY, 'system')
    device.setPrefersDark(true)
    const { result } = renderHook(() => useTheme())
    act(() => result.current[1]('light'))
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')

    act(() => device.setPrefersDark(false))
    act(() => device.setPrefersDark(true))
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('light')
  })
})
