import { Persona } from '@/types';
import { convertToRegularPersonas } from './marketing-personas';

// Use marketing personas as the main persona system
export const personas: Persona[] = convertToRegularPersonas();

// Debug: Log the personas to see what we actually have
console.log('Loaded personas:', personas.map(p => ({ id: p.id, displayName: p.displayName })));

// Clear any old persona IDs from localStorage
if (typeof window !== 'undefined') {
  const oldPersonaIds = ['pepa', 'jarka', 'honza', 'alena', 'sofie'];
  const savedPersonaId = localStorage.getItem('selectedPersona');
  if (savedPersonaId && oldPersonaIds.includes(savedPersonaId)) {
    localStorage.removeItem('selectedPersona');
    console.log('Cleared old persona ID from localStorage:', savedPersonaId);
  }
}

export const getPersonaById = (id: string): Persona | undefined => {
  return personas.find(persona => persona.id === id);
};

export const getDefaultPersona = (): Persona => {
  return personas[0];
};

export const getAllPersonas = (): Persona[] => {
  return personas;
}; 