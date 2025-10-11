// Navigation type definitions

export type AuthStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  SignUp: undefined;
};

export type MainStackParamList = {
  PeopleList: undefined;
  PersonDetail: { personId: string };
  Settings: undefined;
};
