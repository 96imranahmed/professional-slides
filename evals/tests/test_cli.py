"""Every runtime CLI reads its command line and ends the same way (runtime/cli.mjs).

An option's value is never another option: `--reason --user-approved` is a
usage error, not a reason that reads "--user-approved". A refusal prints
`Refused (CODE): message` and exits 2; a usage error prints its message and
exits 1. JSON is read and written one way: a missing optional file is null, a
file that does not parse is an error naming it.
"""

from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from node_probe import NODE, RUNTIME, run_node


class ParseCliTests(unittest.TestCase):
    def test_a_value_is_never_an_option_and_a_bare_option_takes_its_default(self):
        result = run_node('''
import { parseCli } from './skills/professional-slides/runtime/cli.mjs';
const table = { reason: { type: 'string' }, 'user-approved': { type: 'boolean' }, run: { type: 'string', bare: 'auto' }, python: { type: 'string', valueName: 'an executable' } };
const read = (argv, options) => { try { return parseCli(argv, table, { usage: 'Usage: x', ...options }); } catch (error) { return { error: error.name, message: error.message }; } };
console.log(JSON.stringify({
  swallowed: read(['deck.json', '--reason', '--user-approved']),
  missing: read(['--python']),
  inline: read(['--reason=-1']),
  bare: read(['deck.json', 'out', '--run']),
  bareBeforeOption: read(['--run', '--user-approved']),
  given: read(['--run', 'codex']),
  booleanValue: read(['--user-approved=yes']),
  unknown: read(['deck.json', '--nosuch', 'out']),
  strict: read(['--nosuch'], { strict: true }),
}));
''')
        self.assertEqual(result["swallowed"], {"error": "UsageError", "message": "--reason requires a value, not the option --user-approved\nUsage: x"})
        self.assertEqual(result["missing"]["message"], "--python requires an executable\nUsage: x")
        self.assertEqual(result["inline"]["values"], {"reason": "-1"})
        self.assertEqual(result["bare"], {"values": {"run": "auto"}, "positionals": ["deck.json", "out"]})
        self.assertEqual(result["bareBeforeOption"]["values"], {"run": "auto", "user-approved": True})
        self.assertEqual(result["given"]["values"], {"run": "codex"})
        self.assertEqual(result["booleanValue"]["error"], "UsageError")
        self.assertEqual(result["unknown"], {"values": {}, "positionals": ["deck.json", "out"]})
        self.assertEqual(result["strict"]["message"], "Unknown option --nosuch\nUsage: x")

    def test_a_cli_refuses_a_swallowed_value_before_it_starts(self):
        if not NODE:
            self.skipTest("Node.js is not available")
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "out"
            run = subprocess.run([NODE, str(RUNTIME / "deliver-deck.mjs"), str(Path(tmp) / "x.deck.json"), str(out),
                                  "--full-review", "--reason", "--user-approved"], capture_output=True, text=True)
            self.assertEqual(run.returncode, 1)
            self.assertIn("--reason requires a value, not the option --user-approved", run.stderr)
            self.assertNotIn("    at ", run.stderr)
            self.assertFalse(out.exists())


class JsonTests(unittest.TestCase):
    def test_reading_and_writing_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            bad = Path(tmp) / "bad.json"
            bad.write_text("{ not json", encoding="utf-8")
            result = run_node(f'''
import {{ readFileSync }} from 'node:fs';
import {{ readJson, readJsonSync, writeJson }} from './skills/professional-slides/runtime/cli.mjs';
const dir = {json.dumps(tmp)};
const fails = async (read) => {{ try {{ await read(); return null; }} catch (error) {{ return error.name + ': ' + error.message.startsWith(dir); }} }};
await writeJson(dir + '/out.json', {{ a: [1] }});
console.log(JSON.stringify({{
  written: readFileSync(dir + '/out.json', 'utf8'),
  optional: await readJson(dir + '/absent.json', {{ optional: true }}),
  optionalSync: readJsonSync(dir + '/absent.json', {{ optional: true }}),
  required: await fails(() => readJson(dir + '/absent.json')),
  malformed: await fails(() => readJson(dir + '/bad.json', {{ optional: true }})),
}}));
''')
        self.assertEqual(result["written"], '{\n  "a": [\n    1\n  ]\n}\n')
        self.assertIsNone(result["optional"])
        self.assertIsNone(result["optionalSync"])
        self.assertEqual(result["required"], "Error: false")
        self.assertEqual(result["malformed"], "SyntaxError: true")


if __name__ == "__main__":
    unittest.main()
