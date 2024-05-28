import { diff } from "deep-diff";
import debug from "debug";

const console = debug("sequelize-revision:console");

export function capitalizeFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function calcDelta(
  current: { [key: string]: any },
  next: { [key: string]: any },
  exclude: string[],
  strict: boolean,
): { [key: string]: any }[] | null {
  const di = diff(current, next);

  let diffs = [];
  if (di) {
    diffs = di
      .map((i) => JSON.parse(JSON.stringify(i).replace('"__data",', "")))
      .filter((i) => {
        if (!strict && i.kind === "E") {
          if (i.lhs != i.rhs) return i;
        } else return i;
        return false;
      })
      .filter((i) => exclude.every((x) => i.path.indexOf(x) === -1));
  }

  if (diffs.length > 0) {
    return diffs;
  }
  return null;
}

export function diffToString(val: any): string {
  if (typeof val === "undefined" || val === null) {
    return "";
  }
  if (val === true) {
    return "1";
  }
  if (val === false) {
    return "0";
  }
  if (typeof val === "string") {
    return val;
  }
  if (!Number.isNaN(Number(val))) {
    return String(val);
  }
  if (typeof val === "object") {
    return JSON.stringify(val);
  }
  if (Array.isArray(val)) {
    return JSON.stringify(val);
  }
  return "";
}

export function debugConsole(formatter: any, ...args: any[]) {
  console(formatter, ...args);
}
