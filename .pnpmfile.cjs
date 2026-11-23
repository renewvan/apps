// The mobile app never renders to the DOM, yet Expo, expo-router and the Radix/vaul packages it
// pulls in for the web declare `react-dom` as a peer. Alone, mobile left it out (see
// pnpm-workspace.yaml). In this workspace pnpm would hand them the dashboard's react-dom instead:
// one that wants a newer React than Expo pins, and whose version then appears in the names of
// mobile's native packages in node_modules/.pnpm, which the app's runtime fingerprint hashes. So
// those peers are dropped here, for the packages only the mobile app uses.
const MOBILE_ONLY = /^(expo|expo-router|@expo\/.+|@radix-ui\/.+|vaul)$/
const WEB_ONLY_PEERS = ['react-dom', '@types/react-dom']

function readPackage(pkg) {
  if (MOBILE_ONLY.test(pkg.name)) {
    for (const peer of WEB_ONLY_PEERS) {
      if (pkg.peerDependencies) delete pkg.peerDependencies[peer]
      if (pkg.peerDependenciesMeta) delete pkg.peerDependenciesMeta[peer]
    }
  }
  return pkg
}

module.exports = { hooks: { readPackage } }
