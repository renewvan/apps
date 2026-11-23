// The web-platform globals core uses that every client has (browsers, React Native, Node) but
// TypeScript's ES lib does not declare, kept to the members core reads. Only core's own type check
// reads this file: each app compiles core's source against its own, fuller declarations.

/** WHATWG `URL`: `hubAddress` parses a broker URL's host with it. */
declare class URL {
  constructor(url: string, base?: string)
  readonly hostname: string
}
