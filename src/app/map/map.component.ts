import {Component, inject, OnInit} from '@angular/core';
import L from 'leaflet';
import 'leaflet.markercluster';
import {HttpClient} from '@angular/common/http';
import {filterStopDetails} from './filterStopDetails';
import filterBus, {ZpgsaBus} from './filterBus';
import {firstValueFrom} from 'rxjs';

export type Bus = {
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
};

export type Stop = {
  city: string;
  name: string;
  id: string;
  lat: number;
  lon: number;
};

export type StopDetails = {
  id: string;
  buses: StopDetailsBus[];
};

export type StopDetailsBus = {
  time: string;
  line: string;
  destination: string;
  operating_days: string;
  school_restriction: string;
}

export type Route = {
  id: string;
  label: string;
  lat: string;
  lon: string;
  name: string;
  order: string;
  platform: string;
  stopId: string;
}

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrl: './map.component.css'
})
export class MapComponent implements OnInit {
  private http = inject(HttpClient);

  private map: L.Map | undefined;
  private stops: Stop[] | undefined;
  private stopsDetails: Record<string, StopDetails> | undefined;
  private busMarkers: Record<string, L.Marker> = {};

  private currentRoute: L.Polyline | null = null;
  private currentRouteBusId: string | null = null;

  public features: boolean = false;

  private markersCluster: L.MarkerClusterGroup = new L.MarkerClusterGroup({
    iconCreateFunction: (cluster) => this.createStopIcon(cluster.getChildCount()),
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    animate: true,
    singleMarkerMode: true,
    maxClusterRadius: 30
  });

  ngOnInit() {
    this.initMap();
    this.loadStopsDetails();
    this.loadStops();
    this.initBusesLoop();
  }

  public toggleFeatures() {
    this.features = !this.features;
    if (this.currentRoute && this.map) this.map.removeLayer(this.currentRoute);
  }

  private initMap() {
    this.map = new L.Map('map', {
      center: L.latLng(50.71, 16.63),
      zoom: 13,
    });

    new L.TileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    this.markersCluster.addTo(this.map);
  }

  private loadStopsDetails() {
    this.http.get<Record<string, StopDetails>>('assets/data/stop_details.json').subscribe(
      (data) => {
        this.stopsDetails = data;
      }
    )
  }

  private createStopMarker(stop: Stop) {
    if (!this.map) return;

    const marker = new L.Marker(L.latLng(stop.lat, stop.lon));
    marker.bindPopup(new L.Popup());

    let pressTimer: ReturnType<typeof setTimeout>;

    marker.on("mousedown", () => {
      pressTimer = setTimeout(() => {
        window.open("https://zpgsa.bielawa.pl/wp-content/uploads/2025/03/BusDzierzoniow-Pilsudskieg.pdf");
      }, 500);
    });

    marker.on("mouseup, mouseout", () => {
      clearTimeout(pressTimer);
    });

    marker.on('click', (event) => {
      if (!this.stopsDetails) return;

      const stopDetails = this.stopsDetails[stop.id];
      const filteredStopDetails = filterStopDetails(stopDetails);

      event.target.getPopup().setContent(this.makeStopPopup(stop, filteredStopDetails))
    });

    return marker;
  }

  private loadStops() {
    this.http.get<Stop[]>('assets/data/stops.json').subscribe(stops => {
      this.stops = stops;

      stops.forEach((stop) => {
        if (!this.map) return;

        const marker = this.createStopMarker(stop)!;

        this.markersCluster.addLayer(marker);
      });
    });
  }

  private initBusesLoop() {
    setInterval(() => {
      this.http.get<ZpgsaBus[]>('/api/buses').subscribe(
        (buses) => {
          buses.forEach(async (_bus) => {
            const bus = filterBus(_bus);

            if (this.busMarkers[bus.id]) {
              this.busMarkers[bus.id].setLatLng(L.latLng(bus.lat, bus.lon));
              this.busMarkers[bus.id].setIcon(this.createBusIcon(bus));

              if (this.currentRouteBusId === bus.id && this.currentRoute) {
                const updatedLatLon = this.currentRoute.getLatLngs();
                updatedLatLon[0] = L.latLng(bus.lat, bus.lon);
                this.currentRoute.setLatLngs(updatedLatLon);
                await this.updateRoute(bus);
              }

              return;
            }

            const marker = new L.Marker(L.latLng(bus.lat, bus.lon), {
              icon: this.createBusIcon(bus),
              zIndexOffset: 100,
            })

            marker.bindPopup(new L.Popup());

            marker.on('click', async (event) => {
              if (!this.map) return;

              this.currentRouteBusId = bus.id;
              await this.updateRoute(bus);

              event.target.getPopup().setContent(this.makeBusPopup(bus)).openPopup();
            })

            if (!this.map) return;
            marker.addTo(this.map);

            this.busMarkers[bus.id] = marker;
          });
        }
      )
    }, 500)
  }

  private makeBusPopup(bus: Bus) {
    return `
       <div class="bus-popup-container">
        <div>Linia ${bus.line} | ${bus.label}</div>
        <div>${bus.destination}</div>
        <div>Odchyłka: ${bus.deviation}</div>
       </div>
    `;
  }

  private createBusIcon(bus: Bus) {
    return new L.DivIcon({
      iconSize: L.point(30, 30),
      className: `bus-icon ${bus.icon}`,
      html: `
        <div class="bus-line-number">${bus.line}</div>
      `
    });
  }

  private makeStopPopup(stop: Stop, stopDetails: StopDetails) {
    const stopDetailsBuses = stopDetails.buses.map(bus => {
      return `
        <div class="stop-popup-buses-container">
         <div class="stop-popup-buses-line">${bus.line}</div>
         <div class="stop-popup-buses-destination">${bus.destination}</div>
         <div class="stop-popup-buses-time">${bus.time}</div>
        </div>
      `
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

  private createStopIcon(count: number = 1) {
    return new L.DivIcon({
      iconSize: L.point(15, 15),
      className: 'stop-icon',
      html: `<span>${count}</span>`
    })
  }

  private async getRoute(bus: Bus): Promise<Route[]> {
    const routes = await firstValueFrom(this.http.get<Route[]>(`/api/routes/${bus.route}`));

    const currentOrder = routes.find(route => route.stopId === bus.latest_route_stop)?.order;
    if (!currentOrder) return [];

    return routes.filter(route => parseInt(route.order) > parseInt(currentOrder));
  }

  private async updateRoute(bus: Bus) {
    if (!this.map) return;

    if (!this.features) return; // temporary

    const routes = await this.getRoute(bus);

    const paths = routes
      .map(route => {
        const stop = this.stops?.find(stop => stop.id === route.stopId);
        return stop ? [stop.lat, stop.lon] : [0, 0];
      })
      .filter(([lat, lon]) => lat !== 0 && lon !== 0) as L.LatLngExpression[];

    const fullPath = [L.latLng(bus.lat, bus.lon), ...paths];

    if (this.currentRoute) this.map.removeLayer(this.currentRoute);
    this.currentRoute = new L.Polyline(fullPath, {color: 'red'}).addTo(this.map);
  }
}
