
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-stone-50 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <!-- Decorative background blobs -->
      <div class="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
         <div class="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-rose-200 rounded-full blur-3xl opacity-30"></div>
         <div class="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-orange-200 rounded-full blur-3xl opacity-30"></div>
         <div class="absolute -bottom-[10%] left-[20%] w-[50%] h-[50%] bg-stone-200 rounded-full blur-3xl opacity-40"></div>
      </div>

      <div class="max-w-md w-full space-y-8 bg-white/80 backdrop-blur-lg p-10 rounded-3xl shadow-xl border border-white/50 z-10">
        <div class="text-center">
          <div class="mx-auto h-16 w-16 bg-gradient-to-br from-rose-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg transform rotate-3 mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h2 class="text-3xl font-bold text-stone-800 tracking-tight">
            Welcome to Kinship
          </h2>
          <p class="mt-2 text-sm text-stone-500">
            Visualize your family history
          </p>
        </div>
        
        <form class="mt-8 space-y-6" (submit)="onSubmit($event)">
          <div class="space-y-4">
            <div>
              <label for="username" class="block text-sm font-medium text-stone-700 mb-1">Username</label>
              <input 
                id="username" 
                name="username" 
                type="text" 
                required 
                [(ngModel)]="username"
                class="appearance-none block w-full px-4 py-3 border border-stone-200 placeholder-stone-400 text-stone-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-stone-50 transition-all shadow-sm" 
                placeholder="Enter username"
              >
            </div>
            <div>
              <label for="password" class="block text-sm font-medium text-stone-700 mb-1">Password</label>
              <input 
                id="password" 
                name="password" 
                type="password" 
                required 
                [(ngModel)]="password"
                class="appearance-none block w-full px-4 py-3 border border-stone-200 placeholder-stone-400 text-stone-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-stone-50 transition-all shadow-sm" 
                placeholder="Enter password"
              >
            </div>
          </div>

          @if (error) {
            <div class="bg-red-50 text-red-600 text-sm py-2 px-4 rounded-lg text-center border border-red-100">
              {{ error }}
            </div>
          }

          <div>
            <button 
              type="submit" 
              class="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-700 hover:to-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Sign In
            </button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class LoginComponent {
  username = 'demo'; // Pre-filled
  password = 'demo'; // Pre-filled
  error = '';
  
  authService = inject(AuthService);

  onSubmit(e: Event) {
    e.preventDefault();
    if (this.authService.login(this.username, this.password)) {
      this.error = '';
    } else {
      this.error = 'Invalid credentials. Try demo/demo.';
    }
  }
}
