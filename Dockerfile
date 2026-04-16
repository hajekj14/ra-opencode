FROM ghcr.io/anomalyco/opencode:latest

USER root

RUN set -eux; \
    if command -v apk >/dev/null 2>&1; then \
        apk add --no-cache git bash ca-certificates openssh-client; \
    elif command -v apt-get >/dev/null 2>&1; then \
        apt-get update; \
        apt-get install -y --no-install-recommends git bash ca-certificates openssh-client; \
        rm -rf /var/lib/apt/lists/*; \
    elif command -v microdnf >/dev/null 2>&1; then \
        microdnf install -y git bash ca-certificates openssh-clients; \
        microdnf clean all; \
    else \
        echo "Unsupported base image package manager" >&2; \
        exit 1; \
    fi

WORKDIR /workspace

COPY docker/init-repo.sh /usr/local/bin/init-repo.sh
COPY docker/start-opencode.sh /usr/local/bin/start-opencode.sh
COPY docker/opencode.jsonc /etc/opencode/opencode.jsonc

RUN chmod +x /usr/local/bin/init-repo.sh /usr/local/bin/start-opencode.sh

ENV OPENCODE_CONFIG=/etc/opencode/opencode.jsonc

ENTRYPOINT ["/usr/local/bin/start-opencode.sh"]