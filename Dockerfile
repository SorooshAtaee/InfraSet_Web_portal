# InfraSet web portal — single container (Next.js UI + API routes + Python engine)
FROM oven/bun:1

# Python 3 is required by the InfraSet engine (standard library only, no pip)
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first (cached layer)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy the application
COPY . .

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN bun run build

EXPOSE 3000
CMD ["bun", "run", "start"]
