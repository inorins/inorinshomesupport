export type Priority = 'Critical' | 'High' | 'Medium' | 'Low';
export type TicketStatus = 'Open' | 'In Progress' | 'Pending Client' | 'Resolved' | 'Closed';
export type Environment = 'UAT' | 'Production';

export interface AttachmentMetadata {
  name: string;
  size: number;
  type: string;
  url?: string;
}

export interface Ticket {
  id: string;
  title: string;
  bankName?: string;
  system: string;
  module: string;
  moduleDetails?: string;
  form: string;
  requestType?: 'Issue' | 'Add Form' | 'Add Report';
  requestedDelivery?: string;
  priority: Priority;
  status: TicketStatus;
  environment: Environment;
  lastUpdated: string;
  reporter: string;
  reporterEmail: string;
  assignee?: string;
  description: string;
  attachments?: AttachmentMetadata[];
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  author: string;
  role: 'client' | 'employee';
  content: string;
  timestamp: string;
  isInternal: boolean;
}

export const systemModules: Record<string, Record<string, string[]>> = {
  CBS: {
    
    'Client Management': ['Client Registration'],

    'Client Details': [
        'General Detail', 'Global ID Assignment', 'Screening AML', 'Screening FROZEN',
        'Individual Detail', 'Joint Client Detail', 'Organizational Detail',
        'Board Of Directors', 'Branch and Offices', 'Client Associations',
        'Client Photo', 'Client Documents', 'Client Remarks', 'Additional Information',
        'Individual Registration', 'Asset Details', 'CIB Detail', 'Check Black List',
        'CIB Details Download', 'Frozen Letter', 'Release Letter', 'Check Frozen List',
        'Credit Score', 'Check Release List', 'Frozen Letter Entities Modify',
        'Frozen Letter Document Modify', 'Release Letter Entity Modify',
        'Release Letter Document Modify', 'Client Bulk Create', 'Client Retailer',
        'Loan Bulk Create', 'Client Status Set', 'Client Blacklisting',
        'Client Normalizing', 'Transaction Upload', 'Client Minor Release',
        'Client Deactivate', 'Corporate Groups', 'Corporate Group Assignment',
        'CRM Groups', 'CRM Group Assignment'
    ],

    'Setups': [
        'Ledgers', 'Account Category', 'Client Category', 'Client Sector',
        'Accountwise Client Ledgers', 'Security Type', 'NRB Loan Type',
        'NRB Loan Category', 'NRB Loan Sectors', 'NRB Loan Grade Ledgers',
        'Registerwise IE Ledgers', 'Report Submitting Authority'
    ],

    'Report': ['NRB Report', 'Setup Report', 'Mapping Report'],

    'Vault Cash': ['Vault Distribution', 'Vault Returns'],

    'Teller Cash': [
        'Cash Forwarding', 'Cash Return', 'Cash Acceptance',
        'Circulation Cancelations', 'Circulation Terminations'
    ],

    'Account Openings': [
        'Deposit Accounts Open', 'Loan Accounts Open', 'Bank Accounts Open',
        'Placement Accounts Open', 'Lending Accounts Open',
        'Borrowing Accounts Open', 'Office Accounts Open',
        'Receivable Accounts Open', 'Payable Accounts Open',
        'Other Accounts Open', 'Account Replicate', 'Account Enquiry'
    ],

    'Account Details': [
        'General Detail Set', 'Interest Detail Set', 'Maturity Detail Set',
        'Fund Management Set', 'Account Operator Set', 'Term Deposit Detail Set',
        'Loan Detail Set', 'Account Schedule', 'Loan Limit Set',
        'Loan Insurances', 'Due Recovery Setup', 'Loan Securities',
        'FD Release', 'Client Package Accounts', 'Account Transfer',
        'Additional Account Information', 'Account Documents',
        'Account Remarks', 'Account Report Control'
    ],

    'Instructions': [
        'Account Liens', 'Account Lien Release', 'System Lien Release',
        'Fund Trnf Instruction', 'Balance Trnf Instruction',
        'Withdrawal Notices', 'Individual Account Charges',
        'Scheduled Charge Assignment', 'Transaction Restriction Set',
        'Withdrawal Notice Days'
    ],

    'Account Status': [
        'Account Dormanting', 'Account Reactivating', 'Account Suspending',
        'Account Releasing', 'Account Freezing', 'Account Unfreezing',
        'Interest Freezing', 'Interest UnFreezing', 'Loan approval rule',
        'Loan User Approval rule', 'Fiancial Type', 'Params Check list'
    ],

    'Cheque Management': [
        'Cheque Issue', 'Cheque Print', 'Cheque Delivery',
        'Cheque Personalization', 'Cheque Destroy', 'Cheque Stop',
        'Cheque Release', 'Branch Cheque issue', 'Cheque Cancel',
        'Good for Payment'
    ],

    'Account Transactions': [
        'Transaction', 'Deposit Account Transaction', 'Loan Account Transaction',
        'Bank Account Transaction', 'Other Account Transaction',
        'Center Collections', 'Account Transfer', 'Account Interest Posting',
        'Penalty Posting', 'Maintenance Charge Posting',
        'Low Balance Charge Posting', 'Excess Cheque Withdrawal Charge Posting',
        'Loan Due Collection', 'GNSL Premium Posting',
        'Deposit Account Closing', 'Loan Account Closing',
        'Other Account Closing', 'Bank Account Closing',
        'Deposit Renewal', 'Loan Writeoff'
    ],

    'Deals': [
        'Cash Deals', 'Fund Deals', 'Forex Rates', 'TC Sales',
        'TC Stock Purchase', 'TC Stock Return', 'TC Stock Movement'
    ],

    'Guarantee Details': [
        'Guarantee Details', 'Security', 'Security Release',
        'Guarantee Insurances', 'Guarantee Ammendments',
        'Guarantee Setlements'
    ],

    'Accountings': [
        'Journal Vouchers', 'Special Vouchers', 'Bulk voucher',
        'Inter Branch Vouchers', 'Additional Voucher Details',
        'Voucher Reversal'
    ],

    'Pay Order': [
        'Pay Order Issue', 'Pay Order Cancellation',
        'Pay Order Payment Stop', 'Pay Order Payment Release',
        'Pay Order Payment'
    ],

    'Bank Draft': [
        'Draft Issue', 'Draft Cancellation',
        'Draft Payment Stop', 'Draft Payment Release'
    ],

    'NRB Reports': [
        'Ledger Mapping', 'Account Mapping', 'Loan Type Mapping',
        'Loan Category Mapping', 'Loan Sector Mapping',
        'Loan Security Mapping', 'Client Mapping',
        'Generate GoAML Report', 'Generate CIB Report',
        'Regulatory Letters'
    ],

    'Monitoring': [
        'User Logins', 'User Activities', 'Job Status', 'Job Cancellation',
        'Outstanding Jobs', 'Batch Job Detail', 'Balance Movement',
        'Loan Loss Assessment'
    ],

    'Periodic Functions': [
        'Job Scheduling', 'Balance Watch List', 'BOD Operation',
        'EOD Operation', 'Operation Suspension', 'Operation Resumption',
        'Branch Status Setting'
    ],

    'EOD Processes': [
        'Remote Transaction Suspension', 'Remote Transaction Reloading',
        'Scheduled Charge Recovery', 'Low Balance Charge Recovery',
        'Maintenance Charge Recovery', 'Excess Cheque Charge Recovery',
        'Maturity Transfer', 'Scheduled Paybacks', 'Os Loan Due Recovery',
        'Scheduled Deposit', 'Scheduled Fund Transfer',
        'Scheduled Balance Transfer', 'Balance Management',
        'Interest Posting', 'Insurance Premium Posting',
        'Loan Due Recovery', 'Account Dormant', 'Loan Loss Provision',
        'Bill Purchase Loss Provision', 'Closing Ledger Balance Adjustment',
        'Data Upload for Online Banking Services',
        'Data Upload for Remote Services', 'Set Remote Services OFFLINE',
        'Delivery Chanel Activation', 'Close Day Operation',
        'Financial Statement Backup', 'Database Backup',
        'Holiday', 'Holiday Report'
    ],

    'Configurations': [
        'Modules', 'System Objects', 'Menu', 'Parameters',
        'Module Activation', 'Module Deactivation',
        'System Reconfiguration', 'Printer Configuration',
        'UI Reconfiguration', 'UI Activation', 'UI Deactivation',
        'Sequence Configuration', 'Configuration Reports'
    ],

    'Access Management': [
        'Roles Management', 'Role Resumption', 'Role Suspension',
        'Edit Role Detail', 'Assign User Capacities',
        'Responsibility', 'User Management', 'User Login Resumption'
    ],

    'User Modify': [
        'Priviledges Modify', 'User Detail Modify',
        'User Login Suspension', 'User Branch Setting',
        'Reset Password', 'Access Profiles'
    ],

    'Utilities': [
        'Date Conversion', 'Calendar', 'Preferences', 'Password Change'
    ]

  },
 ECL: {
  'Economic Indicators': [
    'Indicators List',
    'Indicator Configuration',
    'Trend Probability Configuration',
    'Macro-economic Data',
    'Macro-economic Effect Assessment',
    'Reports'
  ],

  'Portfolios': [
    'Portfolio List',
    'Portfolio Configuration',
    'Portfolio wise Economic Index Configuration',
    'Portfolio Segmentation Rules',
    'Reports'
  ],

  'Due Stages': [
    'Due Stage List',
    'Due Stage Configuration',
    'Due Stage Preset Reason',
    'Reports'
  ],

  'Collaterals': [
    'Collateral Types',
    'RGL Collateral Types',
    'Collateral wise Economic Index Configuration',
    'Collateral Recovery Configuration',
    'Valuation Sources',
    'Valuation Source Weightages',
    'Collateral wise Valuation Source Mapping',
    'Reports'
  ],

  'Miscellaneous Setup': [
    'Restructure Types',
    'Restructure Reason',
    'Loan Loss Classes',
    'Loan Loss Class Preset Reason',
    'Settlement Reason',
    'Client Classifications',
    'Credit Classifications',
    'Reports'
  ],

  'Client Classifications': [
    'Client Types',
    'Client Sectors',
    'Client Categories',
    'RGL Client Types',
    'RGL Client Sectors',
    'RGL Client Categories',
    'Client Groups',
    'Occupations'
  ],

  'Credit Classifications': [
    'Credit Types',
    'Credit Sectors',
    'Credit Categories',
    'RGL Credit Types',
    'RGL Credit Sectors',
    'RGL Credit Categories'
  ],

  'Credit Facility Management': [
    'Credit Restructure',
    'Due Stage Preset',
    'Loan Loss Class Preset',
    'Credit Collaterals',
    'Credit Payment Schedule',
    'Reports'
  ],

  'Data Entry/Upload': [
    'Macro-economic Data',
    'Credit Data',
    'Credit Collateral Detail',
    'Credit Restructure Detail',
    'Due Stage Preset Detail',
    'Loan Loss Class Preset Detail'
  ],

  'Procedure Execution': [
    'Macro-economic Effect Assessment',
    'Credit Due Staging',
    'ECL Assessment',
    'Credit Default Probability Assessment',
    'Credit PD Calibration',
    'Credit Impairments'
  ],

  'ECL Reports': [
    'Master Lists',
    'Impairment Reports',
    'Calculation Reports',
    'Regulatory Reports',
    'Policy Configuration Reports',
    'ECL Source Data',
    'Interesrt Income Recognition Reports'
  ],

  'Graphs': [
    'Impairment Volume Trend',
    'Impairment Proportions',
    'Impairment To Credit Ratio',
    'Due Stage Impairment',
    'PD Trend',
    'Actual PD Trend',
    'Graphs- All'
  ],

  'Supervision': [
    'Monitoring',
    'Outstanding Jobs'
  ],

  'Monitoring': [
    'User Logins',
    'User Activities',
    'Job Status',
    'Job Cancellation',
    'Outstanding Jobs',
    'Batch Job Detail'
  ],

  'Outstanding Jobs': [
    'Pending Job',
    'Authorization Requests',
    'Completion Notifications'
  ],

  'Periodic Functions': [
    'Job Scheduling',
    'BOD Operation',
    'EOD Operation',
    'Operation Suspension',
    'Operation Resumption',
    'Periodic Operations',
    'Database Backup',
    'Holiday',
    'Holiday Report'
  ],

  'Periodic Operations': [
    'BOD Processes',
    'EOD Processes'
  ],

  'BOD Processes': [
    'Begin BOD Operation',
    'Open Day Operation'
  ],

  'EOD Processes': [
    'Close Day Operation'
  ],

  'Systems': [
    'Configurations',
    'Access Management',
    'Geographical Names',
    'Calendars',
    'Others'
  ],

  'Configurations': [
    'Modules',
    'System Objects',
    'Menu',
    'Parameters',
    'Module Activation',
    'Module Deactivation',
    'System Reconfiguration',
    'Printer Configuration',
    'UI Reconfiguration',
    'UI Activation',
    'UI Deactivation',
    'Sequence Configuration',
    'Configuration Reports'
  ],

  'Access Management': [
    'Roles Management',
    'Role Resumption',
    'Role Suspension',
    'Edit Role Detail',
    'Assign User Capacities',
    'Responsibility',
    'User Management',
    'User Login Resumption',
    'User Modify',
    'User Login Suspension',
    'User Branch Setting',
    'Reset Password',
    'Access Profiles'
  ],

  'User Modify': [
    'Privilege Modify',
    'User Detail Modify'
  ],

  'Geographical Names': [
    'Countries',
    'Regions',
    'Zones',
    'Districts',
    'Municipalities/VDCs',
    'Reports'
  ],

  'Reports': [
    'Region List'
  ],

  'Calendars': [
    'Month Names',
    'Yearly Calendar',
    'Calendar Report'
  ],

  'Others': [
    'Branch',
    'Range Setup',
    'Ad hoc Query Builder',
    'Ad hoc Queries',
    'Date Loading',
    'Additional Record Design',
    'Setup Reports'
  ],

  'Additional Record Design': [
    'Forms',
    'Groups',
    'Fields',
    'Preset Values'
  ],

  'Utilities': [
    'Date Conversion',
    'Calendar',
    'Preferences',
    'Password Change'
  ]
},
  DCH: {
  'SMS Management': [
    'Subscription',
    'Subscription Modification',
    'Mobile Number Modification',
    'SMS Account Modification',
    'SMS Subscription Renew',
    'SMS Card Expiry Alert'
  ],

  'Card Management': [
    'Card Subscription',
    'Card Issue',
    'Card Subscription Modification',
    'Account Cards',
    'Card Delivery',
    'Card Block',
    'Card Release',
    'BIN Register',
    'Card Activate',
    'Card Destroy'
  ],

  'Web Management': [
    'Web Registration',
    'Web Registration Modification',
    'Web Account Modification',
    'Web Account Password Modification',
    'Web Account Password Authorization'
  ],

  'Inter Bank Fund Management': [
    'Inter Bank Registration',
    'Inter Bank Registration Modification',
    'Inter Bank Account Modification'
  ],

  'Supervision': [
    'Monotoring',
    'Outstanding Jobs'
  ],

  'Monotoring': [
    'User Logins',
    'User Activities',
    'Job Status',
    'Job Cancellation',
    'Outstanding Jobs'
  ],

  'Outstanding Jobs': [
    'Pending Job'
  ],

  'Systems': [
    'Configurations',
    'Access Management',
    'Geographical Names',
    'Calendars',
    'Others',
    'System Backup'
  ],

  'Configurations': [
    'Modules',
    'System Objects',
    'Menu',
    'Parameters',
    'Module Activation',
    'Module Deactivation',
    'System Reconfiguration',
    'Printer Configuration',
    'UI Reconfiguration',
    'UI Activation',
    'UI Deactivation',
    'Sequence Configuration',
    'Configuration Reports'
  ],

  'Access Management': [
    'Roles Management',
    'Role Resumption',
    'Role Suspension',
    'Edit Role Detail',
    'Assign User Capacities',
    'Responsibility',
    'User Management',
    'User Login Resumption',
    'User Modify',
    'User Detail Modify',
    'User Login Suspension',
    'User Branch Setting',
    'Reset Password',
    'Access Profiles'
  ],

  'User Modify': [
    'Priviledges Modify'
  ],

  'Geographical Names': [
    'Countries',
    'Regions',
    'Zones',
    'Districts',
    'Reports'
  ],

  'Reports': [
    'Region List'
  ],

  'Calendars': [
    'Month Names',
    'Yearly Calender',
    'Holiday',
    'Holiday Report',
    'Calendar Report'
  ],

  'Others': [
    'Branch',
    'Range Setup',
    'Adhoc Query Builder',
    'Adhoc Queries',
    'Date Loading',
    'Additional Record Design',
    'Setup Reports'
  ],

  'Additional Record Design': [
    'Forms',
    'Groups',
    'Fields',
    'Preset Values'
  ],

  'Utilities': [
    'Date Conversion',
    'Calendar',
    'Preferences',
    'Password Change'
  ]
}
};
