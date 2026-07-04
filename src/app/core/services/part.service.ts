import { Injectable } from '@angular/core';
import { FirestoreCrudService } from './firestore-crud.service';
import { Part } from '../models';

@Injectable({ providedIn: 'root' })
export class PartService extends FirestoreCrudService<Part> {
  constructor() {
    super('parts');
  }
}
