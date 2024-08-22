import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as path from "node:path";

import { FileBrowser } from "./file-browser.js";

const __dirname = new URL(".", import.meta.url).pathname;

describe("FileBrowser", () => {
  let fixtures = path.join(__dirname, "../test/fixtures");

  it("lists all files in a directory", async () => {
    let browser = new FileBrowser(fixtures);

    let fileNames = [];
    for await (let filename of browser.fileNames()) {
      fileNames.push(filename);
    }

    assert.equal(fileNames, ["a.txt", "b.txt", "c.txt"]);
  });
});
