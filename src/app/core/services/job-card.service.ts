import { Injectable } from '@angular/core';
import { FirestoreCrudService } from './firestore-crud.service';
import { JobCard } from '../models';

@Injectable({ providedIn: 'root' })
export class JobCardService extends FirestoreCrudService<JobCard> {
  constructor() {
    super('jobCards');
  }
}
