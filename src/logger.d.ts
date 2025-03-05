export function log(message: string): void;
export function debug(message: string): void;
export function error(message: string): void;

declare const _default: {
  log: typeof log;
  debug: typeof debug;
  error: typeof error;
};

export default _default;