// Navigation type definitions

export type AuthStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  SignUp: undefined;
};

import type { Person } from '../api/specter';

export type MainStackParamList = {
  Dashboard: undefined;
  SwipeDeck: { updatedPerson?: Person } | undefined;
  PersonDetail: { personId: string };
  CompanyDetail: { companyId: string };
  Settings: undefined;
  Diagnostics: undefined;
};
