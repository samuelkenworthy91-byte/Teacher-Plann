#!/usr/bin/env bash
# Copies the APK build workflow into .github/workflows/ and commits it.
# (Arena's GitHub App is not allowed to write workflow files, so this last
# step is done from your own machine / account.)
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p .github/workflows
cp ci/github-actions/android-build.yml .github/workflows/android-build.yml
git add .github/workflows/android-build.yml
git commit -m "Add Android APK build workflow"

echo
echo "Done. Now push:  git push"
echo "Then watch it at: Actions → Build Android APK"
