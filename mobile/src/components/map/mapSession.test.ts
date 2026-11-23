import { sessionUrlPattern } from './mapSession'

// The native map module is not loaded in tests; jest hoists this above the import.
jest.mock('@maplibre/maplibre-react-native', () => ({ TransformRequestManager: {} }))

describe('sessionUrlPattern', () => {
  const matches = (url: string) => new RegExp(sessionUrlPattern('https://192.168.1.5')).test(url)

  it("matches the hub's own requests", () => {
    expect(matches('https://192.168.1.5/maps/basemap.pmtiles')).toBe(true)
    expect(matches('https://192.168.1.5')).toBe(true)
  })

  it('never matches another host that merely contains the origin', () => {
    expect(matches('https://192.168.1.50/maps/basemap.pmtiles')).toBe(false)
    expect(matches('https://192.168.1.5.evil.example/x')).toBe(false)
    expect(matches('https://tiles.example/?u=https://192.168.1.5/')).toBe(false)
  })

  it('treats the dots of the origin as dots', () => {
    expect(matches('https://192x168.1.5/maps')).toBe(false)
  })
})
