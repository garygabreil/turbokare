import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  doc,
  getDoc,
  updateDoc,
} from '@angular/fire/firestore';
import { FirestoreCrudService } from './firestore-crud.service';
import { StockMovement, StockMovementType } from '../models';

@Injectable({ providedIn: 'root' })
export class StockMovementService extends FirestoreCrudService<StockMovement> {
  private readonly db = inject(Firestore);

  constructor() {
    super('stockMovements');
  }

  /**
   * Applies a stock movement to a part and records it in the audit log.
   * `in` increases stock, `out` decreases it, `adjust` sets an absolute value.
   */
  async record(
    part: { id?: string; name: string; sku?: string; quantity: number },
    type: StockMovementType,
    amount: number,
    reason: string,
    performedBy?: string,
  ): Promise<number> {
    if (!part.id) {
      throw new Error('Part is missing an id.');
    }

    const partRef = doc(this.db, `parts/${part.id}`);
    const snap = await getDoc(partRef);
    const balanceBefore = (snap.data()?.['quantity'] as number) ?? part.quantity;

    let balanceAfter: number;
    if (type === 'in') {
      balanceAfter = balanceBefore + amount;
    } else if (type === 'out') {
      balanceAfter = balanceBefore - amount;
      if (balanceAfter < 0) {
        throw new Error('Not enough stock available for this issue.');
      }
    } else {
      balanceAfter = amount;
    }

    await updateDoc(partRef, { quantity: balanceAfter });

    const movement: StockMovement = {
      partId: part.id,
      partName: part.name,
      sku: part.sku ?? '',
      type,
      quantity: amount,
      balanceBefore,
      balanceAfter,
      reason: reason || '',
      performedBy: performedBy || '',
      createdAt: Date.now(),
    };
    await addDoc(collection(this.db, 'stockMovements'), movement);

    return balanceAfter;
  }
}
