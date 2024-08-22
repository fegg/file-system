import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { LazyFileContent } from "@mjackson/lazy-file";
import { lookup } from "mrmime";

import { File } from "./file.js";

export class FileBrowser {
  #directory: string;

  constructor(directory: string) {
    try {
      let stat = fs.statSync(directory);

      if (!stat.isDirectory()) {
        throw new Error(`Path "${directory}" is not a directory`);
      }
    } catch (error) {
      if (!isNoEntityError(error)) {
        throw error;
      }

      fs.mkdirSync(directory, { recursive: true });
    }

    this.#directory = directory;
  }

  async *files() {
    for await (let filename of this.fileNames()) {
      yield this.get(filename) as File;
    }
  }

  async *fileNames() {
    let dir = await fsp.opendir(this.#directory);
    for await (let entry of dir) {
      yield entry.name;
    }
  }

  get(filename: string): File | null {
    try {
      let file = path.join(this.#directory, filename);
      let stat = fs.statSync(file);

      let content: LazyFileContent = {
        byteLength: stat.size,
        read(start, end) {
          return readFile(file, start, end);
        }
      };

      let props = {
        dirname: this.#directory,
        isDirectory: stat.isDirectory(),
        isFIFO: stat.isFIFO(),
        isFile: stat.isFile(),
        isSocket: stat.isSocket(),
        isSymbolicLink: stat.isSymbolicLink(),
        lastModified: stat.mtimeMs,
        type: lookup(filename)
      };

      return new File(content, filename, props);
    } catch (error) {
      if (!isNoEntityError(error)) {
        throw error;
      }

      return null;
    }
  }
}

function readFile(
  filename: string,
  start?: number,
  end = Infinity
): ReadableStream<Uint8Array> {
  let read = fs.createReadStream(filename, { start, end: end - 1 }).iterator();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      let { done, value } = await read.next();

      if (done) {
        controller.close();
      } else {
        controller.enqueue(value);
      }
    }
  });
}

function isNoEntityError(
  obj: unknown
): obj is NodeJS.ErrnoException & { code: "ENOENT" } {
  return obj instanceof Error && "code" in obj && obj.code === "ENOENT";
}
