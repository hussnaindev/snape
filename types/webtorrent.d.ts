declare module 'webtorrent' {
  interface TorrentFile {
    name: string;
    length: number;
    path: string;
    renderTo(
      elem: HTMLVideoElement | string,
      opts: { autoplay?: boolean },
      cb?: (err: Error | null, elem: Element) => void,
    ): void;
  }

  interface Torrent {
    files: TorrentFile[];
    progress: number;
    on(event: 'error', cb: (err: Error | string) => void): this;
    destroy(cb?: () => void): void;
  }

  interface Options {
    fileIndex?: number;
  }

  class WebTorrent {
    constructor();
    add(torrentId: string, opts?: Options, cb?: (torrent: Torrent) => void): Torrent;
    destroy(cb?: () => void): void;
  }

  export type { Torrent, TorrentFile };
  export default WebTorrent;
}
