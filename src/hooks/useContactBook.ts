import { useCallback } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useAuth } from '@/context/AuthContext';

export interface SavedContact {
  id: string;
  name: string;
  designation: string;
  phone: string;
  email: string;
}

export function useContactBook() {
  const { user } = useAuth();
  const key = user?.id ? `contactBook:${user.id}` : 'contactBook:guest';

  const [contacts, setContacts] = useLocalStorage<SavedContact[]>(key, []);

  const addContact = useCallback((data: Omit<SavedContact, 'id'>) => {
    const contact: SavedContact = { ...data, id: Date.now().toString() };
    setContacts((prev) => [...prev, contact]);
    return contact;
  }, [setContacts]);

  const updateContact = useCallback((id: string, data: Partial<Omit<SavedContact, 'id'>>) => {
    setContacts((prev) => prev.map((c) => c.id === id ? { ...c, ...data } : c));
  }, [setContacts]);

  const deleteContact = useCallback((id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
  }, [setContacts]);

  return { contacts, addContact, updateContact, deleteContact };
}
