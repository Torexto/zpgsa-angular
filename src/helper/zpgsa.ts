import L from 'leaflet';
import "leaflet.markercluster";
import type {Bus, Route, Stop, StopDetailsBus} from './types';
import filterBus, {ZpgsaBus} from './filterBus';
import platform from 'platform';
import {filterStopDetails} from './filterStopDetails';

function createBusPopup(bus: Bus) {
  return `
       <div class="bus-popup-container">
        <div>Linia ${bus.line} | ${bus.label}</div>
        <div>${bus.destination}</div>
        <div>Odchyłka: ${bus.deviation}</div>
       </div>
    `;
}

function createBusIcon(bus: Bus) {
  return new L.DivIcon({
    iconSize: L.point(30, 30),
    className: `bus-icon ${bus.icon}`,
    html: `
        <div class="bus-line-number">${bus.line}</div>
      `
  });
}

function createStopPopup(stop: Stop, buses: StopDetailsBus[]) {
  const stopDetailsBuses = buses.map(bus => {
    return `
        <div class="stop-popup-buses-container">
         <div class="stop-popup-buses-line">${bus.line}</div>
         <div class="stop-popup-buses-destination">${bus.destination}</div>
         <div class="stop-popup-buses-time">${bus.time}</div>
        </div>
      `;
  }).join("");

  return `
      <div>
        <div class="stop-popup-title">${stop.city} ${stop.name} (${stop.id})</div>
        <div>
            ${stopDetailsBuses}
        </div>
      </div>
    `;
}

// @ts-expect-error it works
function createStopIcon(cluster: L.MarkerCluster) {
  return new L.DivIcon({
    iconSize: L.point(15, 15),
    className: 'stop-icon',
    html: `<span>${cluster.getChildCount()}</span>`
  });
}

const mapConfig: L.MapOptions = {
  center: L.latLng(50.71, 16.63),
  zoom: 13,
};

// @ts-expect-error it works
const stopMarkersConfig: L.MarkerClusterGroupOptions = {
  iconCreateFunction: createStopIcon,
  showCoverageOnHover: false,
  zoomToBoundsOnClick: true,
  animate: true,
  singleMarkerMode: true,
  maxClusterRadius: 30
};

export class Zpgsa {
  private readonly map!: L.Map;

  private stops!: Stop[];
  private stopsDetails!: Record<string, StopDetailsBus[]>;
  private buses!: Bus[];
  private routes!: Record<string, Route>;

  private busMarkers: Record<string, L.Marker | undefined> = {};

  private currentRoute: L.Polyline | null = null;
  private currentRouteBusId: string | null = null;

  constructor(mapId: string) {
    this.map = new L.Map(mapId, mapConfig);

    new L.TileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);
  }

  public async init() {
    this.stops = await fetch("assets/data/stops.json").then((res) => res.json());
    this.stopsDetails = await fetch("assets/data/stop_details.json").then((res) => res.json());
    this.routes = await fetch("assets/data/routes.json").then((res) => res.json());

// @ts-expect-error it works
    const stopsLayer = new L.MarkerClusterGroup(stopMarkersConfig);
    const stopMarkers = this.stops.map(stop => this.createStopMarker(stop));
    stopsLayer.addLayers(stopMarkers);
    stopsLayer.addTo(this.map);
    this.initBusesLoop();
  }

  private initBusesLoop() {
    setInterval(async () => {
      const buses: ZpgsaBus[] = await fetch("/api/buses").then((res) => res.json());
      this.buses = buses.map(filterBus);
      this.buses.forEach(bus => {
        const busMarker = this.busMarkers[bus.id];

        if (!busMarker) {
          this.createBusMarker(bus);
          return;
        }

        busMarker.setLatLng(L.latLng(bus.lat, bus.lon));
        busMarker.setIcon(createBusIcon(bus));
        if (this.currentRouteBusId === bus.id && this.currentRoute) {
          queueMicrotask(() => this.updateRoute(bus.id));
        }
      });
    }, 1000);
  }

  private createStopMarker(stop: Stop) {
    const marker = new L.Marker(L.latLng(stop.lat, stop.lon));
    marker.bindPopup(new L.Popup());

    marker.on("contextmenu", (e) => {
      if (platform.os?.family === "iOS") {
        const content = `
          <div>
            <a href="${stop.href}" target="_blank">PDF</a>
          </div>
        `;

        L.popup()
          .setLatLng(e.latlng)
          .setContent(content)
          .openOn(this.map!);

        return;
      }

      window.open(stop.href);
    });

    marker.on('click', () => {
      const stopDetails = this.stopsDetails?.[stop.id] ?? [];
      console.log(stopDetails);
      const filteredStopDetails = filterStopDetails(stopDetails);
      console.log(filteredStopDetails);
      marker.getPopup()?.setContent(createStopPopup(stop, filteredStopDetails));
    });

    return marker;
  }

  private createBusMarker(bus: Bus) {
    const marker = new L.Marker(L.latLng(bus.lat, bus.lon), {
      icon: createBusIcon(bus),
      zIndexOffset: 100,
    });
    marker.bindPopup(new L.Popup());

    marker.on('click', () => {
      const busInfo = this.buses.find((bus1) => bus1.id === bus.id);
      marker.getPopup()
        ?.setContent(createBusPopup(busInfo!))
        .openPopup();
    });

    marker.on("contextmenu", () => {
      if (this.currentRouteBusId === bus.id && this.currentRoute) {
        this.currentRouteBusId = null;
        this.map.removeLayer(this.currentRoute);
        this.currentRoute = null;
      } else {
        this.currentRouteBusId = bus.id;
        queueMicrotask(() => this.updateRoute(bus.id));
      }
    });

    this.busMarkers[bus.id] = marker;
    marker.addTo(this.map);
  }

  private async updateRoute(busId: string) {
    const bus = this.buses.find((bus) => bus.id === busId)!;
    let route = this.routes[bus.route].details ?? [];

    const currentOrder = route.find(point => point === bus.latest_route_stop)!;

    route = route.slice(route.indexOf(currentOrder) + 1);

    if (this.currentRoute) {
      const updatedLatLon = this.currentRoute.getLatLngs();
      updatedLatLon[0] = L.latLng(bus.lat, bus.lon);
      this.currentRoute.setLatLngs(updatedLatLon);
    }

    const paths = route
      .map(point => {
        const stop = this.stops.find(stop => stop.id === point);
        return stop ? [stop.lat, stop.lon] : [0, 0];
      })
      .filter(([lat, lon]) => lat !== 0 && lon !== 0) as L.LatLngExpression[];

    const fullPath = [L.latLng(bus.lat, bus.lon), ...paths];

    if (this.currentRoute) this.map.removeLayer(this.currentRoute);
    if (this.currentRouteBusId !== busId) return;
    this.currentRoute = new L.Polyline(fullPath, {color: 'red'}).addTo(this.map);
  }
}
