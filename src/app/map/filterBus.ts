import {Bus} from './map.component';

export interface ZpgsaBus {
  id: string;
  destination: string;
  line: string;
  label: string;
  deviation: number;
  lat: number;
  lon: number;
  controlMan?: boolean;

  route: string;
  latestRouteStop: string;

  active: string;
  latestPassingTime: number;
  vehicleComputer: string;
  vehicleFeatures: [];
}

export default function filterBus(bus: ZpgsaBus): Bus {
  bus.label = (bus.label.split(" ")[0]).split("-")[0];
  bus.latestRouteStop = bus.latestRouteStop.split(" ")[0];

  const deviation = bus.deviation;
  const sign = deviation < 0 ? "-" : "+";
  const abs = Math.abs(deviation);

  const hours = Math.floor(abs / 3600000);
  const minutes = Math.floor((abs % 3600000) / 60000);
  const seconds = Math.floor((abs % 60000) / 1000);

  const pad = (n: number) => String(n).padStart(2, '0');

  const deviationString =
    sign +
    (hours > 0 ? `${pad(hours)}:` : "") +
    `${pad(minutes)}:${pad(seconds)}`;

  const icon =
    deviation > 0
      ? bus.controlMan ? "bus-control-man" :
        minutes >= 3 ? "bus-late" : "bus-on-time"
      : minutes >= 1 ? "bus-ahead" : "bus-on-time";

  return {
    id: bus.id,
    label: bus.label,
    lat: bus.lat,
    lon: bus.lon,
    line: bus.line,
    route: bus.route,
    latest_route_stop: bus.latestRouteStop,
    deviation: deviationString,
    icon,
    destination: bus.destination,

  };
}
