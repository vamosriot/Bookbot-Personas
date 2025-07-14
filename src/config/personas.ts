import { Persona } from '@/types';
import { convertToRegularPersonas } from './marketing-personas';

// Use marketing personas as the main persona system
export const personas: Persona[] = convertToRegularPersonas();

export const getPersonaById = (id: string): Persona | undefined => {
  return personas.find(persona => persona.id === id);
};

export const getDefaultPersona = (): Persona => {
  return personas[0];
};

export const getAllPersonas = (): Persona[] => {
  return personas;
}; 