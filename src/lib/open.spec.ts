import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as path from "node:path";

import { open, Directory, File } from "./open.js";

const __dirname = new URL(".", import.meta.url).pathname;

describe("open", () => {
  let fixtures = path.join(__dirname, "../test/fixtures");

  it("knows its parent directory", () => {
    assert.equal(open(fixtures).dir.name, "test");
  });

  it("knows its dirname", () => {
    assert.equal(open(fixtures).dirname, path.resolve(__dirname, "../test"));
  });

  it("knows its name", () => {
    assert.equal(open(fixtures).name, "fixtures");
  });

  it("knows its path", () => {
    assert.equal(open(fixtures).path, fixtures);
  });

  it("lists all entry names in a directory", () => {
    assert.deepEqual(open(fixtures).entryNames, [
      "a.txt",
      "b.txt",
      "c.txt",
      "sub",
      "sub2"
    ]);
  });

  it("lists all entries in a directory", () => {
    assert.deepEqual(
      open(fixtures).entries.map(entry => entry.name),
      ["a.txt", "b.txt", "c.txt", "sub", "sub2"]
    );
  });

  it("generates all files in a directory", () => {
    assert.deepEqual(
      Array.from(open(fixtures).files()).map(file => file.name),
      ["a.txt", "b.txt", "c.txt"]
    );
  });

  it("generates a list of all files in a directory that match a given pattern", () => {
    assert.deepEqual(
      Array.from(open(fixtures).files(/b/)).map(file => file.name),
      ["b.txt"]
    );
  });

  it("generates all subdirectories in a directory", () => {
    assert.deepEqual(
      Array.from(open(fixtures).subdirs()).map(dir => dir.name),
      ["sub", "sub2"]
    );
  });

  it("generates all subdirectories in a directory that match a given pattern", () => {
    assert.deepEqual(
      Array.from(open(fixtures).subdirs(/2/)).map(dir => dir.name),
      ["sub2"]
    );
  });

  it("returns a File object for a file in the directory", () => {
    let file = open(fixtures).file("a.txt");
    assert.ok(file instanceof File);
    assert.equal(file.name, "a.txt");
  });

  it('returns "null" for a file that does not exist in the directory', () => {
    let file = open(fixtures).file("does-not-exist.txt");
    assert.equal(file, null);
  });

  it("returns a Directory object for a subdirectory of the directory", () => {
    let sub = open(fixtures).subdir("sub");
    assert.ok(sub instanceof Directory);
    assert.equal(sub.name, "sub");
  });

  it('returns "null" for a subdirectory that does not exist in the directory', () => {
    let sub = open(fixtures).subdir("does-not-exist");
    assert.equal(sub, null);
  });

  it("reads the contents of a file in the directory", async () => {
    let file = open(fixtures).file("a.txt");
    assert.ok(file);
    assert.equal(await file.text(), "This is file a.\n");
  });

  it("slices the contents of a file in the directory", async () => {
    let file = open(fixtures).file("a.txt");
    assert.ok(file);
    assert.equal(await file.slice(0, 5).text(), "This ");
  });

  it("streams the contents of a file in the directory", async () => {
    let file = open(fixtures).file("a.txt");
    assert.ok(file);
    let decoder = new TextDecoder();
    let text = "";
    for await (let chunk of file.stream()) {
      text += decoder.decode(chunk, { stream: true });
    }
    text += decoder.decode();
    assert.equal(text, "This is file a.\n");
  });
});
