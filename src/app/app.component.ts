import {Component, OnInit} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {MapComponent} from './map/map.component';
import { inject } from '@vercel/analytics';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, MapComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'zpgsa';

  ngOnInit() {
    inject();
  }
}
