/**
 * Backend entry: Express + MongoDB API for all panel data.
 */
import {
  getActivePocketBaseUrl,
  getDefaultPocketBaseUrl,
  saveSwitchedPbConfig,
  clearSwitchedPbConfig,
  resetPbClient,
  type PocketBaseAppConfig as BackendAppConfig,
} from "@/lib/pocketbase";
import { auth, publicAuth } from "@/lib/authPb";
import { RTDB_DB_MARKER } from "@/lib/rtdbPb";

export const db = RTDB_DB_MARKER;
export const defaultDb = RTDB_DB_MARKER;

export { auth, publicAuth };
export const defaultAuth = auth;

export const publicDb = RTDB_DB_MARKER;

export const activeConfig = {
  get apiKey() {
    return "";
  },
  get authDomain() {
    return "";
  },
  get databaseURL() {
    return getActivePocketBaseUrl();
  },
  get projectId() {
    return "pocketbase";
  },
  get storageBucket() {
    return "";
  },
  get messagingSenderId() {
    return "";
  },
  get appId() {
    return "";
  },
};

export function isSwitched(): boolean {
  try {
    return !!sessionStorage.getItem("dxp_switched_pb_config");
  } catch {
    return false;
  }
}

export {
  getActivePocketBaseUrl,
  getDefaultPocketBaseUrl,
  saveSwitchedPbConfig,
  clearSwitchedPbConfig,
  resetPbClient,
  type BackendAppConfig as PocketBaseAppConfig,
};

export function getActiveConfigForPublicView(): BackendAppConfig {
  return { baseUrl: getActivePocketBaseUrl() };
}
