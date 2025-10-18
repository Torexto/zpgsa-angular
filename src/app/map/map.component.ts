import {Component, OnInit} from '@angular/core';
import {Zpgsa} from '../../helper/zpgsa';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrl: './map.component.css'
})
export class MapComponent implements OnInit {
  private zpgsa!: Zpgsa;

  async ngOnInit() {
    this.zpgsa = new Zpgsa("map");
    await this.zpgsa.init();
  }
}
