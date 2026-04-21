# Umple Code Execution

This code base provides the functionality to securely execute generated Java and Python code using Docker containers.

# IMPORTANT

If you development the project on Windows, MUST set eof to LF

# Setup

1. Create config.cfg file from config.cfg.template with correct parameters (Explained below).
2. Run ./setup.sh (run setup.bat on cmd prompt on windows)
3. (Optional) Run the following command to compile and use latest Javascript changes if haven't done yet.  
   **ant -DshouldPackageUmpleOnline=true -Dmyenv=wlocal -f build.umple.xml packageUmpleonline**

# Config.cfg

**umplePath**  
Path to the Umple's ump folder where temporary user folders are created. The full path to umpleonline/ump

**tempPath**  
A directory where temporary files can be written. Suggested: /tmp

**mainContainerName**  
Name of the always running container and image. Use the default unless you are running more than one instance.

**tempContainerName**  
Default local runner image used for code execution in development. Production should prefer the `EXECUTION_RUNNER_IMAGE` environment variable so deploys can pin an immutable published runner image.

**portToUse**  
Port that the Umple Php code uses to communicate with the Docker image. Suggested: 4400. If you are running more than one instance, then each would need a new port.

**timeoutValue**  
How many seconds execution will run before the execution is ended. Default 20, but reduce if the server resources are limited.

# Setup.sh or setup.bat

This shell script contains commands to build docker images and to run the main docker container. The server will start at the following url by default.  
**http:localhost:4400**

# Other Issues

1. If timeout is coming even though the docker is running, make sure that umplePath in config.cfg does not start with '~'.

## Production note

In this repo's containerized deployment, the `code-exec` service is the coordinator and launches a separate runner image for each execution. Production should set:

- `EXECUTION_RUNNER_IMAGE` to a published immutable image ref
- `EXECUTION_RUNNER_AUTO_BUILD=0`

Development may keep auto-build enabled to create the local runner image on first use.
