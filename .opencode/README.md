# Repository OpenCode setup

This directory contains the project-specific OpenCode agents and their pinned
plugin dependency.

After cloning the repository, install the local dependency with:

```sh
bun install --cwd .opencode
```

The generated `.opencode/node_modules/` directory is intentionally ignored.
The tracked `package.json` and `package-lock.json` preserve the dependency
version and integrity data across machines.
