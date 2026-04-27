export type UserRole = 'inorins' | 'client';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  title: string;
  // client-only
  bankName?: string;
  bankDomain?: string;
  bankShortCode?: string;
}
