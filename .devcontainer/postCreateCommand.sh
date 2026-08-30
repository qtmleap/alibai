#!/bin/zsh
set -e

sudo chown -R $(whoami):$(whoami) node_modules 2>/dev/null || true

# Silence direnv output.
# In direnv 2.36+, DIRENV_LOG_FORMAT env var is ignored unless direnv.toml exists.
# See: https://github.com/direnv/direnv/issues/1418
mkdir -p ~/.config/direnv
cat > ~/.config/direnv/direnv.toml <<'EOF'
[global]
log_format = ""
hide_env_diff = true
EOF

# Seed a local .env from the template on first create.
# Never overwrite an existing .env — it may hold real API keys.
if [ -f .env.example ] && [ ! -f .env ]; then
  cp .env.example .env
  echo "[postCreate] created .env from .env.example — fill in your LLM API keys"
fi

# Install deps if package.json exists.
if [ -f package.json ]; then
  if [ -f bun.lock ]; then
    bun install --frozen-lockfile --ignore-scripts
  else
    bun install --ignore-scripts
  fi
fi

# Apply migrations and load the scenarios into the local D1 database.
# Both run against .wrangler/state, so no network and no database container.
if [ -n "$(ls -A db/migrations 2>/dev/null)" ]; then
  bun run db:migrate || echo "[postCreate] db:migrate failed — run it manually"
  bun run db:seed && bun run db:seed:apply || echo "[postCreate] seeding failed — run db:seed && db:seed:apply manually"
fi
