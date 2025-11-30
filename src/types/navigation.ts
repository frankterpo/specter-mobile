// Navigation type definitions for Specter Mobile

// Auth stack (before sign in)
export type AuthStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  SignUp: undefined;
};

// Bottom tab navigator
export type MainTabParamList = {
  CompaniesTab: undefined;
  PeopleTab: undefined;
  InvestorsTab: undefined;
  TransactionsTab: undefined;
  MySpecterTab: undefined;
  AIAgentTab: undefined;
};

// AI Agent stack
export type AIAgentStackParamList = {
  AIAgent: undefined;
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

// Investors stack
export type InvestorsStackParamList = {
  InvestorsFeed: undefined;
  InterestSignals: undefined;
  InvestorDetail: { investorId: string };
};

// Transactions stack
export type TransactionsStackParamList = {
  FundingRounds: undefined;
  Acquisitions: undefined;
  IPOs: undefined;
  TransactionDetail: { transactionId: string };
};

// My Specter stack
export type MySpecterStackParamList = {
  Searches: undefined;
  Lists: undefined;
  Landscapes: undefined;
  SearchDetail: { searchId: string };
  ListDetail: { listId: string };
};

// Root stack (wraps tabs + modal screens)
export type RootStackParamList = {
  MainTabs: undefined;
  Settings: undefined;
  Search: undefined;
  Profile: undefined;
  Diagnostics: undefined;
};

// Legacy compatibility - for existing screens
export type MainStackParamList = {
  SwipeDeck: undefined;
  PersonDetail: { personId: string };
  Settings: undefined;
  Diagnostics: undefined;
};
