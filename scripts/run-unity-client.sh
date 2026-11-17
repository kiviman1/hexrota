#!/usr/bin/env bash
set -euo pipefail
# Run on a machine with a legitimately activated exact editor + Web Build Support.
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
UNITY_EDITOR_PATH="${UNITY_EDITOR_PATH:-/opt/unity/Editor/Unity}"
MODE="${1:-tests}"
if [[ ! -x "$UNITY_EDITOR_PATH" ]]; then
  printf '%s\n' 'BLOCKED: Unity Editor is not installed; set UNITY_EDITOR_PATH to licensed Unity 6000.6.9f1.' >&2
  exit 2
fi
mkdir -p "$ROOT_DIR/test-results/unity-client"
ACTUAL_VERSION="$("$UNITY_EDITOR_PATH" -version 2>/dev/null | tail -n 1)"
if [[ "$ACTUAL_VERSION" != '6000.6.9f1' ]]; then
  printf 'BLOCKED: expected Unity 6000.6.9f1; got %s\n' "$ACTUAL_VERSION" >&2
  exit 2
fi
cd "$ROOT_DIR"
node scripts/sync-unity-client.cjs --check
node scripts/check-unity-client.cjs
case "$MODE" in
  tests)
    for TEST_PLATFORM in EditMode PlayMode; do
      "$UNITY_EDITOR_PATH" -batchmode -nographics -projectPath "$ROOT_DIR/unity-client" \
        -runTests -testPlatform "$TEST_PLATFORM" \
        -testResults "$ROOT_DIR/test-results/unity-client/$TEST_PLATFORM.xml" \
        -logFile "$ROOT_DIR/test-results/unity-client/$TEST_PLATFORM.log"
      python3 - "$ROOT_DIR/test-results/unity-client/$TEST_PLATFORM.xml" <<'PY'
import sys,xml.etree.ElementTree as E
root=E.parse(sys.argv[1]).getroot()
if root.attrib.get('result') not in ('Passed','Success') or int(root.attrib.get('testcasecount',root.attrib.get('total','0'))) < 1:
 raise SystemExit('Unity test report failed or contains no tests: '+str(root.attrib))
print(root.attrib)
PY
    done
    ;;
  web)
    UNITY_EDITOR_DIR="$(dirname "$UNITY_EDITOR_PATH")"
    if [[ ! -d "$UNITY_EDITOR_DIR/Data/PlaybackEngines/WebGLSupport" ]]; then
      printf '%s\n' 'BLOCKED: exact editor Web Build Support module missing.' >&2; exit 2
    fi
    "$UNITY_EDITOR_PATH" -batchmode -nographics -quit -projectPath "$ROOT_DIR/unity-client" \
      -buildTarget WebGL -executeMethod Hexrota.UnityClient.Editor.ClientBuild.BuildWeb \
      -logFile "$ROOT_DIR/test-results/unity-client/WebGL.log"
    node scripts/check-unity-web-build.cjs unity-client/Builds/WebGL
    ;;
  *) printf '%s\n' 'Usage: scripts/run-unity-client.sh tests|web' >&2; exit 2 ;;
esac
