import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { LazyFileContent, LazyFile } from "@mjackson/lazy-file";
import { lookup } from "mrmime";

interface FileCommon {
  dir: Directory;
  dirname: string;
  name: string;
  path: string;
}

export interface OpenOptions {
  autoCreate?: boolean;
}

/**
 * A directory on the file system.
 */
export class Directory implements FileCommon {
  /**
   * Opens and returns the directory with the given name.
   *
   * By default if the directory does not exist it will be created. You can opt out of this behavior
   * by using `{ autoCreate: false }` in the options.
   */
  static open(name: string, options?: OpenOptions): Directory {
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

  #path: string;

  constructor(name: string) {
    this.#path = path.resolve(name);
  }

  /**
   * Deletes this directory (recursively) from the filesystem.
   */
  delete(): Promise<void> {
    return fsp.rm(this.path, { recursive: true });
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
    for (let entry of this.entries()) {
      if (entry.isDirectory() && filter.test(entry.name)) {
        yield new Directory(path.join(this.path, entry.name));
      }
    }
  }

  /**
   * An array of the names of all entries in this directory.
   */
  entryNames(): string[] {
    return fs.readdirSync(this.path);
  }

  /**
   * An array of all entries in this directory.
   */
  entries(): fs.Dirent[] {
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
    for (let entry of this.entries()) {
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

  /**
   * Removes the file with the given name from this directory.
   */
  async remove(file: string | File): Promise<void> {
    if (typeof file !== "string") file = file.name;
    await deleteFile(path.join(this.path, file));
  }

  /**
   * Writes the given file to this directory and returns the new `File` object.
   */
  async write(file: File): Promise<File> {
    await writeFile(path.join(this.path, file.name), file.stream());
    return this.file(file.name) as File;
  }
}

/**
 * Opens and returns the directory with the given name.
 *
 * By default if the directory does not exist it will be created. You can opt out of this behavior
 * by using `{ autoCreate: false }` in the options.
 */
export const open = Directory.open;

/**
 * A regular file on the file system.
 */
export class File extends LazyFile implements FileCommon {
  /**
   * Opens and returns a file with the given name.
   */
  static open(name: string, options?: OpenOptions): File {
    let stats: fs.Stats;
    try {
      stats = fs.statSync(name);
    } catch (error) {
      if (!isNoEntityError(error)) throw error;

      if (options?.autoCreate ?? true) {
        fs.writeFileSync(name, "");
        stats = fs.statSync(name);
      } else {
        throw new Error(`File "${name}" does not exist`);
      }
    }

    if (!stats.isFile()) {
      throw new Error(`Path "${name}" is not a file`);
    }

    return createFile(name, stats);
  }

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
   * Deletes this file from the filesystem.
   */
  async delete(): Promise<void> {
    await deleteFile(this.path);
  }

  /**
   * Saves this file to the filesystem and returns the new `File` object.
   */
  async save(): Promise<File> {
    return open(this.dirname).write(this);
  }

  slice(start?: number, end?: number, contentType?: string): File {
    let content = [super.slice(start, end)];
    return new File(content, this.path, { type: contentType });
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

/**
 * Opens and returns a file with the given name.
 */
export const openFile = File.open;

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

function writeFile(
  filename: string,
  stream: ReadableStream<Uint8Array>
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    let writeStream = fs.createWriteStream(filename);

    try {
      for await (let chunk of stream) {
        writeStream.write(chunk);
      }

      writeStream.end(() => {
        resolve();
      });
    } catch (error) {
      writeStream.destroy();
      reject(error);
    }
  });
}

function deleteFile(filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.unlink(filename, error => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function isNoEntityError(
  obj: unknown
): obj is NodeJS.ErrnoException & { code: "ENOENT" } {
  return obj instanceof Error && "code" in obj && obj.code === "ENOENT";
}
