#!/bin/bash
# Runs the pulse.html test suite. No install step: uses osascript -l
# JavaScript (JavaScriptCore), the same engine/approach documented in
# CLAUDE.md, so there's nothing to `npm install` before this works.
#
# Usage:
#   ./tests/run.sh              # run everything
#   ./tests/run.sh timeline     # only run tests whose name includes "timeline"
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"
osascript -l JavaScript tests/harness.js "$@"
