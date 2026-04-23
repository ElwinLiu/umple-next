# Prof Server Migration Runbook

## Goal

Move production deployment for UmpleOnline to the prof's server, and make that server the target for future GitHub `Release` workflow runs.

After this cutover, the deployment target is controlled by the repository's GitHub Actions secrets:

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_SSH_PORT`
- `DEPLOY_PATH`
- `DEPLOY_HOST_FINGERPRINT`

## How Production Release Works

This repo has two separate production workflows:

1. `Publish Images`
   Builds and pushes immutable GHCR images tagged as `sha-<full_commit_sha>`.
   This runs automatically on pushes to `master`, and can also be run manually for a specific commit.

2. `Release`
   Deploys a selected existing Git tag to the server named by the `DEPLOY_*` secrets.
   It does not build images. It resolves the tagged commit, verifies that the matching `sha-*` images already exist, copies `docker-compose.prod.yml` and `scripts/release.sh` to the server, runs the release script over SSH, and then creates the GitHub Release entry.

Changing the production server therefore means:

1. Prepare the prof's server so it can run the stack.
2. Update the `DEPLOY_*` GitHub secrets to point at that server.
3. Run a new GitHub `Release` for a new tag.

## Important Constraints

- The release workflow refuses to deploy a tag if a GitHub Release for that tag already exists.
- The first deployment to the prof's server must therefore use a new, unreleased tag.
- The target commit must already have published GHCR images.
- The SSH user used by GitHub Actions must be able to run `docker` without `sudo`.
- The release script requires TXL to exist on the host at `/usr/local/bin/txl` and `/usr/local/lib/txl`.

## Information To Collect First

Before starting, collect these values:

- Server hostname or IP
- SSH username
- SSH port
- SSH private key for GitHub Actions
- Production domain name
- Target deploy path on the server, for example `~/deploy/umpleonline`

## Step-By-Step Migration

### 1. Verify SSH access to the prof's server

From your machine, confirm that you can log in as the deploy user:

```bash
ssh -p <port> <user>@<host>
```

If this does not work, stop here and fix SSH access first.

### 2. Install Docker on the prof's server

Install Docker Engine and either the Docker Compose plugin or `docker-compose`.

On the target host, verify:

```bash
docker --version
docker compose version
```

If the deploy user cannot run Docker yet, add it to the Docker group and start a new login session before continuing.

### 3. Install TXL on the host

Install FreeTXL on the prof's server using the official TXL distribution, then verify that the final host paths are exactly:

- `/usr/local/bin/txl`
- `/usr/local/lib/txl`

Verify:

```bash
ls -l /usr/local/bin/txl
ls -ld /usr/local/lib/txl
/usr/local/bin/txl -V
```

Official TXL download: <https://www.txl.ca/txl-download.html>

### 4. Create the deployment directory structure

On the prof's server:

```bash
mkdir -p ~/deploy/umpleonline/data/models
```

If you want a different location, keep it consistent and use that same value later for `DEPLOY_PATH`.

### 5. Create the production `.env` file on the server

Create `~/deploy/umpleonline/.env` with the stable runtime settings:

```bash
cat > ~/deploy/umpleonline/.env <<'EOF'
ALLOWED_ORIGINS=https://your-domain.example.com
FRONTEND_BIND_HOST=127.0.0.1
FRONTEND_HOST_PORT=3100
BACKEND_PORT=3001
COLLAB_PORT=3002
LSP_PORT=9999
CODE_EXEC_PORT=4401
EOF
```

Notes:

- `ALLOWED_ORIGINS` must be the real production origin, not localhost.
- Leave image variables out. The release script writes `BACKEND_IMAGE`, `FRONTEND_IMAGE`, `CODE_EXEC_IMAGE`, `CODE_RUNNER_IMAGE`, `COLLAB_IMAGE`, `LSP_PROXY_IMAGE`, and `DOCKER_GID` automatically during deploy.
- Keep `FRONTEND_BIND_HOST=127.0.0.1` unless you intentionally want the container bound publicly.

### 6. Configure the public entry point

Set up the domain so traffic reaches the frontend on the prof's server at `127.0.0.1:3100`.

Options:

- nginx reverse proxy on the server
- external reverse proxy
- Cloudflare Tunnel

The key requirement is that public traffic eventually reaches the frontend service on the host port defined by `FRONTEND_HOST_PORT`.

### 7. Generate the SSH host fingerprint for GitHub Actions

The release workflow uses SSH host verification and expects the ECDSA fingerprint.

Run this from your machine:

```bash
ssh-keyscan -p <port> -t ecdsa <host> | ssh-keygen -lf -
```

Copy the `SHA256:...` fingerprint value.

### 8. Update the GitHub repository secrets

In GitHub, update these repository secrets to point at the prof's server:

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_SSH_PORT`
- `DEPLOY_PATH`
- `DEPLOY_HOST_FINGERPRINT`

Example values:

- `DEPLOY_HOST`: prof server hostname or IP
- `DEPLOY_USER`: deploy SSH user
- `DEPLOY_SSH_PORT`: SSH port
- `DEPLOY_PATH`: `~/deploy/umpleonline`
- `DEPLOY_HOST_FINGERPRINT`: `SHA256:...`

This is the actual cutover point for future GitHub `Release` runs.

### 9. Make sure the target commit has published images

The `Release` workflow only deploys images that already exist in GHCR.

Choose the commit you want to deploy:

- If it is already on `master` and `Publish Images` succeeded for that commit, continue.
- If it is not yet published, run the `Publish Images` workflow manually for that exact commit SHA first.

Do not create the release tag until you know the images exist.

### 10. Create a new tag for the first prof-server deployment

Because the workflow refuses already released tags, create a fresh tag for the cutover.

Example:

```bash
git tag v0.0.8 <commit-sha>
git push origin v0.0.8
```

You can tag the same commit as the old production deployment if needed, but the tag itself must be new.

### 11. Run the GitHub `Release` workflow

In GitHub Actions:

1. Open `Release`
2. Click `Run workflow`
3. Enter the new tag, for example `v0.0.8`
4. Optionally add operator notes
5. Start the workflow

What the workflow will do:

1. Validate the tag format and confirm the tag exists
2. Refuse the run if that tag already has a GitHub Release
3. Resolve the tagged commit SHA
4. Verify the `sha-<commit>` images exist in GHCR
5. Copy `docker-compose.prod.yml` and `scripts/release.sh` to `DEPLOY_PATH`
6. SSH into the prof's server
7. Log Docker into GHCR
8. Update the image refs inside the server `.env`
9. Run `docker compose up -d --remove-orphans`
10. Wait for backend readiness and frontend availability
11. Create the GitHub Release entry

### 12. Verify the new production server

After the workflow succeeds, verify:

```bash
ssh -p <port> <user>@<host>
cd ~/deploy/umpleonline
docker compose -f docker-compose.prod.yml ps
```

Then verify the public site:

- Home page loads
- Editor loads
- `/api/health` works through the deployed stack
- Code generation works
- Code execution works

### 13. Keep the old server available briefly

Do not immediately dismantle the old server.

Keep it available until you have confirmed:

- the new release is stable
- the domain is routing correctly
- a rollback plan is available

### 14. Decommission the old server

Once you are confident the prof's server is stable, remove or disable the old production deployment and update any remaining infrastructure notes to point to the prof's server.

## Rollback

There are two rollback paths.

### Automatic rollback during a failed deploy

If the release script has already started replacing containers and the deploy then fails, `scripts/release.sh` attempts an automatic rollback to the previous image refs stored in the server `.env`.

### Operator-initiated rollback after a completed bad release

If the release completed but you want to move production back to an older known-good commit:

1. Identify the known-good commit
2. Ensure its `sha-*` images exist in GHCR
3. Create a new Git tag that points at that older commit
4. Push the new tag
5. Run the `Release` workflow for that new tag

Example:

```bash
git tag v0.0.9 <known-good-commit-sha>
git push origin v0.0.9
```

Do not try to rerun an already released tag. The workflow blocks that on purpose.

## Quick Operator Checklist

Use this as the short version:

1. SSH into the prof's server successfully.
2. Install Docker and confirm the deploy user can run it.
3. Install TXL and verify `/usr/local/bin/txl` and `/usr/local/lib/txl`.
4. Create `~/deploy/umpleonline/data/models`.
5. Create `~/deploy/umpleonline/.env` with the real production origin.
6. Set up the reverse proxy or tunnel to `127.0.0.1:3100`.
7. Generate the ECDSA SSH fingerprint.
8. Update all `DEPLOY_*` GitHub secrets.
9. Ensure the target commit already has published `sha-*` images.
10. Create and push a new unreleased Git tag.
11. Run GitHub Actions `Release` for that tag.
12. Verify the live site.
13. Keep the old server around until the new one is proven stable.
