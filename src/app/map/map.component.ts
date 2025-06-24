import {Component, inject, OnInit} from '@angular/core';
import L from 'leaflet';
import 'leaflet.markercluster';
import {HttpClient} from '@angular/common/http';
import {filterStopDetails} from './filterStopDetails';
import filterBus, {ZpgsaBus} from './filterBus';
import {firstValueFrom} from 'rxjs';
import platform from 'platform';

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
  private stopsDetails: Record<string, StopDetailsBus[]> | undefined;

  private busMarkers: Record<string, L.Marker> = {};

  private currentRoute: L.Polyline | null = null;
  private currentRouteBusId: string | null = null;

  private markersCluster: L.MarkerClusterGroup | undefined;

  ngOnInit() {
    this.initMap();

    this.loadStopsDetails();
    this.loadStops();

    this.initBusesLoop();
  }

  private initMap() {
    this.map = new L.Map('map', {
      center: L.latLng(50.71, 16.63),
      zoom: 13,
    });

    new L.TileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    this.markersCluster = new L.MarkerClusterGroup({
      iconCreateFunction: this.createStopIcon,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      animate: true,
      singleMarkerMode: true,
      maxClusterRadius: 30
    });

    this.markersCluster.addTo(this.map);
  }

  private loadStopsDetails() {
    this.http.get<Record<string, StopDetailsBus[]>>('assets/data/stop_details.json')
      .subscribe((data) => this.stopsDetails = data);
  }

  private loadStops() {
    this.http.get<Stop[]>('assets/data/stops.json')
      .subscribe(stops => {
        this.stops = stops;
        stops.forEach((stop) => this.markersCluster!.addLayer(this.createStopMarker(stop)!));
      });
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

    marker.on('click', (event) => {
      console.log(stop.id);
      const stopDetails = this.stopsDetails![stop.id];
      const filteredStopDetails = filterStopDetails(stopDetails);
      event.target.getPopup().setContent(this.createStopPopup(stop, filteredStopDetails));
    });

    return marker;
  }

  private initBusesLoop() {
    setInterval(() => {
      this.http.get<ZpgsaBus[]>('/api/buses').subscribe(
        (buses) => {
          buses.forEach(async (_bus) => {
              const bus = filterBus(_bus);

              if (this.busMarkers[bus.id]) {
                const marker = this.busMarkers[bus.id];
                marker.setLatLng(L.latLng(bus.lat, bus.lon));
                marker.setIcon(this.createBusIcon(bus));
                marker.getPopup()?.setContent(this.createBusPopup(bus));

                if (this.currentRouteBusId === bus.id && this.currentRoute) {
                  await this.updateRoute(bus);
                }

                return;
              }

              this.createBusMarker(bus);
            }
          );
        }
      );
    }, 500);
  }

  private createBusMarker(bus: Bus) {
    const marker = new L.Marker(L.latLng(bus.lat, bus.lon), {
      icon: this.createBusIcon(bus),
      zIndexOffset: 100,
    });
    marker.bindPopup(new L.Popup());

    marker.on('click', async (event) => {
      event.target.openPopup();
    });

    marker.on("contextmenu", async () => {
      if (this.currentRouteBusId === bus.id) {
        this.currentRouteBusId = null;
        if (this.currentRoute) this.map!.removeLayer(this.currentRoute);
      } else {
        this.currentRouteBusId = bus.id;
        await this.updateRoute(bus);
      }

    });

    this.busMarkers[bus.id] = marker;
    marker.addTo(this.map!);
  }

  private createBusPopup(bus: Bus) {
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

  private createStopPopup(stop: Stop, buses: StopDetailsBus[]) {
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

  private createStopIcon(cluster: L.MarkerCluster) {
    return new L.DivIcon({
      iconSize: L.point(15, 15),
      className: 'stop-icon',
      html: `<span>${cluster.getChildCount()}</span>`
    });
  }

  private async getRoute(bus: Bus): Promise<Route[]> {
    const route = await firstValueFrom(this.http.get<Route[]>(`/api/routes/${bus.route}`));

    const currentOrder = route.find(point => point.stopId === bus.latest_route_stop)?.order;

    return currentOrder ? route.filter(point => parseInt(point.order) > parseInt(currentOrder)) : [];
  }

  private async updateRoute(bus: Bus) {
    const route = await this.getRoute(bus);

    if (this.currentRoute) {
      const updatedLatLon = this.currentRoute.getLatLngs();
      updatedLatLon[0] = L.latLng(bus.lat, bus.lon);
      this.currentRoute!.setLatLngs(updatedLatLon);
    }

    const paths = route
      .map(point => {
        const stop = this.stops?.find(stop => stop.id === point.stopId);
        return stop ? [stop.lat, stop.lon] : [0, 0];
      })
      .filter(([lat, lon]) => lat !== 0 && lon !== 0) as L.LatLngExpression[];

    const fullPath = [L.latLng(bus.lat, bus.lon), ...paths];

    if (this.currentRoute) this.map!.removeLayer(this.currentRoute);
    this.currentRoute = new L.Polyline(fullPath, {color: 'red'}).addTo(this.map!);
  }
}
