import { Injectable } from '@angular/core';
import { FirestoreCrudService } from './firestore-crud.service';
import { Customer } from '../models';

@Injectable({ providedIn: 'root' })
export class CustomerService extends FirestoreCrudService<Customer> {
  constructor() {
    super('customers');
  }
}
