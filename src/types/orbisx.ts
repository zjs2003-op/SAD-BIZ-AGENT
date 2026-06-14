export interface OrbisXEvent {
  id: string;
  title: string;
  client: string;
  date: string;
  time: string;
  details: string;
  phone: string;
  email: string;
  address: string;
  service: string;
  status: string;
  raw: Record<string, unknown>;
}
