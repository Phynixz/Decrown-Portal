import nigeriaLocationData from "nigeria-state-lga-data";

export const NIGERIAN_STATES = nigeriaLocationData.getStates();

export function getLocalGovernments(state) {
  return state ? nigeriaLocationData.getLgas(state) : [];
}