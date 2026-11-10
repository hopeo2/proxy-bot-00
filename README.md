# Free Proxy Channel Bot

A [Telegram Serverless](https://core.telegram.org/bots/serverless) bot that fetches verified
MTProto proxies from [0xRadikal/Free-Telegram-Proxy](https://github.com/0xRadikal/Free-Telegram-Proxy)
and publishes them to **[@free_proxy_00](https://t.me/free_proxy_00)** — one message per proxy,
with country, ping, uptime, network and a one-tap **Connect** link.

> Day-to-day command cheat sheet, gotchas and a recovery checklist live in
> [NOTES.txt](NOTES.txt). This README is the longer setup walkthrough.

## How it works

```
Telegram update ──► tgcloud/handlers/message.js      (DM commands + cron entry)
                └─► tgcloud/handlers/channel_post.js ( /post inside the channel )
                              │
                              ▼
                    tgcloud/lib/publisher.js
                    ├─ lib/proxy-source.js  → fetch fast/proxies.json
                    ├─ lib/format.js        → rank + format messages
                    └─ schema.js            → posted_proxies / settings / post_log
                              │
                              ▼
                    Bot API → @free_proxy_00
```

- **Source:** the `fast` tier (`fast/proxies.json`), with automatic fallback to
  `resilient` → `stable` → `verified` if a tier is unavailable.
- **Rotation:** each batch prefers proxies that were never posted, then the ones
  whose last post is oldest. The same ten servers are not repeated every time.
- **One message per proxy:** flag + country, RTT, uptime, type, ASN/org, `server:port`,
  and an inline **🚀 Connect to proxy** button (`https://t.me/proxy?...`).
- **State:** SQLite tracks every posted proxy, the last automatic post time, and a
  log of batches.

## Important: there is no built-in timer

Telegram Serverless only runs code when Telegram sends an update. There is **no cron
on the platform**, so "every 2 hours" needs an external trigger. This project ships
two options; use one (or both):

| Option | Runs when | Requires |
|---|---|---|
| **GitHub Actions** (`.github/workflows/post-proxies.yml`) | Every even UTC hour, in the cloud | Repo on GitHub + `TGCLOUD_TOKEN` secret |
| **Local cron** (`scripts/post-now.sh`) | Every 2 hours, on this machine | Machine stays on + `npx tgcloud login` done |

Both call the same job: `tgcloud run handlers/message '{"cron":true}'`. The
`MIN_GAP_MINUTES` guard (110 min) prevents a retried/delayed run from double-posting.

## Setup

### 1. BotFather

1. Create a bot with [@BotFather](https://t.me/BotFather).
2. Open the bot → **Serverless** → turn it on.
3. Open **CLI Access** and copy the token (`app<id>:<secret>`).

### 2. Link and deploy

```bash
npm install
npx tgcloud login        # paste the CLI access token
npx tgcloud push         # deploy handlers/lib/schema
npx tgcloud migrate      # create posted_proxies, settings, post_log
```

`push` and `migrate` are separate on purpose: deploying code never changes the DB.

### 3. Add the bot to the channel

In **@free_proxy_00** → Administrators → Add Administrator → your bot. Grant:

- **Post messages** (required)
- **Delete messages** (so `/post` can remove its own trigger command)

### 4. Authorize yourself

1. Send `/start` or `/id` to the bot in private chat.
2. Copy the numeric ID it replies with.
3. Put it in `tgcloud/lib/config.js`:

```js
export const ADMIN_IDS = [123456789];
```

4. Deploy again:

```bash
npx tgcloud push
```

### 5. Test

```bash
# In DM with the bot:
/preview 3    # sends 3 proxies to you only (does not consume the queue)
/post 3       # sends 3 proxies to @free_proxy_00
```

Or post `/post` directly in the channel (only admins can post there).

### 6. Enable the 2-hour schedule

**GitHub Actions (recommended):**

1. Push this project to a GitHub repository.
2. Repo → Settings → Secrets and variables → Actions → **New repository secret**:
   - Name: `TGCLOUD_TOKEN`
   - Value: the `app<id>:<secret>` token from BotFather.
3. Actions → **Post proxies every 2 hours** → **Enable workflow**.
4. Optional: run it once with **Run workflow** to verify.

> GitHub's scheduler can be delayed by several minutes and is disabled after 60 days
> of repository inactivity. Any commit re-enables it.

**Local cron:**

```bash
crontab -e
# every 2 hours, absolute paths are required
0 */2 * * * /absolute/path/to/scripts/post-now.sh >> /absolute/path/to/.tgcloud/post.log 2>&1
```

If `node` comes from nvm/asdf, cron will not find it; add its directory to the
crontab, e.g. `PATH=/home/you/.nvm/versions/node/vXX/bin:/usr/bin:/bin`.

Test the script first with `npm run post:now`.

## Commands

| Command | Where | What it does |
|---|---|---|
| `/start`, `/help` | DM | Help + your Telegram ID |
| `/id` | DM | Your numeric Telegram ID |
| `/post [n]` | DM | Publish `n` proxies (default 10, max 25) to the channel |
| `/preview [n]` | DM | Send a preview to you; does not record or consume the queue |
| `/stats` | DM | Tracked proxies, batches, failures, last automatic post |
| `/post [n]` | Channel | Publish a batch from inside the channel; trigger message is deleted |
| `/proxy [n]` | Channel | Same as `/post` |

DM commands require your ID in `ADMIN_IDS`. Channel commands are implicitly
admin-only (only channel admins can post).

## Configuration

`tgcloud/lib/config.js`:

| Setting | Default | Meaning |
|---|---|---|
| `CHANNEL` | `'@free_proxy_00'` | Target channel (`@username` or numeric `-100…` id) |
| `ADMIN_IDS` | `[]` | Telegram user IDs allowed to use DM admin commands |
| `BATCH_SIZE` | `10` | Proxies per automatic batch |
| `MAX_BATCH` | `25` | Hard cap per batch |
| `MIN_GAP_MINUTES` | `100` | Cooldown for automatic runs (manual `/post` bypasses it) |
| `TIER` | `'fast'` | Source tier: `fast`, `resilient`, `stable`, `verified`, `secure`, `classic`, `faketls` |
| `SOURCE_BASE` | raw GitHub URL | Where tier JSON is fetched from |

## Project layout

```
tgcloud/
├─ handlers/
│  ├─ message.js         # DM commands + cron entry ({ cron: true })
│  └─ channel_post.js    # /post inside the channel
├─ lib/
│  ├─ config.js          # channel, admins, batch size, tier
│  ├─ format.js          # pure: normalize, rank, format, proxy links
│  ├─ proxy-source.js    # fetch + dedupe + tier fallback
│  └─ publisher.js       # DB bookkeeping + Bot API publishing
└─ schema.js             # posted_proxies, settings, post_log
scripts/
├─ selftest.mjs          # pure-logic tests: npm test
└─ post-now.sh           # one batch from cron/systemd
.github/workflows/
└─ post-proxies.yml      # every-2-hours GitHub Actions schedule
```

## Useful commands

```bash
npm test                  # pure-logic tests (no credentials needed)
npx tgcloud status        # local vs cloud diff (offline)
npx tgcloud run handlers/message '{"cron":true,"force":true}'   # run the job now
npx tgcloud webhook       # check webhook vs deployed handlers
```

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `403 Forbidden: bot is not a member of the channel chat` | Add the bot as a channel administrator with **Post messages**. |
| `400 Bad Request: chat not found` | Wrong `CHANNEL` value, or the channel username changed. |
| `/post` replies "Not authorized" | Add your numeric ID to `ADMIN_IDS`, then `npx tgcloud push`. |
| `no such table: posted_proxies` | Run `npx tgcloud migrate` after the first `push`. |
| Cron run says "skipped: cooldown" | A batch was posted less than 110 minutes ago. Use `"force":true` to override. |
| Source fetch fails | The bot automatically falls back to `resilient` → `stable` → `verified`. Check the repo's `health.json`. |
| GitHub schedule did not run | Scheduled workflows can be delayed; re-enable after 60 days of repo inactivity, or use **Run workflow**. |

## Security notes

- `.tgcloud/` (CLI token) and `node_modules/` are git-ignored. Never commit the token.
- In GitHub Actions the token lives only in the `TGCLOUD_TOKEN` secret.
- The runtime has no filesystem or npm packages: only `sdk` and the project modules.
- The database has no foreign keys (platform constraint); integrity is handled in code.
