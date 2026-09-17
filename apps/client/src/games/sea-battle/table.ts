/**
 * Which way the ship waiting to be placed points. It is not part of the rules (the move says
 * the direction), so the board and the Turn button share it here, per session.
 */
export interface SeaTable {
  horizontal: boolean;
  readonly listeners: Set<() => void>;
}

const tables = new WeakMap<object, SeaTable>();

export function tableFor(session: object): SeaTable {
  let table = tables.get(session);
  if (!table) {
    table = { horizontal: true, listeners: new Set() };
    tables.set(session, table);
  }
  return table;
}

export function turnShip(table: SeaTable): void {
  table.horizontal = !table.horizontal;
  for (const listener of table.listeners) listener();
}
