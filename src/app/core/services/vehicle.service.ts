import { Injectable } from '@angular/core';
import { collectionData } from '@angular/fire/firestore';
import { Observable, map, shareReplay } from 'rxjs';
import { FirestoreCrudService } from './firestore-crud.service';
import { Vehicle } from '../models';

@Injectable({ providedIn: 'root' })
export class VehicleService extends FirestoreCrudService<Vehicle> {
  private vehicleListCache: Observable<Vehicle[]> | null = null;

  constructor() {
    super('vehicles');
  }

  /** List all vehicles (no Firestore orderBy — includes legacy docs without createdAt). */
  override list(): Observable<Vehicle[]> {
    if (!this.vehicleListCache) {
      this.vehicleListCache = (collectionData(this.ref, { idField: 'id' }) as Observable<Vehicle[]>).pipe(
        map((items) => [...items].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))),
        shareReplay({ bufferSize: 1, refCount: true }),
      );
    }
    return this.vehicleListCache;
  }
}
