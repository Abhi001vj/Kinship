
import { Component, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaceDetectionService, DetectedFace } from '../services/face-detection.service';
import { GeminiService } from '../services/gemini.service';
import { FamilyService } from '../services/family.service';
import { Person, GenderIdentity } from '../types';

@Component({
  selector: 'app-face-importer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="h-full flex flex-col bg-white overflow-hidden">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-stone-100 flex justify-between items-center bg-stone-50">
        <div>
          <h3 class="text-lg font-bold text-stone-800">Smart Face Import</h3>
          <p class="text-xs text-stone-500">Upload group photos or PDF albums</p>
        </div>
        <button (click)="close.emit()" class="text-stone-400 hover:text-stone-600">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="flex-1 overflow-hidden flex flex-col md:flex-row">
        
        <!-- Left: Upload & Gallery -->
        <div class="flex-1 overflow-y-auto p-6 bg-stone-50 border-r border-stone-100">
          
          <!-- Upload Area -->
          <div class="mb-6">
            <label class="block w-full h-32 border-2 border-dashed border-stone-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-rose-400 hover:bg-white transition-colors">
               <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-stone-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
               </svg>
               <span class="text-sm text-stone-500 font-medium">Click to upload images or PDF album</span>
               <input type="file" multiple accept="image/*,application/pdf" (change)="handleFiles($event)" class="hidden">
            </label>
            @if (isProcessing()) {
              <div class="mt-2 flex items-center gap-2 text-xs text-rose-600 font-medium animate-pulse">
                 <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                   <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                   <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                 </svg>
                 Processing files... (PDFs may take longer)
              </div>
            }
          </div>

          <!-- Face Grid -->
          @if (detectedFaces().length > 0) {
            <h4 class="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">Extracted Faces ({{detectedFaces().length}})</h4>
            <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
               @for (face of detectedFaces(); track face.id) {
                 <button 
                   (click)="selectFace(face)" 
                   class="aspect-square rounded-xl overflow-hidden border-2 transition-all relative group"
                   [class.border-rose-500]="selectedFace()?.id === face.id"
                   [class.ring-2]="selectedFace()?.id === face.id"
                   [class.ring-rose-200]="selectedFace()?.id === face.id"
                   [class.border-transparent]="selectedFace()?.id !== face.id"
                   [class.scale-105]="selectedFace()?.id === face.id"
                 >
                   <img [src]="face.url" class="w-full h-full object-cover">
                   <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                 </button>
               }
            </div>
          } @else if (!isProcessing()) {
            <div class="text-center py-10 text-stone-400 text-sm">
               No faces detected yet.
            </div>
          }
        </div>

        <!-- Right: Editor -->
        <div class="w-full md:w-96 bg-white p-6 border-l border-stone-100 flex flex-col shadow-xl z-10" [class.opacity-50]="!selectedFace()" [class.pointer-events-none]="!selectedFace()">
           @if (selectedFace(); as face) {
             <div class="flex flex-col items-center mb-6">
                <div class="relative">
                  <img [src]="face.url" class="w-24 h-24 rounded-full border-4 border-rose-100 shadow-md mb-4 object-cover">
                  <button (click)="analyzeFace(face)" [disabled]="analyzing()" class="absolute -bottom-2 right-0 bg-indigo-600 text-white p-1.5 rounded-full shadow-lg hover:bg-indigo-700 transition-colors" title="Estimate Age & Gender">
                     @if (analyzing()) {
                        <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                     } @else {
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                     }
                  </button>
                </div>
                <h3 class="font-bold text-stone-800">Identify Person</h3>
             </div>

             <!-- Smart Description -->
             <div class="mb-4">
                <label class="block text-xs font-bold text-indigo-700 mb-1 flex justify-between">
                   <span>Describe & Auto-Fill</span>
                   <span class="text-[10px] font-normal text-indigo-400">Powered by Gemini</span>
                </label>
                <div class="relative">
                   <textarea [(ngModel)]="naturalDescription" placeholder="e.g. This is Uncle Bob, a carpenter from Ohio, he is the Groom's father." rows="3" class="w-full rounded-xl border-indigo-200 bg-indigo-50/50 text-sm p-3 focus:ring-indigo-500 focus:border-indigo-500"></textarea>
                   <button (click)="parseDescription()" [disabled]="!naturalDescription || parsing()" class="absolute bottom-2 right-2 bg-indigo-600 text-white p-1.5 rounded-lg text-xs font-bold shadow-md hover:bg-indigo-700 disabled:opacity-50">
                      @if (parsing()) { ... } @else { Auto-Map }
                   </button>
                </div>
             </div>

             <div class="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1">
                <div>
                   <label class="block text-xs font-semibold text-stone-500 mb-1">Name</label>
                   <input type="text" [(ngModel)]="formData.name" class="w-full rounded-lg border-stone-200 text-sm p-2 bg-stone-50" placeholder="Name">
                </div>

                <div class="grid grid-cols-2 gap-2">
                   <div>
                     <label class="block text-xs font-semibold text-stone-500 mb-1">Gender</label>
                     <select [(ngModel)]="formData.gender" class="w-full rounded-lg border-stone-200 text-sm p-2 bg-stone-50">
                       <option value="male">Male</option>
                       <option value="female">Female</option>
                       <option value="non-binary">Non-Binary</option>
                       <option value="genderqueer">Genderqueer</option>
                       <option value="agender">Agender</option>
                       <option value="two-spirit">Two-Spirit</option>
                       <option value="other">Other</option>
                     </select>
                   </div>
                   <div>
                      <label class="block text-xs font-semibold text-stone-500 mb-1">Est. Age</label>
                      <input type="text" [(ngModel)]="formMeta.ageGroup" class="w-full rounded-lg border-stone-200 text-sm p-2 bg-stone-50" placeholder="e.g. 30s">
                   </div>
                </div>

                <div class="grid grid-cols-2 gap-2">
                   <div>
                      <label class="block text-xs font-semibold text-stone-500 mb-1">Occupation</label>
                      <input type="text" [(ngModel)]="formData.occupation" class="w-full rounded-lg border-stone-200 text-sm p-2 bg-stone-50" placeholder="Job Title">
                   </div>
                   <div>
                      <label class="block text-xs font-semibold text-stone-500 mb-1">Location</label>
                      <input type="text" [(ngModel)]="formData.location" class="w-full rounded-lg border-stone-200 text-sm p-2 bg-stone-50" placeholder="City/State">
                   </div>
                </div>

                <div class="pt-4 border-t border-stone-100">
                   <h4 class="text-xs font-bold text-stone-900 mb-2">Connect To Tree</h4>
                   <div class="space-y-2">
                      <select [(ngModel)]="relationshipTargetId" class="w-full rounded-lg border-stone-200 text-sm p-2 bg-stone-50">
                        <option value="">-- Choose Relative --</option>
                        @for (p of peopleList(); track p.id) {
                          <option [value]="p.id">{{ p.name }} ({{p.role}})</option>
                        }
                      </select>

                      @if (relationshipTargetId) {
                        <select [(ngModel)]="relationshipType" class="w-full rounded-lg border-stone-200 text-sm p-2 bg-stone-50">
                           <option value="parent">is Parent of Selected</option>
                           <option value="child">is Child of Selected</option>
                           <option value="spouse">is Spouse of Selected</option>
                           <option value="sibling">is Sibling of Selected</option>
                        </select>
                      }
                   </div>
                </div>
             </div>

             <div class="mt-4 pt-4 border-t border-stone-100">
               <button (click)="addToTree()" [disabled]="!formData.name || !relationshipTargetId" class="w-full bg-gradient-to-r from-stone-800 to-stone-900 text-white py-3 rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm">
                 Add Person to Graph
               </button>
             </div>
           } @else {
             <div class="h-full flex items-center justify-center text-center text-stone-400 p-6 text-sm">
                Select a detected face to identify them.
             </div>
           }
        </div>
      </div>
    </div>
  `
})
export class FaceImporterComponent {
  close = output<void>();
  saveComplete = output<void>();

  faceService = inject(FaceDetectionService);
  geminiService = inject(GeminiService);
  familyService = inject(FamilyService);
  peopleList = this.familyService.people;

  isProcessing = signal(false);
  analyzing = signal(false);
  parsing = signal(false);
  
  detectedFaces = signal<DetectedFace[]>([]);
  selectedFace = signal<DetectedFace | null>(null);

  // Form
  naturalDescription = '';
  formData: Person = this.getEmptyPerson();
  formMeta = { ageGroup: '' };
  relationshipTargetId = '';
  relationshipType = 'parent';

  async handleFiles(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    this.isProcessing.set(true);
    const newFaces: DetectedFace[] = [];

    // Process sequentially to not freeze UI too much
    for (let i = 0; i < input.files.length; i++) {
       const file = input.files[i];
       if (file.type === 'application/pdf') {
          const faces = await this.faceService.processPdf(file);
          newFaces.push(...faces);
       } else {
          const faces = await this.faceService.processImage(file);
          newFaces.push(...faces);
       }
    }

    this.detectedFaces.update(current => [...current, ...newFaces]);
    this.isProcessing.set(false);
  }

  selectFace(face: DetectedFace) {
    this.selectedFace.set(face);
    this.naturalDescription = '';
    this.formData = {
       ...this.getEmptyPerson(),
       id: crypto.randomUUID(),
       // Use the base64 of the crop as the data URL
       photoUrl: `data:image/jpeg;base64,${face.base64}`
    };
    this.formMeta = { ageGroup: '' };
  }

  getEmptyPerson(): Person {
    return { id: '', name: '', role: 'relative', gender: 'other', occupation: '', location: '' };
  }

  async analyzeFace(face: DetectedFace) {
     this.analyzing.set(true);
     const result = await this.geminiService.analyzeFaceDemographics(face.base64);
     
     // Map broad AI result to specific gender if possible, else other
     let mappedGender: GenderIdentity = 'other';
     if (result.gender.includes('male')) mappedGender = 'male';
     if (result.gender.includes('female')) mappedGender = 'female';
     
     this.formData.gender = mappedGender;
     this.formMeta.ageGroup = result.ageGroup;
     this.analyzing.set(false);
  }

  async parseDescription() {
    if (!this.naturalDescription) return;
    this.parsing.set(true);

    const result = await this.geminiService.parseNaturalLanguageEntry(this.naturalDescription, this.peopleList());
    
    // Auto-fill fields if returned
    if (result.name) this.formData.name = result.name;
    if (result.gender) this.formData.gender = result.gender as GenderIdentity; // Needs careful mapping in real app
    if (result.occupation) this.formData.occupation = result.occupation;
    if (result.location) this.formData.location = result.location;
    if (result.targetId) this.relationshipTargetId = result.targetId;
    if (result.relationshipType) this.relationshipType = result.relationshipType;

    this.parsing.set(false);
  }

  addToTree() {
    if (!this.formData.name || !this.relationshipTargetId) return;

    if (this.formMeta.ageGroup) {
      this.formData.notes = `Est. Age: ${this.formMeta.ageGroup}`;
    }

    this.familyService.addPerson(this.formData);

    const newId = this.formData.id;
    const targetId = this.relationshipTargetId;
    
    switch (this.relationshipType) {
        case 'parent': this.familyService.addRelationship(newId, targetId, 'parent'); break;
        case 'child': this.familyService.addRelationship(targetId, newId, 'parent'); break;
        case 'spouse': this.familyService.addRelationship(newId, targetId, 'spouse'); break;
        case 'sibling':
            const parents = this.familyService.relationships()
                .filter(r => r.target === targetId && r.type === 'parent')
                .map(r => r.source);
            if (parents.length > 0) {
                parents.forEach(pid => this.familyService.addRelationship(pid, newId, 'parent'));
            } else {
               alert('Added as person, but sibling link requires target to have parents in tree.');
            }
            break;
    }

    this.detectedFaces.update(list => list.filter(f => f.id !== this.selectedFace()?.id));
    this.selectedFace.set(null);
    this.saveComplete.emit();
  }
}
