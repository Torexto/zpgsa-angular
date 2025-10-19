import type {Bus, ZpgsaBus} from './types';

function formatDeviation(ms: number): string {
  const sign = ms < 0 ? "-" : "+";
  const deviationMs = Math.abs(ms);

  const hours = Math.floor(deviationMs / 3600000);
  const minutes = Math.floor((deviationMs % 3600000) / 60000);
  const seconds = Math.floor((deviationMs % 60000) / 1000);

  const pad = (n: number) => n.toString().padStart(2, "0");

  return `${sign}${hours > 0 ? `${pad(hours)}:` : ""}${pad(minutes)}:${pad(seconds)}`;
}

function getIcon(deviation: number) {
  const minutes = Math.floor((Math.abs(deviation) % 3600000) / 60000);

  return deviation > 0
    ? minutes >= 3 ? "bus-late" : "bus-on-time"
    : minutes >= 1 ? "bus-ahead" : "bus-on-time";
}

export default function toBus(bus: ZpgsaBus): Bus {
  return {
    id: bus.id,
    label: bus.label.slice(0, 3),
    lat: bus.lat,
    lon: bus.lon,
    line: bus.line,
    route: bus.route,
    latestRouteStop: bus.latestRouteStop.split(" ")[0],
    deviation: formatDeviation(bus.deviation),
    icon: getIcon(bus.deviation),
    destination: bus.destination,
  };
}
