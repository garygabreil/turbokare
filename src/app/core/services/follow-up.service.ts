import { Injectable } from '@angular/core';
import { FirestoreCrudService } from './firestore-crud.service';
import { CustomerFollowUp } from '../models';

@Injectable({ providedIn: 'root' })
export class FollowUpService extends FirestoreCrudService<CustomerFollowUp> {
  constructor() {
    super('followUps');
  }
}
