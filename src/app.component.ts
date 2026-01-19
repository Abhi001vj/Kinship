
import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoginComponent } from './components/login.component';
import { PersonEditorComponent } from './components/person-editor.component';
import { TreeVisualizerComponent } from './components/tree-visualizer.component';
import { FaceImporterComponent } from './components/face-importer.component';
import { AuthService } from './services/auth.service';
import { FamilyService } from './services/family.service';
import { GeminiService } from './services/gemini.service';
import { Person, PathResult } from './types';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, LoginComponent, PersonEditorComponent, TreeVisualizerComponent, FaceImporterComponent],
  templateUrl: './app.component.html'
})
export class AppComponent {
  authService = inject(AuthService);
  familyService = inject(FamilyService);
  geminiService = inject(GeminiService);

  // Layout State
  isMobile = signal(false); 
  isSidebarOpen = signal(false);

  constructor() {
     this.isMobile.set(window.innerWidth < 768);
     window.addEventListener('resize', () => {
        this.isMobile.set(window.innerWidth < 768);
     });
  }

  toggleSidebar() {
    this.isSidebarOpen.update(v => !v);
  }

  closeSidebar() {
    this.isSidebarOpen.set(false);
  }

  selectedPersonId = signal<string | null>(null);
  
  // Selection Mode State for "Calculate Relationship With..."
  isSelectingTarget = signal(false);
  selectionSourceId = signal<string | null>(null);

  selectedPerson = computed(() => {
    const id = this.selectedPersonId();
    if (!id) return null;
    return this.familyService.people().find(p => p.id === id) || null;
  });

  currentPath = signal<PathResult | null>(null);
  relationshipAnalysis = signal<{ title: string, explanation: string, loading: boolean } | null>(null);

  // Editor State
  showEditor = signal(false);
  editorMode = signal<'add' | 'edit'>('add');
  editorData = signal<Person | null>(null);
  editorPreselectedRelativeId = signal<string | null>(null);

  // Importer State
  showImporter = signal(false);

  onNodeSelected(id: string) {
    if (this.isSelectingTarget()) {
        // We are in selection mode, so this click is the TARGET
        const source = this.selectionSourceId();
        if (source) {
            this.finishRelationshipSelection(source, id);
        }
        return;
    }

    // Normal selection
    this.selectedPersonId.set(id);
    this.currentPath.set(null); 
    this.relationshipAnalysis.set(null);
    this.isSidebarOpen.set(true); 
  }

  onAddRelative(sourceId: string) {
     this.editorMode.set('add');
     this.editorData.set(null);
     this.editorPreselectedRelativeId.set(sourceId);
     this.showEditor.set(true);
  }

  openAddModal() {
    this.editorMode.set('add');
    this.editorData.set(null);
    this.editorPreselectedRelativeId.set(null);
    this.showEditor.set(true);
  }

  editPerson(person: Person) {
    this.editorMode.set('edit');
    this.editorData.set(person);
    this.editorPreselectedRelativeId.set(null);
    this.showEditor.set(true);
  }

  onEditorComplete(newId?: string) {
    this.showEditor.set(false);
    // If a new person was created, select them immediately
    if (newId) {
        this.onNodeSelected(newId);
    }
  }

  closeEditor() {
    this.showEditor.set(false);
  }

  openImporter() {
    this.showImporter.set(true);
  }

  closeImporter() {
    this.showImporter.set(false);
  }

  startRelationshipSelection() {
     this.selectionSourceId.set(this.selectedPersonId());
     this.isSelectingTarget.set(true);
     // Close sidebar temporarily on mobile to allow selection
     if (this.isMobile()) this.isSidebarOpen.set(false);
  }

  cancelRelationshipSelection() {
      this.isSelectingTarget.set(false);
      this.selectionSourceId.set(null);
  }

  finishRelationshipSelection(sourceId: string, targetId: string) {
      this.isSelectingTarget.set(false);
      this.selectionSourceId.set(null);
      this.selectedPersonId.set(sourceId); // Ensure sidebar shows the source
      this.isSidebarOpen.set(true);
      
      this.calculatePath(sourceId, targetId);
  }

  calculatePath(startId: string, endId: string) {
    const startPerson = this.familyService.people().find(p => p.id === startId);
    const targetPerson = this.familyService.people().find(p => p.id === endId);
    
    if (!startPerson || !targetPerson) return;

    const path = this.familyService.findPath(startId, endId);
    
    if (path) {
       this.currentPath.set(path);
       
       this.relationshipAnalysis.set({ title: 'Analyzing...', explanation: 'Gemini is determining the relationship...', loading: true });
       
       this.geminiService.determineRelationship(path.description, startPerson.name, targetPerson.name)
           .then(result => {
             this.relationshipAnalysis.set({ ...result, loading: false });
           });
       
    } else {
       alert('No relationship path found between these two people.');
    }
  }
}
