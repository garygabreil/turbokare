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
import { Observable, shareReplay } from 'rxjs';

function stripUndefined<T extends Record<string, unknown>>(data: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

/**
 * Generic Firestore CRUD helper. Extend it with a concrete entity type and
 * collection name to get list/get/create/update/delete out of the box.
 */
export abstract class FirestoreCrudService<T extends { id?: string }> {
  protected readonly firestore = inject(Firestore);
  protected readonly ref: CollectionReference;
  private listCache: Observable<T[]> | null = null;

  protected constructor(protected readonly collectionName: string) {
    this.ref = collection(this.firestore, collectionName);
  }

  list(): Observable<T[]> {
    if (!this.listCache) {
      const q = query(this.ref, orderBy('createdAt', 'desc'));
      this.listCache = (collectionData(q, { idField: 'id' }) as Observable<T[]>).pipe(
        shareReplay({ bufferSize: 1, refCount: true }),
      );
    }
    return this.listCache;
  }

  get(id: string): Observable<T> {
    const ref = doc(this.firestore, `${this.collectionName}/${id}`);
    return docData(ref, { idField: 'id' }) as Observable<T>;
  }

  create(data: T): Promise<unknown> {
    const payload = stripUndefined({ ...data, createdAt: Date.now() } as Record<string, unknown>);
    delete payload['id'];
    return addDoc(this.ref, payload);
  }

  update(id: string, data: Partial<T>): Promise<void> {
    const ref = doc(this.firestore, `${this.collectionName}/${id}`);
    const payload = stripUndefined({ ...data } as Record<string, unknown>);
    delete payload['id'];
    return updateDoc(ref, payload);
  }

  remove(id: string): Promise<void> {
    const ref = doc(this.firestore, `${this.collectionName}/${id}`);
    return deleteDoc(ref);
  }
}
