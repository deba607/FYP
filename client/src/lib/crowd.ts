export type CrowdLevel = 'Low' | 'Moderate' | 'High' | 'Critical' | 'Unknown';

export type CrowdInsight = {
  museumId: string;
  museumName: string;
  currentVisitors: number;
  capacity: number | null;
  occupancyPercent: number | null;
  crowdLevel: CrowdLevel;
  entriesToday: number;
  exitsToday: number;
  peakVisitorsToday: number;
  dateKey: string;
  updatedAt: string | null;
  status: 'live' | 'waiting';
};
