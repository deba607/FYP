import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseFirestore, getFirebaseRealtimeDatabase } from '../config/firebaseAdmin';
import type { CrowdInsight, CrowdLevel } from '../crowd';
import { getCustomMuseums } from './museumService';

function dateKeyInIndia(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function crowdKey(museumId: string) {
  return Buffer.from(museumId).toString('base64url');
}

function levelFor(current: number, capacity: number | null): CrowdLevel {
  if (!capacity || capacity <= 0) return 'Unknown';
  const ratio = current / capacity;
  if (ratio >= 0.9) return 'Critical';
  if (ratio >= 0.75) return 'High';
  if (ratio >= 0.4) return 'Moderate';
  return 'Low';
}

function toInsight(museumId: string, museumName: string, value?: Record<string, unknown>): CrowdInsight {
  const currentVisitors = Math.max(0, Number(value?.currentVisitors || 0));
  const rawCapacity = Number(value?.capacity);
  const capacity = Number.isFinite(rawCapacity) && rawCapacity > 0 ? rawCapacity : null;
  return {
    museumId,
    museumName: String(value?.museumName || museumName || museumId),
    currentVisitors,
    capacity,
    occupancyPercent: capacity ? Math.min(100, Math.round((currentVisitors / capacity) * 100)) : null,
    crowdLevel: levelFor(currentVisitors, capacity),
    entriesToday: Math.max(0, Number(value?.entriesToday || 0)),
    exitsToday: Math.max(0, Number(value?.exitsToday || 0)),
    peakVisitorsToday: Math.max(0, Number(value?.peakVisitorsToday || 0)),
    dateKey: String(value?.dateKey || dateKeyInIndia()),
    updatedAt: value?.updatedAt ? String(value.updatedAt) : null,
    status: value?.updatedAt ? 'live' : 'waiting'
  };
}

async function resolveMuseum(museumId: string) {
  try {
    const { museums } = await getCustomMuseums();
    const found = museums.find((m) => m.museum_id === museumId || m.id === museumId);
    if (found) {
      return {
        museumName: found.name,
        capacity: found.capacity ?? null
      };
    }
  } catch (err) {
    console.error('Failed to resolve museum from cache, falling back to Firestore:', err);
  }

  const firestore = getFirebaseFirestore();
  let document = await firestore.collection('museums').doc(museumId).get();
  if (!document.exists) {
    const query = await firestore.collection('museums').where('museum_id', '==', museumId).limit(1).get();
    if (!query.empty) document = query.docs[0];
  }
  if (!document.exists) {
    throw new Error('Registered museum not found');
  }
  const data = document.data() || {};
  const rawCapacity = Number(data.capacity);
  return {
    museumName: String(data.name || museumId),
    capacity: Number.isFinite(rawCapacity) && rawCapacity > 0 ? rawCapacity : null
  };
}

export async function updateCrowdFromGateScan(
  museumId: string,
  gateAction: 'entry' | 'exit',
  deviceId: string
) {
  if (!museumId) return null;
  const database = getFirebaseRealtimeDatabase();
  const now = new Date();
  const today = dateKeyInIndia(now);
  const museum = await resolveMuseum(museumId);
  const reference = database.ref(`crowdInsights/${crowdKey(museumId)}`);
  const transaction = await reference.transaction((current) => {
    const previous = current && current.dateKey === today ? current : {
      currentVisitors: 0,
      entriesToday: 0,
      exitsToday: 0,
      peakVisitorsToday: 0
    };
    const nextVisitors = gateAction === 'entry'
      ? Number(previous.currentVisitors || 0) + 1
      : Math.max(0, Number(previous.currentVisitors || 0) - 1);
    const capacity = Number(previous.capacity || museum.capacity || 0) || null;
    return {
      ...previous,
      museumId,
      museumName: museum.museumName,
      capacity,
      currentVisitors: nextVisitors,
      entriesToday: Number(previous.entriesToday || 0) + (gateAction === 'entry' ? 1 : 0),
      exitsToday: Number(previous.exitsToday || 0) + (gateAction === 'exit' ? 1 : 0),
      peakVisitorsToday: Math.max(Number(previous.peakVisitorsToday || 0), nextVisitors),
      dateKey: today,
      updatedAt: now.toISOString(),
      lastDeviceId: deviceId
    };
  });
  const insight = toInsight(museumId, museum.museumName, transaction.snapshot.val() || {});

  const hourKey = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }).format(now);
  await database.ref(`crowdHistory/${crowdKey(museumId)}/${today}/${hourKey}`).transaction((current) => ({
    entries: Number(current?.entries || 0) + (gateAction === 'entry' ? 1 : 0),
    exits: Number(current?.exits || 0) + (gateAction === 'exit' ? 1 : 0),
    peakVisitors: Math.max(Number(current?.peakVisitors || 0), insight.currentVisitors),
    updatedAt: now.toISOString()
  }));

  await getFirebaseFirestore().collection('museumVisits').doc(crowdKey(museumId)).set({
    museumId,
    museumName: museum.museumName,
    currentVisitors: insight.currentVisitors,
    capacity: insight.capacity,
    crowdLevel: insight.crowdLevel,
    occupancyPercent: insight.occupancyPercent,
    entriesToday: insight.entriesToday,
    exitsToday: insight.exitsToday,
    peakVisitorsToday: insight.peakVisitorsToday,
    dateKey: today,
    totalVisits: gateAction === 'entry' ? FieldValue.increment(1) : FieldValue.increment(0),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return insight;
}

export async function getCrowdInsights(museumId?: string) {
  const [{ museums }, snapshot] = await Promise.all([
    getCustomMuseums(),
    getFirebaseRealtimeDatabase().ref('crowdInsights').once('value')
  ]);
  const raw = snapshot.val() || {};
  const wanted = museumId?.trim().toLowerCase();
  return museums
    .filter((museum) => !wanted || [museum.id, museum.museum_id].some((id) => id.toLowerCase() === wanted))
    .map((museum) => toInsight(
      museum.museum_id,
      museum.name,
      raw[crowdKey(museum.museum_id)] || raw[crowdKey(museum.id)]
    ));
}

export async function getDetailedCrowdInsight(museumId: string) {
  const db = getFirebaseRealtimeDatabase();
  const today = dateKeyInIndia();
  const mKey = crowdKey(museumId);

  const [
    insightSnap,
    historySnap,
    controllersSnap,
    scansSnap,
    museumInfo
  ] = await Promise.all([
    db.ref(`crowdInsights/${mKey}`).once('value'),
    db.ref(`crowdHistory/${mKey}/${today}`).once('value'),
    db.ref('controllers').once('value'),
    db.ref('scan_logs').orderByChild('museumId').equalTo(museumId).limitToLast(200).once('value'),
    resolveMuseum(museumId)
  ]);

  const rawInsight = insightSnap.val() || {};
  const insight = toInsight(museumId, museumInfo.museumName, rawInsight);

  // Format hourly history (9 AM to 6 PM)
  const historyData = historySnap.val() || {};
  const hourlyHistory = Array.from({ length: 10 }, (_, i) => {
    const hour = 9 + i;
    const hourStr = String(hour).padStart(2, '0');
    const record = historyData[hourStr] || {};
    return {
      hour: `${hourStr}:00`,
      entries: Number(record.entries || 0),
      exits: Number(record.exits || 0),
      peakVisitors: Number(record.peakVisitors || 0)
    };
  });

  // Analyze gate crowd flow
  const controllers: any[] = [];
  controllersSnap.forEach((child) => {
    const val = child.val();
    if (String(val.museumId) === museumId) {
      controllers.push({
        id: child.key,
        name: String(val.name || 'Unknown Gate'),
        status: String(val.status || 'active')
      });
    }
  });

  const thirtyMinsAgo = Date.now() - 30 * 60 * 1000;
  const recentScanCounts: Record<string, number> = {};
  
  scansSnap.forEach((child) => {
    const val = child.val();
    const scannedAt = new Date(val.scannedAt).getTime();
    if (scannedAt >= thirtyMinsAgo && val.deviceId) {
      recentScanCounts[val.deviceId] = (recentScanCounts[val.deviceId] || 0) + 1;
    }
  });

  const gateStatus = controllers.map((gate) => {
    const scanCount = recentScanCounts[gate.id] || 0;
    let level: 'Low' | 'Moderate' | 'High' = 'Low';
    if (scanCount >= 10) level = 'High';
    else if (scanCount >= 3) level = 'Moderate';

    let recommendation = 'Fast entry — no queues';
    if (level === 'High') recommendation = 'Crowded — use alternative gate';
    else if (level === 'Moderate') recommendation = 'Short wait time';

    return {
      gateId: gate.id,
      gateName: gate.name,
      status: gate.status,
      scanCount,
      crowdLevel: level,
      recommendation
    };
  });

  // Calculate best time to visit based on hourly history peak / entries or defaults
  let bestHour = '09:00';
  let minPeak = Infinity;
  hourlyHistory.forEach((h) => {
    if (h.peakVisitors < minPeak) {
      minPeak = h.peakVisitors;
      bestHour = h.hour.split(':')[0];
    }
  });

  let bestTimeToVisit = '09:00 AM - 11:00 AM';
  const hrNum = Number(bestHour);
  if (hrNum >= 9 && hrNum <= 17) {
    const endHr = hrNum + 2;
    const to12 = (h: number) => {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayHr = h % 12 || 12;
      return `${displayHr}:00 ${ampm}`;
    };
    bestTimeToVisit = `${to12(hrNum)} - ${to12(endHr)}`;
  }

  return {
    insight,
    hourlyHistory,
    gateStatus,
    bestTimeToVisit
  };
}

export async function configureMuseumCapacity(museumId: string, capacity: number) {
  if (!museumId || !Number.isInteger(capacity) || capacity < 1 || capacity > 1000000) {
    throw new Error('Capacity must be a whole number between 1 and 1,000,000');
  }
  const museum = await resolveMuseum(museumId);
  const database = getFirebaseRealtimeDatabase();
  const reference = database.ref(`crowdInsights/${crowdKey(museumId)}`);
  await reference.update({ museumId, museumName: museum.museumName, capacity, updatedAt: new Date().toISOString() });
  const firestore = getFirebaseFirestore();
  const query = await firestore.collection('museums').where('museum_id', '==', museumId).limit(1).get();
  if (!query.empty) await query.docs[0].ref.set({ capacity, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await firestore.collection('museumVisits').doc(crowdKey(museumId)).set({ museumId, museumName: museum.museumName, capacity, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}
