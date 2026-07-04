import { Injectable, computed, signal } from '@angular/core';
import { AppUser } from '../models';

const STORAGE_KEY = 'gms_current_user';

// Fixed credentials, by request. There is no sign-up.
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin';

@Injectable({ providedIn: 'root' })
export class AuthService {
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

  async login(username: string, password: string): Promise<AppUser> {
    const isValid =
      username.trim().toLowerCase() === ADMIN_USERNAME &&
      password.trim().toLowerCase() === ADMIN_PASSWORD;

    if (!isValid) {
      throw new Error('Invalid username or password.');
    }

    const user: AppUser = {
      name: 'Administrator',
      username: ADMIN_USERNAME,
      role: 'admin',
    };
    this.persist(user);
    return user;
  }

  logout(): void {
    this.persist(null);
  }
}
