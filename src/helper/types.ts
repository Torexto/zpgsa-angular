export interface Bus {
  id: string;
  label: string;
  lat: number;
  lon: number;
  line: string;
  route: string,
  latest_route_stop: string,
  deviation: string;
  icon: string;
  destination: string;
}

export interface Stop {
  city: string;
  name: string;
  id: string;
  lat: number;
  lon: number;
  href: string;
}

export interface StopDetailsBus {
  time: string;
  line: string;
  destination: string;
  operating_days: string;
  school_restriction: string;
}

export interface Route {
  "id": string;
  "line": string;
  "name": string;
  "details": string[];
}
