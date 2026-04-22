# Umple Code Execution

This service runs generated Java and Python code inside short-lived Docker runner containers. In this repo it is the `code-exec` service that the Go backend calls when a user clicks Run.

## How This Differs From The Legacy Service

- The legacy repo's `UmpleCodeExecution` defaulted to port `4400`.
- This rewrite defaults to port `4401` so you can run both side by side on the same machine while testing.
- The modern repo uses Docker Compose and environment variables for wiring instead of the old `setup.sh` / `setup.bat` flow.
- Production should set `EXECUTION_RUNNER_IMAGE` to an immutable published runner image and keep `EXECUTION_RUNNER_AUTO_BUILD=0`.

## Local Configuration

The committed [`config.cfg`](./config.cfg) file is used when you run the service outside Docker Compose.

**umplePath**  
Path to the model storage directory. In this repo's containerized setup that is `/data/models`.

**tempPath**  
Directory where temporary execution artifacts can be written. Suggested: `/tmp`

**mainContainerName**  
Legacy field kept for compatibility with the config format. The current service no longer launches a long-running execution container with this name.

**tempContainerName**  
Default local runner image used for code execution in development. Production should prefer the `EXECUTION_RUNNER_IMAGE` environment variable so deploys can pin an immutable published runner image.

**portToUse**  
Port used when the service is started directly from `config.cfg`. Default: `4401`

**timeoutValue**  
How many seconds execution will run before it is ended. Default: `20`

## Docker Compose Defaults

For normal development, use the repo root commands:

```bash
make dev
```

That starts `code-exec` through Docker Compose, passes `PORT=${CODE_EXEC_PORT:-4401}`, and points the backend at `http://code-exec:${CODE_EXEC_PORT:-4401}`.

If you need a different port, set `CODE_EXEC_PORT` in the repo root `.env` before starting Compose.

## Windows Line Endings

This repo expects LF line endings for checked-in text files and shell scripts. The repo root [`.gitattributes`](../.gitattributes) enforces that.

## Other Issues

If timeouts happen even though Docker is running, make sure `umplePath` in `config.cfg` does not start with `~`.
