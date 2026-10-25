import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  tyreRimRatio,
  outerDiameterMm,
  brakeRimRatio,
  validTyreProfile,
} from "../src/tyres.ts";
test("perfis usam proporção física coerente e disco menor que o aro", () => {
  for (let size = 14; size <= 22; size++) {
    assert.ok(tyreRimRatio(size, "low") > tyreRimRatio(size, "medium"));
    assert.ok(tyreRimRatio(size, "medium") > tyreRimRatio(size, "high"));
    assert.ok(outerDiameterMm(size, "high") > outerDiameterMm(size, "low"));
    assert.ok(brakeRimRatio(size) < 0.8);
  }
  assert.ok(Math.abs(brakeRimRatio(18) - 0.6124) < 0.001);
  assert.equal(validTyreProfile(undefined), "medium");
});
test("texturas fotográficas possuem alpha e aros sem freios permitem sobreposição", async () => {
  for (const name of [
    "tyre-texture",
    "brake-rotor",
    "silver-split-rim",
    "graphite-six-rim",
    "bronze-mesh-rim",
  ]) {
    const { data, info } = await sharp(
      new URL("../public/wheels/" + name + ".png", import.meta.url).pathname,
    )
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    assert.equal(info.width, 800);
    assert.equal(data[3], 0, "exterior transparente: " + name);
    if (name === "tyre-texture")
      assert.equal(
        data[(400 * 800 + 400) * 4 + 3],
        0,
        "pneu tem abertura real",
      );
    if (name.endsWith("-rim")) {
      let transparent = 0;
      for (let y = 150; y < 650; y++)
        for (let x = 150; x < 650; x++)
          if (data[(y * 800 + x) * 4 + 3] < 10) transparent++;
      assert.ok(transparent > 30000, "raios devem estar vazados: " + name);
    }
  }
});
