import { screen, within } from '@testing-library/react'
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
describe('About while its licences load', () => {
  it('shows a quiet loading note while they load, and the credits are already there', async () => {
    vi.doMock(NOTICES, () => new Promise(() => {}))

    renderSettings({}, { url: '/?page=settings&view=about' })

    const software = screen.getByRole('heading', { name: 'Software' }).parentElement!
    expect(within(software).getByText('Loading…')).toBeInTheDocument()
    expect(screen.getByText('© OpenStreetMap contributors')).toBeInTheDocument()
  })
})
