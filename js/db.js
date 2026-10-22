/**
 * Data Access Layer (DAL)
 * Capa de acceso a datos sobre SQLite en el navegador usando sql.js (WASM).
 * Persiste los cambios en el servidor (seguros.db) si existe el endpoint
 * /api/save, y como respaldo local en localStorage.
 */
const DB = (() => {
  const DB_FILE = 'seguros.db';
  const LS_KEY = 'seguros_db_backup';

  const TABLES = {
    cliente: { pk: 'id_cliente', fields: ['nombre', 'apellido', 'dni', 'email', 'telefono'] },
    poliza: { pk: 'id_poliza', fields: ['numero_poliza', 'fecha_inicio', 'fecha_fin', 'estado', 'id_cliente'] },
    siniestro: { pk: 'id_siniestro', fields: ['fecha', 'tipo', 'descripcion', 'estado', 'id_poliza'] },
    cobertura: { pk: 'id_cobertura', fields: ['nombre', 'descripcion'] },
    pago: { pk: 'id_pago', fields: ['fecha', 'importe', 'estado', 'id_poliza'] },
    detalle_poliza_cobertura: { pk: 'id_detalle', fields: ['id_poliza', 'id_cobertura'] }
  };

  let SQL = null;
  let db = null;
  let source = 'memory';

  /* ---------- utilidades ---------- */

  function bytesToBase64(bytes) {
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }

  function base64ToBytes(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function escapeId(id) {
    return '"' + String(id).replace(/"/g, '""') + '"';
  }

  function meta(tableName) {
    const m = TABLES[tableName];
    if (!m) throw new Error(`Tabla desconocida: ${tableName}`);
    return m;
  }

  /* ---------- persistencia ---------- */

  async function persist() {
    const bytes = db.export();
    try {
      localStorage.setItem(LS_KEY, bytesToBase64(bytes));
    } catch (e) {
      console.warn('No se pudo guardar respaldo local:', e);
    }
    // Intenta guardar en el servidor (seguros.db real)
    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: bytes
      });
      if (res.ok) source = 'servidor';
    } catch (e) {
      // Servidor estático simple: la copia de seguridad local es el respaldo
      source = 'local';
    }
  }

  function restoreLocal() {
    const b64 = localStorage.getItem(LS_KEY);
    return b64 ? base64ToBytes(b64) : null;
  }

  function resetLocal() {
    localStorage.removeItem(LS_KEY);
  }

  /* ---------- inicialización ---------- */

  async function init() {
    SQL = await initSqlJs({
      locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${f}`
    });

    const saved = restoreLocal();
    if (saved) {
      db = new SQL.Database(saved);
      source = 'local';
      return { source };
    }

    const res = await fetch(DB_FILE);
    if (!res.ok) throw new Error(`No se pudo cargar ${DB_FILE} (${res.status})`);
    const buf = await res.arrayBuffer();
    db = new SQL.Database(new Uint8Array(buf));
    source = 'archivo';
    return { source };
  }

  /* ---------- funciones CRUD base ---------- */

  /**
   * SELECT genérico.
   * @param {string} tableName
   * @param {object} options { sql, columns, where, params, orderBy, join }
   * @returns {Array<object>}
   */
  function read(tableName, options = {}) {
    let sql;
    if (options.sql) {
      sql = options.sql;
    } else {
      const cols = (options.columns || '*');
      sql = `SELECT ${cols} FROM ${escapeId(tableName)}`;
      if (options.join) sql += ' ' + options.join;
      if (options.where) sql += ` WHERE ${options.where}`;
      if (options.orderBy) sql += ` ORDER BY ${options.orderBy}`;
    }
    const stmt = db.prepare(sql, options.params || []);
    const rows = [];
    while (stmt.step()) {
      const obj = stmt.getAsObject();
      rows.push(obj);
    }
    stmt.free();
    return rows;
  }

  function scalar(sql, params = []) {
    const stmt = db.prepare(sql, params);
    let value = null;
    if (stmt.step()) {
      const row = stmt.getAsObject();
      value = row[Object.keys(row)[0]];
    }
    stmt.free();
    return value;
  }

  /**
   * INSERT. Devuelve el id generado.
   */
  function create(tableName, data) {
    const { pk, fields } = meta(tableName);
    const cols = fields.filter(f => Object.prototype.hasOwnProperty.call(data, f));
    if (!cols.length) throw new Error(`Sin campos válidos para insertar en ${tableName}`);
    const sql = `INSERT INTO ${escapeId(tableName)} (${cols.map(escapeId).join(', ')})
                 VALUES (${cols.map(() => '?').join(', ')})`;
    db.run(sql, cols.map(c => data[c] === '' ? null : data[c]));
    const id = scalar(`SELECT last_insert_rowid() AS id`);
    persist();
    return id;
  }

  /**
   * UPDATE por PK.
   */
  function update(tableName, id, data) {
    const { pk, fields } = meta(tableName);
    const cols = fields.filter(f => Object.prototype.hasOwnProperty.call(data, f));
    if (!cols.length) throw new Error(`Sin campos válidos para actualizar en ${tableName}`);
    const sql = `UPDATE ${escapeId(tableName)}
                 SET ${cols.map(c => `${escapeId(c)} = ?`).join(', ')}
                 WHERE ${escapeId(pk)} = ?`;
    db.run(sql, [...cols.map(c => data[c] === '' ? null : data[c]), id]);
    const changed = db.getRowsModified();
    persist();
    return changed;
  }

  /**
   * DELETE físico por PK (la BD no define borrado lógico).
   */
  function remove(tableName, id) {
    const { pk } = meta(tableName);
    db.run(`DELETE FROM ${escapeId(tableName)} WHERE ${escapeId(pk)} = ?`, [id]);
    const changed = db.getRowsModified();
    persist();
    return changed;
  }

  return {
    TABLES,
    init,
    read,
    scalar,
    create,
    update,
    delete: remove,
    persist,
    resetLocal,
    get source() { return source; }
  };
})();
