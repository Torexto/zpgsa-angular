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
  template: '<div id="map"></div>',
  styleUrl: './map.component.css'
})
export class MapComponent implements OnInit {
  private http = inject(HttpClient);

  private map: L.Map | undefined;
  private stopsDetails: Record<string, StopDetails> | undefined;
  private markers: Record<string, L.Marker> = {};

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
    const marker = new L.Marker(L.latLng(stop.lat, stop.lon))

    marker.on('click', (event) => {
      if (!this.stopsDetails) return;

      const stopDetails = this.stopsDetails[stop.id];
      const filteredStopDetails = filterStopDetails(stopDetails);

      const popupContent = new L.Popup().setContent(this.makeStopPopup(stop, filteredStopDetails))

      event.target.unbindPopup().bindPopup(popupContent).openPopup();
    })

    return marker;
  }

  private loadStops() {
    this.http.get<Stop[]>('assets/data/stops.json').subscribe(stops => {
      stops.forEach((stop) => {
        if (!this.map) return;

        const marker = this.createStopMarker(stop);

        this.markersCluster.addLayer(marker);
      });
    });
  }

  private initBusesLoop() {
    setInterval(() => {
      this.http.get<ZpgsaBus[]>('/api/buses').subscribe(
        (buses) => {
          buses.forEach((_bus) => {
            const bus = filterBus(_bus);

            if (this.markers[bus.id]) {
              this.markers[bus.id].setLatLng(L.latLng(bus.lat, bus.lon));
              return;
            }

            const marker = new L.Marker(L.latLng(bus.lat, bus.lon), {
              icon: this.createBusIcon(bus),
              zIndexOffset: 100
            })

            marker.on('click', async (event) => {
              const popupContent = new L.Popup().setContent(this.makeBusPopup(bus));

              const routes = await this.getRoute(bus);
              console.log(routes);

              event.target.unbindPopup().bindPopup(popupContent).openPopup();
            })

            if (!this.map) return;
            marker.addTo(this.map);

            this.markers[bus.id] = marker;
          })
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
}
