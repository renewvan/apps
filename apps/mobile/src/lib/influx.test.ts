import { queryInflux } from './influx'

const ORIGIN = 'https://van.local'

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

describe('queryInflux', () => {
  it('posts the query to the hub proxy and parses the CSV', async () => {
    fetchMock.mockResolvedValue(
      answer(200, ',result,table,_time,_value\r\n,_result,0,2026-11-17T10:00:00Z,812\r\n', {
        'content-type': 'text/csv; charset=utf-8',
      }),
    )
    const points = await queryInflux(ORIGIN, 'from(bucket: "renewvan")')
    expect(fetchMock.mock.calls[0][0]).toBe(`${ORIGIN}/influx/api/v2/query?org=renewvan`)
    expect(points).toEqual([{ time: new Date('2026-11-17T10:00:00Z'), value: 812 }])
  })

  it('refuses a 200 that is not CSV, so a login page never reads as an empty history', async () => {
    fetchMock.mockResolvedValue(answer(200, '<html>', { 'content-type': 'text/html' }))
    await expect(queryInflux(ORIGIN, 'q')).rejects.toThrow('did not answer with InfluxDB CSV')
  })
})
