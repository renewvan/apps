import { fetchBrokerConfig, signIn } from './hubClient'

const ORIGIN = 'https://van.local'
const ENV_JS =
  'window.__ENV__ = { VITE_MQTT_WS_URL: "/mqtt", VITE_MQTT_USERNAME: "command", VITE_MQTT_PASSWORD: "pw" };'

/** Just enough of a fetch Response for the client. */
function answer(status: number, body = '', headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    text: async () => body,
    json: async () => JSON.parse(body),
  }
}

const fetchMock = jest.fn()
beforeEach(() => {
  fetchMock.mockReset()
  global.fetch = fetchMock as unknown as typeof fetch
})

describe('fetchBrokerConfig', () => {
  it('reads the broker account and resolves /mqtt on the hub', async () => {
    fetchMock.mockResolvedValue(answer(200, ENV_JS))
    expect(await fetchBrokerConfig(ORIGIN)).toEqual({
      ok: true,
      config: { url: 'wss://van.local/mqtt', username: 'command', password: 'pw' },
    })
  })

  // Only an explicit 401 may send the owner back to sign-in; a hub that is down must not.
  it('reads 401 as signed out, and nothing else', async () => {
    fetchMock.mockResolvedValue(answer(401))
    expect(await fetchBrokerConfig(ORIGIN)).toEqual({ ok: false, reason: 'signed-out' })
    fetchMock.mockResolvedValue(answer(502))
    expect(await fetchBrokerConfig(ORIGIN)).toEqual({ ok: false, reason: 'unreachable' })
    fetchMock.mockRejectedValue(new TypeError('Network request failed'))
    expect(await fetchBrokerConfig(ORIGIN)).toEqual({ ok: false, reason: 'unreachable' })
  })

  it('reads a page that is not an env.js as not a hub', async () => {
    fetchMock.mockResolvedValue(answer(200, '<!doctype html><title>Router</title>'))
    expect(await fetchBrokerConfig(ORIGIN)).toEqual({ ok: false, reason: 'not-a-hub' })
  })
})

describe('signIn', () => {
  it('hands the session cookie over for the map', async () => {
    fetchMock.mockResolvedValue(
      answer(200, '{"ok":true}', { 'set-cookie': 'renewvan_session=123.abc; Path=/; HttpOnly' }),
    )
    expect(await signIn(ORIGIN, 'renewvan', 'pw')).toEqual({
      ok: true,
      cookie: 'renewvan_session=123.abc',
    })
  })

  it("shows the login service's own error, and a plain one when unreachable", async () => {
    fetchMock.mockResolvedValue(answer(401, '{"error":"Wrong user or password."}'))
    expect(await signIn(ORIGIN, 'renewvan', 'bad')).toEqual({
      ok: false,
      error: 'Wrong user or password.',
    })
    fetchMock.mockRejectedValue(new TypeError('Network request failed'))
    expect((await signIn(ORIGIN, 'renewvan', 'pw')).ok).toBe(false)
  })
})
