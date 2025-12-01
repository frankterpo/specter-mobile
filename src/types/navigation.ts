// Navigation type definitions for Specter Mobile

// Auth stack (before sign in)
export type AuthStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  SignUp: undefined;
};

// Bottom tab navigator - 4 tabs only
export type MainTabParamList = {
  CompaniesTab: undefined;
  PeopleTab: undefined;
  ListsTab: undefined;
  SettingsTab: undefined;
};

// Companies stack
export type CompaniesStackParamList = {
  CompaniesFeed: undefined;
  CompanyDetail: { companyId: string };
};

// People stack
export type PeopleStackParamList = {
  PeopleFeed: undefined;
  PersonDetail: { personId: string };
};

// Lists stack
export type ListsStackParamList = {
  ListsFeed: undefined;
  ListDetail: { listId: string };
};

// Settings stack
export type SettingsStackParamList = {
  SettingsMain: undefined;
};

// Root stack (wraps tabs + modal screens)
export type RootStackParamList = {
  MainTabs: undefined;
  Settings: undefined;
  Search: undefined;
  Profile: undefined;
};

// Legacy compatibility types
export type InvestorsStackParamList = {
  InvestorsFeed: undefined;
  InterestSignals: undefined;
  InvestorDetail: { investorId: string };
};

export type TransactionsStackParamList = {
  FundingRounds: undefined;
  Acquisitions: undefined;
  IPOs: undefined;
  TransactionDetail: { transactionId: string };
};

export type MySpecterStackParamList = {
  Searches: undefined;
  Lists: undefined;
  Landscapes: undefined;
  SearchDetail: { searchId: string };
  ListDetail: { listId: string };
};

export type AIAgentStackParamList = {
  AIAgent: undefined;
};

export type MainStackParamList = {
  SwipeDeck: undefined;
  PersonDetail: { personId: string };
  Settings: undefined;
  Diagnostics: undefined;
};
