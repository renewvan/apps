import { describe, expect, it } from 'vite-plus/test'
import { ringColor } from './ringColor'

describe('ringColor', () => {
  it('paints ok with the accent, bad with the danger colour and alert with amber-500', () => {
    expect(ringColor('ok')).toBe('var(--accent)')
    expect(ringColor('alert')).toBe('#f59e0b')
    expect(ringColor('bad')).toBe('var(--danger)')
  })
})
