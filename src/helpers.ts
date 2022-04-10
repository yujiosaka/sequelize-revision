import { diff } from "deep-diff";
import { forEach } from "lodash";

export default class Helper {
  static capitalizeFirstLetter(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  static toUnderscored(obj: { [key: string]: string }): {
    [key: string]: string;
  } {
    forEach(obj, (k, v) => {
      obj[k] = v
        .replace(/(?:^|\.?)([A-Z])/g, (x, y) => `_${y.toLowerCase()}`)
        .replace(/^_/, "");
    });
    return obj;
  }

  static calcDelta(
    current: { [key: string]: any },
    next: { [key: string]: string },
    exclude: string[],
    strict: boolean
  ) {
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

  static diffToString(val: any): string {
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
      return `${String(val)}`;
    }
    if ((typeof val === "undefined" ? "undefined" : typeof val) === "object") {
      return `${JSON.stringify(val)}`;
    }
    if (Array.isArray(val)) {
      return `${JSON.stringify(val)}`;
    }
    return "";
  }
}
