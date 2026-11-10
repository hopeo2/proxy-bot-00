#!/usr/bin/env bash
# Publish one batch right now, using the local project's credentials.
# Run it by hand or from cron/systemd:
#   0 */2 * * * /absolute/path/to/scripts/post-now.sh >> /absolute/path/to/.tgcloud/post.log 2>&1
#
# Cron's PATH is minimal. If node is installed with nvm/asdf, add its directory
# to the crontab, e.g.:  PATH=/home/you/.nvm/versions/node/vXX/bin:/usr/bin:/bin
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

if ! command -v node >/dev/null 2>&1; then
  echo "node not found in PATH (cron uses a minimal PATH). See the note in this script." >&2
  exit 1
fi

exec node node_modules/@tgcloud/cli/bin/tgcloud.js \
  --no-pager run handlers/message '{"cron":true,"trigger":"local-cron"}'
