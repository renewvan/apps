# Built from the workspace root, so the shared packages/ are in the context:
#   docker build -f apps/dashboard/Dockerfile .
# `dist/` is static JS, identical for every target arch, so the build stage always runs on the
# builder's native platform (no QEMU) and only the nginx stage is produced per-arch.
FROM --platform=$BUILDPLATFORM ghcr.io/voidzero-dev/vite-plus:1.3.0 AS build

WORKDIR /app
# The workspace manifests first, so the install layer is cached until a dependency changes.
# `.node-version` is copied with them so `vp` provisions the pinned Node.js. The image runs as the
# non-root `vp` user, so every COPY needs --chown. packages/ is copied whole: workspace packages
# are small, and Docker cannot copy their package.json files alone without flattening the paths.
COPY --chown=vp:vp package.json pnpm-lock.yaml pnpm-workspace.yaml .pnpmfile.cjs .node-version ./
COPY --chown=vp:vp apps/dashboard/package.json apps/dashboard/
COPY --chown=vp:vp packages/ packages/
# Only the dashboard, the workspace packages it depends on, and the root (whose vite.config.ts
# holds the lint and type-check settings `vp check` reads).
RUN vp install --frozen-lockfile --ignore-scripts --filter dashboard... --filter renewvan-apps
# The root .gitignore keeps the type-aware lint in `vp check` out of node_modules.
COPY --chown=vp:vp vite.config.ts .gitignore ./
COPY --chown=vp:vp apps/dashboard/ apps/dashboard/
WORKDIR /app/apps/dashboard
# `vp run build` (not the `vp build` built-in) so the package.json script type-checks first.
RUN vp run build

# Pinned by digest: the tag can move (or be re-pushed), and two builds of the same commit must not
# pick up different nginx patches. Digest resolved 2026-11-17 for nginx:1.27-alpine.
FROM nginx:1.27-alpine@sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10
COPY --from=build /app/apps/dashboard/dist /usr/share/nginx/html
# The nginx image renders /etc/nginx/templates/*.template into conf.d at start (envsubst). Only
# INFLUXDB_* is substituted: the config's own $uri, $host... must reach nginx untouched.
ENV NGINX_ENVSUBST_FILTER=^INFLUXDB_
COPY apps/dashboard/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY apps/dashboard/docker/generate-env-js.sh /docker-entrypoint.d/10-generate-env-js.sh
RUN chmod +x /docker-entrypoint.d/10-generate-env-js.sh
EXPOSE 80
