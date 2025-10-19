import L from 'leaflet';
import "leaflet.markercluster";
import platform from 'platform';

import filterBus from './filterBus';
import filterStopDetails from './filterStopDetails';

import type {Bus, Route, Stop, StopDetailsBus, ZpgsaBus} from './types';

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


export default class Zpgsa {
  private map!: L.Map;

  private stops!: Stop[];
  private stopsDetails!: Record<string, StopDetailsBus[]>;
  private buses!: Map<string, Bus>;
  private routes!: Record<string, Route>;

  private busMarkers: Map<string, L.Marker> = new Map<string, L.Marker>();

  private currentRoute: L.Polyline | null = null;
  private currentRouteBusId: string | null = null;

  private constructor() {
    /* empty */
  }

  public static async new(mapId: string) {
    return await new Zpgsa().init(mapId);
  }

  private async init(mapId: string) {
    this.map = this.createMap(mapId);

    const [stops, stopDetails, routes] = await this.fetchData();

    this.stops = stops;
    this.stopsDetails = stopDetails;
    this.routes = routes;

    this.setupStopsLayer();
    setInterval(() => this.updateBuses(), 1000);

    return this;
  }

  private createMap(mapId: string): L.Map {
    const mapConfig: L.MapOptions = {
      center: L.latLng(50.71, 16.63),
      zoom: 13,
    };

    const map = new L.Map(mapId, mapConfig);

    const tileLayer = new L.TileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap contributors'
    });

    tileLayer.addTo(map);

    return map;
  }

  private async fetchData() {
    const stops = fetch("assets/data/stops.json").then((res) => res.json());
    const stopsDetails = fetch("assets/data/stop_details.json").then((res) => res.json());
    const routes = fetch("assets/data/routes.json").then((res) => res.json());

    return await Promise.all([stops, stopsDetails, routes]);
  }

  private setupStopsLayer() {
    // @ts-expect-error clusters don't have types
    const createStopIcon = (cluster: L.MarkerCluster) => {
      return new L.DivIcon({
        iconSize: L.point(15, 15),
        className: 'stop-icon',
        html: `<span>${cluster.getChildCount()}</span>`
      });
    };

    // @ts-expect-error clusters don't have types
    const stopMarkersConfig: L.MarkerClusterGroupOptions = {
      iconCreateFunction: createStopIcon,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      animate: true,
      singleMarkerMode: true,
      maxClusterRadius: 30
    };

    // @ts-expect-error clusters don't have types
    const stopsLayer = new L.MarkerClusterGroup(stopMarkersConfig);
    const stopMarkers = this.stops.map(stop => this.createStopMarker(stop));
    stopsLayer.addLayers(stopMarkers);
    stopsLayer.addTo(this.map);
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
      const filteredStopDetails = filterStopDetails(stopDetails);
      marker.getPopup()?.setContent(createStopPopup(stop, filteredStopDetails));
    });

    return marker;
  }

  private async fetchBuses() {
    return await fetch("/api/buses")
      .then((res) => res.json())
      .then((zpgsaBuses: ZpgsaBus[]) => zpgsaBuses.map(filterBus))
      .then((buses) => (
          buses.reduce(
            (map, bus) => map.set(bus.id, bus),
            new Map<string, Bus>())
        )
      );
  }

  private async updateBuses() {
    this.buses = await this.fetchBuses();
    this.buses.forEach(bus => {
      const busMarker = this.busMarkers.get(bus.id);

      if (!busMarker) {
        this.createBusMarker(bus);
        return;
      }

      busMarker.setLatLng(L.latLng(bus.lat, bus.lon));
      busMarker.setIcon(createBusIcon(bus));
    });

    this.updateRoute();
  }

  private createBusMarker(bus: Bus) {
    const marker = new L.Marker(L.latLng(bus.lat, bus.lon), {
      icon: createBusIcon(bus),
      zIndexOffset: 100,
    });
    marker.bindPopup(new L.Popup());

    marker.on('click', () => {
      const busInfo = this.buses.get(bus.id);
      const popup = marker.getPopup();
      if (!popup || !busInfo) return;

      const content = createBusPopup(busInfo);

      popup.setContent(content).openPopup();
    });

    marker.on("contextmenu", () => {
      this.currentRouteBusId = this.currentRouteBusId === bus.id ? null : bus.id;
      this.updateRoute();
    });

    this.busMarkers.set(bus.id, marker);
    marker.addTo(this.map);
  }

  private updateRoute() {
    if (!this.currentRouteBusId) {
      if (this.currentRoute) {
        this.map.removeLayer(this.currentRoute);
        this.currentRoute = null;
      }
      return;
    }

    const bus = this.buses.get(this.currentRouteBusId);
    if (!bus) return;

    let route = this.routes[bus.route]?.details ?? [];

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
    this.currentRoute = new L.Polyline(fullPath, {color: 'red'}).addTo(this.map);
  }
}
