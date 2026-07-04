import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  getDocs,
  query,
  where,
} from '@angular/fire/firestore';
import { AppUser } from '../models';

const STORAGE_KEY = 'gms_current_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly firestore = inject(Firestore);
  private readonly usersRef = collection(this.firestore, 'users');

  private readonly currentUser = signal<AppUser | null>(this.restore());

  readonly user = computed(() => this.currentUser());
  readonly isLoggedIn = computed(() => this.currentUser() !== null);

  private restore(): AppUser | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as AppUser) : null;
    } catch {
      return null;
    }
  }

  private persist(user: AppUser | null): void {
    this.currentUser.set(user);
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  async register(data: Omit<AppUser, 'id' | 'createdAt' | 'role'> & { role?: AppUser['role'] }): Promise<AppUser> {
    const existing = await getDocs(query(this.usersRef, where('email', '==', data.email)));
    if (!existing.empty) {
      throw new Error('An account with this email already exists.');
    }

    const newUser: AppUser = {
      name: data.name,
      email: data.email,
      password: data.password,
      role: data.role ?? 'staff',
      createdAt: Date.now(),
    };

    const ref = await addDoc(this.usersRef, newUser);
    const created: AppUser = { ...newUser, id: ref.id };
    this.persist(created);
    return created;
  }

  async login(email: string, password: string): Promise<AppUser> {
    const snap = await getDocs(
      query(this.usersRef, where('email', '==', email), where('password', '==', password)),
    );

    if (snap.empty) {
      throw new Error('Invalid email or password.');
    }

    const docSnap = snap.docs[0];
    const user: AppUser = { id: docSnap.id, ...(docSnap.data() as AppUser) };
    this.persist(user);
    return user;
  }

  logout(): void {
    this.persist(null);
  }
}
