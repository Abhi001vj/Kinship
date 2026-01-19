
import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  isAuthenticated = signal<boolean>(false);
  
  constructor() {
    // Check session storage for persistence across reloads in same tab
    const storedAuth = sessionStorage.getItem('kinship_auth');
    if (storedAuth === 'true') {
      this.isAuthenticated.set(true);
    }
  }

  login(username: string, password: string): boolean {
    // Mock secure check. In real app, hash password and check against DB.
    // Demo credentials: demo / demo
    if (username === 'demo' && password === 'demo') {
      this.isAuthenticated.set(true);
      sessionStorage.setItem('kinship_auth', 'true');
      return true;
    }
    return false;
  }

  logout() {
    this.isAuthenticated.set(false);
    sessionStorage.removeItem('kinship_auth');
  }
}
