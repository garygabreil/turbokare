import { Injectable } from '@angular/core';
import { FirestoreCrudService } from './firestore-crud.service';
import { Invoice } from '../models';

@Injectable({ providedIn: 'root' })
export class InvoiceService extends FirestoreCrudService<Invoice> {
  constructor() {
    super('invoices');
  }
}
