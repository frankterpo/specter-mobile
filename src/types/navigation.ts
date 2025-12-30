// Navigation type definitions for Specter Mobile

// Auth stack (before sign in)
export type AuthStackParamList = {
  Onboarding: undefined;
  SignIn: undefined;
  SignUp: undefined;
};

// Bottom tab navigator - V1 Specification
export type MainTabParamList = {
  CompaniesTab: undefined;
  PeopleTab: undefined;
  InvestorsTab: undefined;
  TransactionsTab: undefined;
  MySpecterTab: undefined;
  ApiTestingTab: undefined;
};

// Companies stack
export type CompaniesStackParamList = {
  CompaniesMain: undefined; // Top tabs: Database | Revenue
  CompanyDetail: { companyId: string; company?: any };
  SavedSearchResults: { searchId: string; name?: string; product?: string; queryId?: string };
};

export type CompaniesTopTabParamList = {
  Database: undefined;
  Revenue: undefined;
};

// People stack
export type PeopleStackParamList = {
  PeopleMain: undefined; // Top tabs: Database | Talent
  PersonDetail: { personId: string };
  SavedSearchResults: { searchId: string; name?: string; product?: string; queryId?: string };
};

export type PeopleTopTabParamList = {
  Database: undefined;
  Talent: undefined;
};

// Investors stack
export type InvestorsStackParamList = {
  InvestorsMain: undefined; // Top tabs: Database | Strategic
  InvestorDetail: { investorId: string };
};

export type InvestorsTopTabParamList = {
  Database: undefined;
  Strategic: undefined;
};

// Transactions stack
export type TransactionsStackParamList = {
  TransactionsMain: undefined; // Top tabs: Funding | Acquisition | IPO
  TransactionDetail: { transactionId: string };
};

export type TransactionsTopTabParamList = {
  Funding: undefined;
  Acquisitions: undefined;
  IPOs: undefined;
};

// My Specter stack
export type MySpecterStackParamList = {
  MySpecterMain: undefined; // Top tabs: Searches | Lists | Notifications
  SearchDetail: { searchId: string; name?: string; product?: string; queryId?: string };
  ListDetail: { listId: string; listName?: string };
};

export type MySpecterTopTabParamList = {
  Searches: undefined;
  Lists: undefined;
  Notifications: undefined;
};

// Settings stack
export type SettingsStackParamList = {
  SettingsMain: undefined;
};

// API Testing stack
export type ApiTestingStackParamList = {
  ApiTestingMain: undefined;
};

// Root stack (wraps tabs + auth screens)
export type RootStackParamList = {
  MainTabs: undefined;
  Onboarding: undefined;
  SignIn: undefined;
  SignUp: undefined;
  Settings: undefined;
  Search: undefined;
  Profile: undefined;
};
