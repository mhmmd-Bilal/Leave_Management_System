import assert from "node:assert/strict";
import { test } from "node:test";
import { escapeCsvValue, toCsv } from "../../utils/csv.js";

test("quotes fields containing commas, quotes and newlines", () => {
  assert.equal(escapeCsvValue('a,b'), '"a,b"');
  assert.equal(escapeCsvValue('say "hi"'), '"say ""hi"""');
  assert.equal(escapeCsvValue("line1\nline2"), '"line1\nline2"');
});

test("neutralises spreadsheet formula injection in text cells", () => {
  for (const evil of ["=1+1", "+SUM(A1)", "-2+3", "@cmd", "\t=1", "\r=1"]) {
    assert.ok(escapeCsvValue(evil).includes(`'${evil}`), `not neutralised: ${JSON.stringify(evil)}`);
  }
  assert.equal(escapeCsvValue('=HYPERLINK("http://x","y")'), `"'=HYPERLINK(""http://x"",""y"")"`);
});

test("real numbers stay numbers (negative too); null/NaN become empty", () => {
  assert.equal(escapeCsvValue(-2.5), "-2.5");
  assert.equal(escapeCsvValue(0), "0");
  assert.equal(escapeCsvValue(null), "");
  assert.equal(escapeCsvValue(Number.NaN), "");
});

test("toCsv writes BOM, header row, CRLF line endings and formats dates", () => {
  const csv = toCsv(
    [{ key: "name", label: "Name" }, { key: "days", label: "Days" }, { key: "on", label: "On" }],
    [{ name: "=cmd", days: 2, on: new Date("2025-03-03T00:00:00Z") }]
  );
  assert.equal(csv, "\uFEFFName,Days,On\r\n'=cmd,2,2025-03-03\r\n");
});
