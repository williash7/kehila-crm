export interface Donation {
  id?: string;
  name: string;
  date: string;
  amount: number;
  purpose?: string;
  method?: string;
  notes?: string;
  source?: string;
  meetDate?: string;
  location?: string;
  meetPurpose?: string;
}

export interface Meeting {
  date: string;
  meetType: string;
  purpose?: string;
  notes?: string;
}

export interface Donor {
  name: string;
  total: number;
  donations: Donation[];
  meetings?: Meeting[];
  lastDate: string;
}

export interface ReportSummary {
  total: number;
  thisMonthTotal: number;
  donorCount: number;
  hkActive: number;
  failureCount: number;
  byMethod?: Record<string, number>;
}
