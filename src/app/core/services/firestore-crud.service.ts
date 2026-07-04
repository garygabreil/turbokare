import { inject } from '@angular/core';
import {
  CollectionReference,
  Firestore,
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  docData,
  orderBy,
  query,
  updateDoc,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

/**
 * Generic Firestore CRUD helper. Extend it with a concrete entity type and
 * collection name to get list/get/create/update/delete out of the box.
 */
export abstract class FirestoreCrudService<T extends { id?: string }> {
  protected readonly firestore = inject(Firestore);
  protected readonly ref: CollectionReference;

  protected constructor(protected readonly collectionName: string) {
    this.ref = collection(this.firestore, collectionName);
  }

  list(): Observable<T[]> {
    const q = query(this.ref, orderBy('createdAt', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<T[]>;
  }

  get(id: string): Observable<T> {
    const ref = doc(this.firestore, `${this.collectionName}/${id}`);
    return docData(ref, { idField: 'id' }) as Observable<T>;
  }

  create(data: T): Promise<unknown> {
    const payload = { ...data, createdAt: Date.now() } as T;
    delete (payload as { id?: string }).id;
    return addDoc(this.ref, payload as Record<string, unknown>);
  }

  update(id: string, data: Partial<T>): Promise<void> {
    const ref = doc(this.firestore, `${this.collectionName}/${id}`);
    const payload = { ...data };
    delete (payload as { id?: string }).id;
    return updateDoc(ref, payload as Record<string, unknown>);
  }

  remove(id: string): Promise<void> {
    const ref = doc(this.firestore, `${this.collectionName}/${id}`);
    return deleteDoc(ref);
  }
}
