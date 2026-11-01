/** Set when a new run starts streaming, so the door only plays on the way into a new run and not on a loaded save */
let pending = false;

export const markStageEntry = () => {
  pending = true;
};

export const hasPendingStageEntry = () => pending;

export const clearStageEntry = () => {
  pending = false;
};
