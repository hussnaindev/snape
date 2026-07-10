export interface Channel {
  id: string;
  name: string;
  logo: string;
  country: string;
  languages: string[];
  categories: string[];
  streamUrl: string;
  /** Metadata parsed from bracket segments in the display name. */
  tags: string[];
}
