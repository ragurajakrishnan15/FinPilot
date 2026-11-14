# --- build stage (also used as the dev/test image: `docker build --target build`) ---
FROM haskell:9.10-bookworm AS build
RUN apt-get update && apt-get install -y --no-install-recommends libpq-dev pkg-config \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY finpilot-api.cabal ./
RUN cabal update && cabal build --only-dependencies -j2 all
COPY app ./app
COPY src ./src
COPY test ./test
RUN cabal build exe:finpilot-api -j2 \
    && mkdir -p /out && cp "$(cabal list-bin finpilot-api)" /out/finpilot-api

# --- runtime stage ---
FROM debian:bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends libpq5 libgmp10 ca-certificates \
    && rm -rf /var/lib/apt/lists/* && useradd --system --create-home finpilot
COPY --from=build /out/finpilot-api /usr/local/bin/finpilot-api
USER finpilot
ENV PORT=8080
EXPOSE 8080
CMD ["finpilot-api"]


