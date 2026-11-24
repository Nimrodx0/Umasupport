#!/usr/bin/env bash
# Restore only model-derived JSON with the original recorded byte hashes.
# A cache is optional; cold recovery uses the historical recipe and frozen engine.
set -euo pipefail
mode="${1:?mode required}"
destination="${2:?output directory required}"
source_dir="${3:-}"
root="$(git rev-parse --show-toplevel)"
case "$destination" in /*) ;; *) echo 'Absolute output directory required' >&2; exit 2;; esac
case "$mode" in roster32|expanded|p231) ;; *) echo 'Unknown research mode' >&2; exit 2;; esac
verify() { node "$root/poc/tools/verify_pinned_research.cjs" "$1" "$2"; }
if [[ "$mode" != p231 ]] && verify "$mode" "$destination"; then
  echo "Verified existing fixed research inputs ($mode)"
  exit 0
fi
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
historical_checkout() {
  local revision="$1"
  git -C "$root" fetch --no-tags --depth 1 origin "$revision"
  test "$(git -C "$root" rev-parse FETCH_HEAD)" = "$revision"
  mkdir -p "$work/source"
  git -C "$root" archive "$revision" | tar -x -C "$work/source"
}
mkdir -p "$work/out"
if [[ "$mode" == p231 ]]; then
  # Recompute the prior independent P2.31 algorithm, rather than trust an
  # expiring ZIP or substitute a newly changed implementation as the baseline.
  verify roster32 "$source_dir"
  historical_checkout ff13aa4427e90bd213c4b9c12a140bd02a3fc1a7
  cd "$work/source"
  manifest=poc/data/p2_position_condition32_research.v1.json
  inputs=("$source_dir/balanced.json" "$source_dir/frontHeavy.json" "$source_dir/backHeavy.json" "$source_dir/noFront.json")
  node poc/tools/skill_specificity32_research.cjs "$manifest" "${inputs[@]}" "$source_dir/roster32-comparison.json" "$work/out/two-axis-32.json"
  node poc/tools/skill_reference_scenario_gate.cjs "$work/out/two-axis-32.json" "$work/out/reference-scenario-validity.json"
  node poc/tools/skill_context_margin_sensitivity.cjs "$work/out/two-axis-32.json" "$work/out/reference-scenario-validity.json" "$work/out/context-margin-sensitivity.json"
  node poc/tools/skill_context_individual_margin.cjs "$manifest" "${inputs[@]}" "$work/out/context-margin-sensitivity.json" "$work/out/individual-course-mode-margin.json"
  # Historical expected counts retained; split15 also independently checks them.
  node - "$work/out/individual-course-mode-margin.json" <<'NODE'
const assert = require('node:assert/strict'), fs = require('node:fs');
const r = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
assert.equal(r.status, 'P2.31-individual-course-mode-W-margin-vs-scenario-mean-research-only');
assert.equal(r.rows.length, 192);
assert.deepEqual(['0','1','3','5'].map(k => r.summary[k].minimumAcrossIndividualCourseModePass), [135,131,121,118]);
NODE
  mkdir -p "$destination"
  cp "$work/out/individual-course-mode-margin.json" "$destination/"
  exit 0
fi
case "$mode" in
  roster32) historical_checkout 9118b99062350ce607243985c32d04c33cb000e7 ;;
  expanded) historical_checkout 02d5928b1897175c200503baaa9bdd345ae73dfe ;;
esac
engine_revision=80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1
git init -q "$work/globalsim"
git -C "$work/globalsim" remote add origin https://github.com/daftuyda/GlobalSim.git
git -C "$work/globalsim" fetch -q --depth 1 origin "$engine_revision"
git -C "$work/globalsim" checkout -q --detach FETCH_HEAD
test "$(git -C "$work/globalsim" rev-parse HEAD)" = "$engine_revision"
(cd "$work/globalsim" && cargo build --release --locked)
engine="$work/globalsim/target/release/race_engine_rs_v2"
template="$work/globalsim/examples/v77-race.jsonl"
test -x "$engine"
cd "$work/source"
if [[ "$mode" == roster32 ]]; then
  manifest=poc/data/p2_position_condition32_research.v1.json
  for scenario in balanced frontHeavy backHeavy noFront; do
    node --max-old-space-size=4096 poc/tools/globalsim_roster32.cjs "$manifest" "$template" "$engine" "$scenario" "$work/out/$scenario.json" 30
  done
  node poc/tools/skill_roster32_aggregate.cjs "$manifest" "$work/out/balanced.json" "$work/out/frontHeavy.json" "$work/out/backHeavy.json" "$work/out/noFront.json" "$work/out/roster32-comparison.json"
else
  node --max-old-space-size=3072 poc/tools/globalsim_position_expanded.cjs "$template" "$engine" "$work/out/summary.json" 15
  node poc/tools/globalsim_window_profile.cjs "$work/out/summary.json" "$work/out/window-profile.json"
fi
# Fail closed on ANY historical checksum drift. Never silently update a pin.
verify "$mode" "$work/out"
mkdir -p "$destination"
cp "$work/out/"*.json "$destination/"
verify "$mode" "$destination"
echo "Regenerated and independently verified fixed research inputs ($mode)"
