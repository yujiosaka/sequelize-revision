// See https://stackoverflow.com/a/72228634

type UpperAlphabetic =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L"
  | "M"
  | "N"
  | "O"
  | "P"
  | "Q"
  | "R"
  | "S"
  | "T"
  | "U"
  | "V"
  | "W"
  | "X"
  | "Y"
  | "Z";

type AlphanumericDigits =
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "0";

/**
 * Return underscore if it is allowed between provided characters,
 * trail and lead underscore are allowed, empty string is considered
 * as the beginning of a string.
 */
type SnakeUnderscore<
  First extends PropertyKey,
  Second extends PropertyKey
> = First extends AlphanumericDigits
  ? Second extends UpperAlphabetic
    ? "_"
    : ""
  : First extends UpperAlphabetic | "" | "_"
  ? ""
  : Second extends UpperAlphabetic | AlphanumericDigits
  ? "_"
  : "";

/**
 * Convert string literal type to snake_case
 */
export type CamelToSnakeCase<
  S extends PropertyKey,
  Previous extends PropertyKey = ""
> = S extends number
  ? S
  : S extends `__${infer K}`
  ? `__${CamelToSnakeCase<K>}`
  : S extends `${infer J}__${infer L}`
  ? `${CamelToSnakeCase<J>}__${CamelToSnakeCase<L>}`
  : S extends `${infer First}${infer Second}${infer Rest}`
  ? `${SnakeUnderscore<Previous, First>}${Lowercase<First>}${SnakeUnderscore<
      First,
      Second
    >}${Lowercase<Second>}${CamelToSnakeCase<Rest, First>}`
  : S extends `${infer First}`
  ? `${SnakeUnderscore<Previous, First>}${Lowercase<First>}`
  : "";
