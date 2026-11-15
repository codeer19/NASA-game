export type Direction = "down" | "left" | "right" | "up";

interface TouchState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  actionHeld: boolean;
  actionPulse: boolean;
}

export const touchState: TouchState = {
  up: false,
  down: false,
  left: false,
  right: false,
  actionHeld: false,
  actionPulse: false,
};

export function setDirection(direction: Direction, pressed: boolean): void {
  touchState[direction] = pressed;
}

export function setActionHeld(pressed: boolean): void {
  touchState.actionHeld = pressed;
  if (pressed) touchState.actionPulse = true;
}

export function consumeActionPulse(): boolean {
  if (!touchState.actionPulse) return false;
  touchState.actionPulse = false;
  return true;
}

export function directionFromTouch(): Direction | null {
  if (touchState.up) return "up";
  if (touchState.down) return "down";
  if (touchState.left) return "left";
  if (touchState.right) return "right";
  return null;
}

export function clearTouchState(): void {
  touchState.up = false;
  touchState.down = false;
  touchState.left = false;
  touchState.right = false;
  touchState.actionHeld = false;
  touchState.actionPulse = false;
}
