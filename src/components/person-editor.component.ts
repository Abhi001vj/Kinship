
import { Component, inject, signal, input, output, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FamilyService } from '../services/family.service';
import { ImageStorageService } from '../services/image-storage.service';
import { Person } from '../types';

@Component({
  selector: 'app-person-editor',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="bg-white rounded-xl shadow-2xl border border-stone-200 h-full flex flex-col overflow-hidden">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-stone-100 flex justify-between items-center bg-stone-50">
        <h3 class="text-lg font-bold text-stone-800">
            @if (mode() === 'add') { Add New Person } @else { Edit Person }
        </h3>
        <button (click)="cancel.emit()" class="text-stone-400 hover:text-stone-600 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Scrollable Form -->
      <div class="p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
        
        <!-- Photo Upload -->
        <div class="flex flex-col items-center justify-center mb-4">
           <div class="relative group cursor-pointer">
              @if (formData.photoUrl) {
                <img [src]="formData.photoUrl" class="h-24 w-24 rounded-full object-cover border-4 border-white shadow-md">
                <button (click)="removePhoto()" class="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full p-1 shadow hover:bg-rose-600 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                  </svg>
                </button>
              } @else {
                 <!-- Default Avatar Preview -->
                <div class="h-24 w-24 rounded-full bg-stone-50 flex flex-col items-center justify-center border-2 border-dashed border-stone-300 hover:border-rose-400 relative overflow-hidden">
                   <img [src]="familyService.getDefaultAvatar(formData.gender, formData.name || 'new')" class="absolute inset-0 w-full h-full opacity-50 grayscale hover:grayscale-0 transition-all">
                   <div class="z-10 bg-white/80 p-1 rounded text-[10px] font-medium text-stone-600">Upload Photo</div>
                   <input type="file" (change)="onFileSelected($event)" accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer z-20">
                </div>
              }
           </div>
           @if (isUploading()) {
               <span class="text-[10px] text-rose-500 mt-1 animate-pulse">Uploading to Cloud...</span>
           }
        </div>

        <div>
          <label class="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Full Name</label>
          <input type="text" [(ngModel)]="formData.name" class="block w-full rounded-xl border-stone-200 shadow-sm focus:border-rose-500 focus:ring-rose-500 py-3 px-3 border transition-all bg-stone-50" placeholder="e.g. Grandma Rose">
        </div>

        <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Role Type</label>
              <select [(ngModel)]="formData.role" class="block w-full rounded-xl border-stone-200 shadow-sm focus:border-rose-500 focus:ring-rose-500 py-3 px-2 border bg-stone-50">
                <option value="relative">Family Member</option>
                <option value="friend">Friend</option>
                <option value="groom">The Groom (Main)</option>
                <option value="bride">The Bride (Main)</option>
              </select>
            </div>
            
            <div>
              <label class="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Gender</label>
              <select [(ngModel)]="formData.gender" class="block w-full rounded-xl border-stone-200 shadow-sm focus:border-rose-500 focus:ring-rose-500 py-3 px-2 border bg-stone-50">
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="non-binary">Non-Binary</option>
                <option value="genderqueer">Genderqueer</option>
                <option value="agender">Agender</option>
                <option value="two-spirit">Two-Spirit</option>
                <option value="other">Other</option>
              </select>
            </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Occupation</label>
              <input type="text" [(ngModel)]="formData.occupation" class="block w-full rounded-xl border-stone-200 shadow-sm focus:border-rose-500 focus:ring-rose-500 py-3 px-3 border transition-all bg-stone-50" placeholder="e.g. Engineer">
            </div>
            
            <div>
              <label class="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Location</label>
              <input type="text" [(ngModel)]="formData.location" class="block w-full rounded-xl border-stone-200 shadow-sm focus:border-rose-500 focus:ring-rose-500 py-3 px-3 border transition-all bg-stone-50" placeholder="e.g. New York">
            </div>
        </div>

        <!-- Relationship Linker: Shown when adding -->
        @if (mode() === 'add') {
          <div class="pt-5 border-t border-stone-100">
             <div class="flex items-center gap-2 mb-3">
               <div class="p-1 bg-rose-100 rounded text-rose-600">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
               </div>
               <h4 class="text-sm font-bold text-stone-900">Relationship Connection</h4>
             </div>
             
             <div class="space-y-3">
                <div>
                   <label class="block text-xs font-medium text-stone-500 mb-1">Connect to</label>
                   @if(preselectedRelativeId()) {
                        <!-- Locked view if added via + button -->
                        <div class="block w-full rounded-xl border border-stone-200 bg-stone-100 py-2.5 px-3 text-stone-700">
                             {{ getPersonName(preselectedRelativeId()) }}
                        </div>
                   } @else {
                       <select [(ngModel)]="relationshipTargetId" class="block w-full rounded-xl border-stone-200 shadow-sm focus:border-rose-500 focus:ring-rose-500 py-2.5 px-3 border bg-stone-50">
                          <option value="">-- No Connection --</option>
                          @for (p of peopleList(); track p.id) {
                            <option [value]="p.id">{{ p.name }} ({{p.inferredRole || p.role}})</option>
                          }
                       </select>
                   }
                </div>
                
                @if (relationshipTargetId) {
                   <div>
                     <label class="block text-xs font-medium text-stone-500 mb-1">This new person is...</label>
                     <select [(ngModel)]="relationshipType" class="block w-full rounded-xl border-stone-200 shadow-sm focus:border-rose-500 focus:ring-rose-500 py-2.5 px-3 border bg-stone-50">
                       <option value="parent">Parent of Selected</option>
                       <option value="child">Child of Selected</option>
                       <option value="spouse">Spouse of Selected</option>
                       <option value="sibling">Sibling of Selected</option>
                       <option value="friend">Friend of Selected</option>
                     </select>
                   </div>
                }
             </div>
          </div>
        }

      </div>

      <!-- Actions -->
      <div class="p-6 border-t border-stone-100 flex flex-col gap-3 bg-stone-50">
        <button (click)="save()" [disabled]="isUploading()" class="w-full bg-gradient-to-r from-rose-600 to-orange-600 text-white py-3 px-4 rounded-xl hover:from-rose-700 hover:to-orange-700 transition-all shadow-md font-medium text-sm transform active:scale-[0.98] disabled:opacity-50">
          {{ mode() === 'add' ? 'Create Person' : 'Save Changes' }}
        </button>
        @if (mode() === 'edit') {
           <button (click)="delete()" class="w-full bg-white text-red-600 border border-red-200 py-2.5 px-4 rounded-xl hover:bg-red-50 transition-colors text-sm font-medium">
             Delete Person
           </button>
        }
      </div>
    </div>
  `
})
export class PersonEditorComponent {
  mode = input<'add' | 'edit'>('add');
  initialData = input<Person | null>(null);
  preselectedRelativeId = input<string | null>(null);
  
  saveComplete = output<string | undefined>(); // Returns new ID if added
  cancel = output<void>();

  familyService = inject(FamilyService);
  imageStorage = inject(ImageStorageService);
  peopleList = this.familyService.people;

  isUploading = signal(false);

  formData: Person = {
    id: '',
    name: '',
    role: 'relative',
    gender: 'other',
    occupation: '',
    location: ''
  };

  relationshipTargetId = '';
  relationshipType = 'parent';

  constructor() {
    effect(() => {
      if (this.initialData()) {
        this.formData = { ...this.initialData()! };
        this.relationshipTargetId = ''; 
      } else {
        this.resetForm();
      }
      
      // Auto-lock target if provided
      if (this.mode() === 'add' && this.preselectedRelativeId()) {
         this.relationshipTargetId = this.preselectedRelativeId()!;
         this.relationshipType = 'parent';
      }
    });
  }

  getPersonName(id: string | null): string {
      if (!id) return '';
      const p = this.peopleList().find(p => p.id === id);
      return p ? p.name : 'Unknown';
  }

  resetForm() {
    this.formData = {
      id: crypto.randomUUID(),
      name: '',
      role: 'relative',
      gender: 'other',
      photoUrl: '',
      occupation: '',
      location: ''
    };
    this.relationshipTargetId = '';
    this.relationshipType = 'parent';
  }

  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.isUploading.set(true);
      try {
        const url = await this.imageStorage.uploadImage(file);
        this.formData.photoUrl = url;
      } catch (e) {
        alert('Failed to upload image');
      } finally {
        this.isUploading.set(false);
      }
    }
  }

  removePhoto() {
    this.formData.photoUrl = undefined;
  }

  save() {
    if (!this.formData.name) return;

    if (this.mode() === 'add') {
      this.familyService.addPerson(this.formData);

      if (this.relationshipTargetId) {
        this.handleRelationships(this.formData.id, this.relationshipTargetId, this.relationshipType);
      }
    } else {
      this.familyService.updatePerson(this.formData);
    }
    
    // Emit the ID so the parent can select it
    this.saveComplete.emit(this.formData.id);
  }

  delete() {
    if (confirm('Are you sure you want to delete this person and their relationships?')) {
      this.familyService.deletePerson(this.formData.id);
      this.saveComplete.emit(undefined);
    }
  }

  private handleRelationships(newId: string, targetId: string, type: string) {
    switch (type) {
      case 'parent': 
        this.familyService.addRelationship(newId, targetId, 'parent');
        break;
      case 'child': 
        this.familyService.addRelationship(targetId, newId, 'parent');
        break;
      case 'spouse':
        this.familyService.addRelationship(newId, targetId, 'spouse');
        break;
      case 'friend':
        this.familyService.addRelationship(newId, targetId, 'friend');
        break;
      case 'sibling':
        const parents = this.familyService.relationships()
            .filter(r => r.target === targetId && r.type === 'parent')
            .map(r => r.source);
        
        if (parents.length > 0) {
            parents.forEach(pid => this.familyService.addRelationship(pid, newId, 'parent'));
        } else {
            alert('Note: Linked as sibling but target has no parents in tree. Relationship is only implied.');
        }
        break;
    }
  }
}
