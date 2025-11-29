// Navigation type definitions

export type AuthStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  SignUp: undefined;
};

import type { Person, Company } from '../api/specter';

export type MainStackParamList = {
  Dashboard: undefined;
  SwipeDeck: { updatedPerson?: Person } | undefined;
  PersonDetail: { personId: string };
  CompanyDetail: { companyId: string; companyData?: Company };
  Settings: undefined;
  Diagnostics: undefined;
  Persona: undefined;
};
