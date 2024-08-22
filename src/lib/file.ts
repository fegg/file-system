import { ByteRange, LazyFileContent, LazyFile } from "@mjackson/lazy-file";

export type FileProps = FilePropertyBag & {
  dirname?: string;
  isDirectory?: boolean;
  isFIFO?: boolean;
  isFile?: boolean;
  isSocket?: boolean;
  isSymbolicLink?: boolean;
};

export class File extends LazyFile {
  #props: FileProps;

  constructor(
    content: LazyFileContent,
    name: string,
    props: FileProps = {},
    range?: ByteRange
  ) {
    super(content, name, props, range);
    this.#props = props;
  }

  get dirname() {
    return this.#props.dirname ?? "";
  }

  /**
   * Returns `true` if this file is a directory.
   *
   * [Node.js Reference](https://nodejs.org/api/fs.html#statsisdirectory)
   */
  get isDirectory() {
    return this.#props.isDirectory ?? false;
  }

  /**
   * Returns `true` if this file describes a first-in-first-out (FIFO) pipe.
   *
   * [Node.js Reference](https://nodejs.org/api/fs.html#statsisfifo)
   */
  get isFIFO() {
    return this.#props.isFIFO ?? false;
  }

  /**
   * Returns `true` if this file describes a regular file.
   *
   * [Node.js Reference](https://nodejs.org/api/fs.html#statsisfile)
   */
  get isFile() {
    return this.#props.isFile ?? false;
  }

  /**
   * Returns `true` if this file describes a socket.
   *
   * [Node.js Reference](https://nodejs.org/api/fs.html#statsissocket)
   */
  get isSocket() {
    return this.#props.isSocket ?? false;
  }

  /**
   * Returns `true` if this file is a symbolic link.
   *
   * [Node.js Reference](https://nodejs.org/api/fs.html#statsissymboliclink)
   */
  get isSymbolicLink() {
    return this.#props.isSymbolicLink ?? false;
  }
}
