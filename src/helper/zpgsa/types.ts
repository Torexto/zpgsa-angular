export interface Bus {
  id: string;
  label: string;
  lat: number;
  lon: number;
  line: string;
  route: string,
  latestRouteStop: string,
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

export interface ZpgsaBus {
  id: string;
  destination: string;
  line: string;
  label: string;
  deviation: number;
  lat: number;
  lon: number;

  route: string;
  latestRouteStop: string;

  active: string;
  latestPassingTime: number;
  vehicleComputer: string;
  vehicleFeatures: [];
}
