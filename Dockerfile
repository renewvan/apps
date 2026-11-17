# `dist/` is static JS, identical for every target arch, so the build stage always runs on the
# builder's native platform (no QEMU) and only the nginx stage is produced per-arch.
FROM --platform=$BUILDPLATFORM ghcr.io/voidzero-dev/vite-plus:1.3.0 AS build

WORKDIR /app
# `.node-version` is copied with the manifests so `vp` provisions the pinned Node.js. The image
# runs as the non-root `vp` user, so every COPY needs --chown.
COPY --chown=vp:vp package.json pnpm-lock.yaml pnpm-workspace.yaml .node-version ./
RUN vp install --frozen-lockfile --ignore-scripts
COPY --chown=vp:vp . .
# `vp run build` (not the `vp build` built-in) so the package.json script type-checks first.
RUN vp run build

# Pinned by digest: the tag can move (or be re-pushed), and two builds of the same commit must not
# pick up different nginx patches. Digest resolved 2026-11-17 for nginx:1.27-alpine.
FROM nginx:1.27-alpine@sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10
COPY --from=build /app/dist /usr/share/nginx/html
# The nginx image renders /etc/nginx/templates/*.template into conf.d at start (envsubst). Only
# INFLUXDB_* is substituted: the config's own $uri, $host... must reach nginx untouched.
ENV NGINX_ENVSUBST_FILTER=^INFLUXDB_
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker/generate-env-js.sh /docker-entrypoint.d/10-generate-env-js.sh
RUN chmod +x /docker-entrypoint.d/10-generate-env-js.sh
EXPOSE 80
