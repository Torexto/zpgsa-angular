import {Component, OnInit} from '@angular/core';
import {Zpgsa} from '../../helper/zpgsa/zpgsa';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrl: './map.component.css'
})
export class MapComponent implements OnInit {

  async ngOnInit() {
    await Zpgsa.new("map");
  }
}
