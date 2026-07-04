import { Injectable } from '@angular/core';
import { FirestoreCrudService } from './firestore-crud.service';
import { Vehicle } from '../models';

@Injectable({ providedIn: 'root' })
export class VehicleService extends FirestoreCrudService<Vehicle> {
  constructor() {
    super('vehicles');
  }
}
