import assert from "node:assert/strict";
import { test } from "node:test";
import { detectFileType } from "../../utils/fileType.js";

test("detects PDF, JPEG and PNG by content", () => {
  assert.equal(detectFileType(Buffer.from("%PDF-1.7\n...")), "pdf");
  assert.equal(detectFileType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10])), "jpeg");
  assert.equal(detectFileType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])), "png");
});

test("rejects scripts, executables and truncated data renamed as documents", () => {
  assert.equal(detectFileType(Buffer.from("<?php echo 1; ?>")), null);
  assert.equal(detectFileType(Buffer.from("MZ\x90\x00\x03")), null);
  assert.equal(detectFileType(Buffer.from("%PD")), null);
  assert.equal(detectFileType(null), null);
});
