export interface ColumnValue {
  id: string;
  text: string;
  value?: string | null;
}

export interface Machine {
  id: string;
  name: string;
  column_values: ColumnValue[];
}

export interface PlanningItem {
  id: string;
  name: string;
  column_values: ColumnValue[];
}

export interface PlanningEventDetail {
  id: string;
  machine: string;
  site: string;
  dates?: string;
  fromDate: string;
  toDate: string;
  reservedBy: string;
  type: string;
  status: string;
  isRecurring?: boolean;
  isMachineInRepair?: boolean;
  isControleRealise?: boolean;
  controleData?: any;
  matchedMachineId?: string;
}
