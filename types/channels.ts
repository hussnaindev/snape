export interface Channel {
  id: string;
  name: string;
  logo: string;
  country: string;
  languages: string[];
  categories: string[];
  streamUrl: string;
  quality: string;
  /** Extra metadata parsed from the display name (e.g. backup, geo, source). */
  tags: string[];
}
