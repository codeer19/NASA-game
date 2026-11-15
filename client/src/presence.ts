export interface LocalPresence {
  id: string | null;
  x: number;
  y: number;
  active: boolean;
  interacting: string | null;
}

export const localPresence: LocalPresence = {
  id: null,
  x: 0,
  y: 0,
  active: false,
  interacting: null,
};

export function updateLocalPresence(
  id: string | null,
  x: number,
  y: number,
  active = true,
  interacting: string | null = null,
): void {
  localPresence.id = id;
  localPresence.x = x;
  localPresence.y = y;
  localPresence.active = active;
  localPresence.interacting = interacting;
}

export function setLocalInteraction(interacting: string | null): void {
  localPresence.interacting = interacting;
}

export function clearLocalPresence(): void {
  localPresence.id = null;
  localPresence.x = 0;
  localPresence.y = 0;
  localPresence.active = false;
  localPresence.interacting = null;
}

