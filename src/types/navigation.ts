// Navigation type definitions

export type AuthStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  SignUp: undefined;
};

import type { Person } from '../api/specter';

export type MainStackParamList = {
  SwipeDeck: { updatedPerson?: Person } | undefined;
  PersonDetail: { personId: string };
  Settings: undefined;
  Diagnostics: undefined;
};
