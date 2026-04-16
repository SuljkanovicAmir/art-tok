import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createCanvas } from "canvas";
import {
  prepareFeedImage,
  AspectOutOfRangeError,
  IG_MIN_ASPECT,
  IG_MAX_ASPECT,
} from "../lib/image-filter.mjs";

// Synthesize a solid-color JPEG buffer of given dimensions.
function makeJpeg(width, height, color = "#cccccc") {
  const c = createCanvas(width, height);
  const ctx = c.getContext("2d");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  return c.toBuffer("image/jpeg", { quality: 0.9 });
}

describe("prepareFeedImage", () => {
  it("accepts exact 4:5 (1080x1350)", async () => {
    const buf = makeJpeg(1080, 1350);
    const r = await prepareFeedImage(buf);
    assert.equal(r.width, 1080);
    assert.equal(r.height, 1350);
    assert.ok(Math.abs(r.aspect - 0.8) < 0.001);
    assert.ok(Buffer.isBuffer(r.buffer));
  });

  it("accepts square 1:1", async () => {
    const buf = makeJpeg(1080, 1080);
    const r = await prepareFeedImage(buf);
    assert.equal(r.width, 1080);
    assert.equal(r.height, 1080);
  });

  it("accepts 1.91:1 landscape", async () => {
    const buf = makeJpeg(1910, 1000);
    const r = await prepareFeedImage(buf);
    // Resized to 1080 wide
    assert.equal(r.width, 1080);
    assert.ok(r.height >= 560 && r.height <= 570);
  });

  it("downsizes oversized portrait to 1080 wide preserving aspect", async () => {
    const buf = makeJpeg(2400, 3000); // 4:5
    const r = await prepareFeedImage(buf);
    assert.equal(r.width, 1080);
    assert.equal(r.height, 1350);
  });

  it("leaves small in-range images unscaled", async () => {
    const buf = makeJpeg(600, 750); // 4:5, below 1080 wide
    const r = await prepareFeedImage(buf);
    assert.equal(r.width, 600);
    assert.equal(r.height, 750);
  });

  it("rejects taller than 4:5 (e.g. 3:4 portrait)", async () => {
    const buf = makeJpeg(900, 1200); // aspect 0.75, too tall
    await assert.rejects(
      () => prepareFeedImage(buf),
      (err) => {
        assert.ok(err instanceof AspectOutOfRangeError);
        assert.ok(err.aspect < IG_MIN_ASPECT);
        return true;
      },
    );
  });

  it("rejects ultra-tall (2:3 portrait)", async () => {
    const buf = makeJpeg(800, 1200); // aspect 0.667
    await assert.rejects(() => prepareFeedImage(buf), AspectOutOfRangeError);
  });

  it("rejects wider than 1.91:1 (e.g. 2:1 panorama)", async () => {
    const buf = makeJpeg(2000, 1000); // aspect 2.0
    await assert.rejects(
      () => prepareFeedImage(buf),
      (err) => {
        assert.ok(err instanceof AspectOutOfRangeError);
        assert.ok(err.aspect > IG_MAX_ASPECT);
        return true;
      },
    );
  });

  it("rejects ultra-wide (3:1 scroll)", async () => {
    const buf = makeJpeg(3000, 1000);
    await assert.rejects(() => prepareFeedImage(buf), AspectOutOfRangeError);
  });

  it("output buffer decodes as valid JPEG", async () => {
    const buf = makeJpeg(1080, 1350);
    const r = await prepareFeedImage(buf);
    // JPEG starts with FF D8 FF
    assert.equal(r.buffer[0], 0xff);
    assert.equal(r.buffer[1], 0xd8);
    assert.equal(r.buffer[2], 0xff);
  });
});
