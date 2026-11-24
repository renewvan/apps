import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { renderSettings } from '@/test/renderSettings'

const NOTICES = '@/data/notices.generated'

afterEach(() => {
  vi.doUnmock(NOTICES)
  vi.resetModules()
})

// One file per case: the module loader keeps a mocked import for the rest of a file (a failing one,
// or one that never settles), so a later test importing it would get the earlier test's module,
// and the cases only passed in one order.
describe('About when its licences do not load', () => {
  it('shows a quiet failure note, and the credits are still there', async () => {
    vi.doMock(NOTICES, () => {
      throw new Error('chunk failed to load')
    })

    renderSettings({}, { url: '/?page=settings&view=about' })

    expect(
      await screen.findByText('The software licences could not be loaded.'),
    ).toBeInTheDocument()
    expect(screen.getByText('© OpenStreetMap contributors')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Software licences' })).not.toBeInTheDocument()
  })
})
