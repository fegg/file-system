import * as fs from "node:fs";
import * as path from "node:path";
import { LazyFileContent, LazyFile } from "@mjackson/lazy-file";
import { lookup } from "mrmime";

/**
 * Opens and returns the directory with the given name.
 *
 * By default if the directory does not exist it will be created. You can opt out of this behavior
 * by using `{ autoCreate: false }` in the options.
 */
export function open(
  name: string,
  options: DirectoryOpenOptions = {}
): Directory {
  let stats: fs.Stats;
  try {
    stats = fs.statSync(name);
  } catch (error) {
    if (!isNoEntityError(error)) throw error;

    if (options?.autoCreate ?? true) {
      fs.mkdirSync(name, { recursive: true });
      stats = fs.statSync(name);
    } else {
      throw new Error(`Directory "${name}" does not exist`);
    }
  }

  if (!stats.isDirectory()) {
    throw new Error(`Path "${name}" is not a directory`);
  }

  return new Directory(name);
}

/**
 * Opens and returns the file with the given name.
 */
export function openFile(name: string): File {
  let stats: fs.Stats;
  try {
    stats = fs.statSync(name);
  } catch (error) {
    if (!isNoEntityError(error)) throw error;
    throw new Error(`File "${name}" does not exist`);
  }

  if (!stats.isFile()) {
    throw new Error(`Path "${name}" is not a file`);
  }

  return createFile(name, stats);
}

interface CommonFileProperties {
  dir: Directory;
  dirname: string;
  name: string;
  path: string;
}

export interface DirectoryOpenOptions {
  autoCreate?: boolean;
}

/**
 * A directory on the file system.
 */
export class Directory implements CommonFileProperties {
  #path: string;

  constructor(name: string) {
    this.#path = path.resolve(name);
  }

  /**
   * The parent directory of this directory.
   */
  get dir(): Directory {
    return new Directory(this.dirname);
  }

  /**
   * The path of the parent directory of this directory.
   */
  get dirname(): string {
    return path.dirname(this.path);
  }

  /**
   * Returns a subdirectory of this directory with the given name, or `null` if it does not exist.
   */
  subdir(name: string): Directory | null {
    let dirname = path.join(this.path, name);

    try {
      let stats = fs.statSync(dirname);
      return stats.isDirectory() ? new Directory(dirname) : null;
    } catch (error) {
      if (isNoEntityError(error)) return null;
      throw error;
    }
  }

  /**
   * A generator for all subdirectories of this directory.
   */
  *subdirs(filter = /.*/): Generator<Directory> {
    for (let entry of this.entries) {
      if (entry.isDirectory() && filter.test(entry.name)) {
        yield new Directory(path.join(this.path, entry.name));
      }
    }
  }

  /**
   * An array of the names of all entries in this directory.
   */
  get entryNames(): string[] {
    return fs.readdirSync(this.path);
  }

  /**
   * An array of all entries in this directory.
   */
  get entries(): fs.Dirent[] {
    return fs.readdirSync(this.path, { withFileTypes: true });
  }

  /**
   * Returns the file in this directory with the given name, or `null` if it does not exist.
   */
  file(name: string): File | null {
    let filename = path.join(this.path, name);

    try {
      let stats = fs.statSync(filename);
      return stats.isFile() ? createFile(filename, stats) : null;
    } catch (error) {
      if (isNoEntityError(error)) return null;
      throw error;
    }
  }

  /**
   * A generator for all files in this directory.
   */
  *files(filter = /.*/): Generator<File> {
    for (let entry of this.entries) {
      if (entry.isFile() && filter.test(entry.name)) {
        let filename = path.join(this.path, entry.name);
        yield createFile(filename, fs.statSync(filename));
      }
    }
  }

  /**
   * The name of this directory.
   */
  get name(): string {
    return path.basename(this.path);
  }

  /**
   * The full path to this directory.
   */
  get path(): string {
    return this.#path;
  }
}

/**
 * A regular file on the file system.
 */
export class File extends LazyFile implements CommonFileProperties {
  #path: string;

  constructor(
    content: BlobPart[] | string | LazyFileContent,
    name: string,
    props?: FilePropertyBag
  ) {
    let resolved = path.resolve(name);
    super(content, path.basename(resolved), { type: lookup(name), ...props });
    this.#path = resolved;
  }

  /**
   * The parent directory of this file.
   */
  get dir(): Directory {
    return new Directory(this.dirname);
  }

  /**
   * The path of the parent directory of this file.
   */
  get dirname(): string {
    return path.dirname(this.path);
  }

  /**
   * The full path to this file.
   */
  get path(): string {
    return this.#path;
  }

  /**
   * Returns the `fs.Stats` object for this file.
   *
   * [Node.js Reference](https://nodejs.org/api/fs.html#class-fsstats)
   */
  get stats(): fs.Stats {
    return fs.statSync(this.path);
  }
}

function createFile(filename: string, stats: fs.Stats): File {
  let content: LazyFileContent = {
    byteLength: stats.size,
    read(start, end) {
      return readFile(filename, start, end);
    }
  };

  return new File(content, filename, { lastModified: stats.mtimeMs });
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
