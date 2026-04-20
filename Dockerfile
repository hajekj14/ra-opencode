# Custom OpenCode image based on Debian slim (glibc) to fix PTY/terminal support.
# The official Alpine-based image uses the musl binary while bun-pty ships glibc-only
# native libraries, so /pty routes never register and the terminal never starts.
# This image downloads the glibc build from GitHub releases instead.
#
# Build args:
#   OPENCODE_VERSION — GitHub release tag (default: v1.14.18). Update to upgrade.

FROM debian:bookworm-slim

ARG OPENCODE_VERSION=v1.14.18

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       bash \
       ca-certificates \
       curl \
             docker.io \
       git \
       openssh-client \
       wget \
    && rm -rf /var/lib/apt/lists/*

RUN set -eux; \
    TMPDIR=$(mktemp -d); \
    curl -sSfL \
        "https://github.com/anomalyco/opencode/releases/download/${OPENCODE_VERSION}/opencode-linux-x64.tar.gz" \
        -o "$TMPDIR/opencode.tar.gz"; \
    tar -xzf "$TMPDIR/opencode.tar.gz" -C "$TMPDIR"; \
    find "$TMPDIR" -type f -name "opencode" | head -1 \
        | xargs install -m 755 -t /usr/local/bin/; \
    rm -rf "$TMPDIR"

WORKDIR /workspace

COPY docker/opencode-config/ /etc/opencode/

ENTRYPOINT ["opencode"]
CMD ["web", "--hostname", "0.0.0.0", "--port", "4096"]
