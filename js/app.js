/**
 * Lógica de interfaz: navegación, vistas, formularios, gráficos.
 */
(() => {
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  const charts = {};
  let deleteAction = null;

  /* ================== utilidades ================== */

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function toast(msg, type = 'success') {
    const el = $('#toast');
    el.textContent = msg;
    el.className = `toast ${type}`;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, 2800);
  }

  function badge(estado) {
    const key = String(estado || '').toLowerCase();
    let cls = 'badge-default';
    if (key === 'activa' || key === 'abierto' || key === 'pagado') cls = `badge-${key}`;
    else if (key === 'vencida' || key === 'cerrado') cls = `badge-${key}`;
    else if (key === 'cancelada' || key === 'pendiente') cls = `badge-${key}`;
    return `<span class="badge ${cls}">${esc(estado)}</span>`;
  }

  function openModal(id) { $('#' + id).hidden = false; }
  function closeModal(id) { $('#' + id).hidden = true; }

  function confirmDelete(message, action) {
    $('#confirm-message').textContent = message;
    deleteAction = action;
    openModal('modal-confirm');
  }

  function formatFecha(fecha) {
    if (!fecha) return '';
    const [y, m, d] = String(fecha).split('-');
    return `${d}/${m}/${y}`;
  }

  /* ================== navegación ================== */

  function initNav() {
    $$('.menu-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.menu-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        $$('.view').forEach(v => v.classList.remove('active'));
        $('#view-' + btn.dataset.view).classList.add('active');
        if (btn.dataset.view === 'dashboard') renderDashboard();
        if (btn.dataset.view === 'clientes') renderClientes();
        if (btn.dataset.view === 'polizas') renderPolizas();
        if (btn.dataset.view === 'siniestros') renderSiniestros();
      });
    });

    $$('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });

    $$('.modal-overlay').forEach(ov => {
      ov.addEventListener('click', e => { if (e.target === ov) ov.hidden = true; });
    });

    $('#btn-confirm-delete').addEventListener('click', () => {
      if (deleteAction) deleteAction();
      deleteAction = null;
      closeModal('modal-confirm');
    });
  }

  /* ================== DASHBOARD (Fase 3) ================== */

  function renderDashboard() {
    // Indicadores clave (consultas del plan)
    $('#kpi-clientes').textContent = DB.scalar('SELECT COUNT(id_cliente) FROM cliente');
    $('#kpi-polizas-activas').textContent =
      DB.scalar("SELECT COUNT(id_poliza) FROM poliza WHERE estado = 'Activa'");
    $('#kpi-siniestros-abiertos').textContent =
      DB.scalar("SELECT COUNT(id_siniestro) FROM siniestro WHERE estado = 'Abierto'");
    $('#kpi-siniestros-cerrados').textContent =
      DB.scalar("SELECT COUNT(id_siniestro) FROM siniestro WHERE estado = 'Cerrado'");

    drawChart('chart-polizas-estado', 'doughnut',
      DB.read('poliza', { sql: 'SELECT estado, COUNT(*) AS total FROM poliza GROUP BY estado ORDER BY total DESC' })
        .map(r => r.estado),
      DB.read('poliza', { sql: 'SELECT estado, COUNT(*) AS total FROM poliza GROUP BY estado ORDER BY total DESC' })
        .map(r => r.total),
      ['#16a34a', '#ea580c', '#dc2626', '#2563eb', '#7c3aed']);

    const tipoRows = DB.read('siniestro', {
      sql: 'SELECT tipo, COUNT(*) AS total FROM siniestro GROUP BY tipo ORDER BY total DESC'
    });
    drawChart('chart-siniestros-tipo', 'bar',
      tipoRows.map(r => r.tipo),
      tipoRows.map(r => r.total),
      ['#2563eb']);

    const mesRows = DB.read('siniestro', {
      sql: "SELECT substr(fecha, 1, 7) AS mes, COUNT(*) AS total FROM siniestro GROUP BY mes ORDER BY mes"
    });
    drawChart('chart-siniestros-mes', 'line',
      mesRows.map(r => {
        const [y, m] = r.mes.split('-');
        return `${m}/${y}`;
      }),
      mesRows.map(r => r.total),
      ['#7c3aed']);
  }

  function drawChart(id, type, labels, data, colors) {
    const canvas = document.getElementById(id);
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(canvas, {
      type,
      data: {
        labels,
        datasets: [{
          label: 'Cantidad',
          data,
          backgroundColor: type === 'line' ? colors[0] + '33' : colors,
          borderColor: type === 'doughnut' ? '#fff' : colors[0],
          borderWidth: type === 'doughnut' ? 2 : 2,
          fill: type === 'line',
          tension: 0.35,
          borderRadius: type === 'bar' ? 6 : 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: type === 'doughnut', position: 'bottom' }
        },
        scales: type === 'doughnut' ? {} : {
          y: { beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });
  }

  /* ================== CLIENTES (Fase 2 - CRUD) ================== */

  function clientesFiltrados() {
    const q = $('#cliente-search').value.trim().toLowerCase();
    const rows = DB.read('cliente', { orderBy: 'id_cliente' });
    if (!q) return rows;
    return rows.filter(r =>
      [r.id_cliente, r.nombre, r.apellido, r.dni, r.email, r.telefono]
        .some(v => String(v ?? '').toLowerCase().includes(q))
    );
  }

  function renderClientes() {
    const tbody = $('#tabla-clientes tbody');
    const rows = clientesFiltrados();
    if (!rows.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No se encontraron clientes.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.id_cliente}</td>
        <td>${esc(r.nombre)}</td>
        <td>${esc(r.apellido)}</td>
        <td>${esc(r.dni)}</td>
        <td>${esc(r.email || '-')}</td>
        <td>${esc(r.telefono || '-')}</td>
        <td class="col-actions">
          <button class="btn-icon edit" title="Editar" data-edit="${r.id_cliente}">✎</button>
          <button class="btn-icon del" title="Eliminar" data-del="${r.id_cliente}">🗑</button>
        </td>
      </tr>`).join('');

    tbody.querySelectorAll('[data-edit]').forEach(btn =>
      btn.addEventListener('click', () => openClienteForm(+btn.dataset.edit)));
    tbody.querySelectorAll('[data-del]').forEach(btn =>
      btn.addEventListener('click', () => {
        const id = +btn.dataset.del;
        const c = DB.read('cliente', { where: 'id_cliente = ?', params: [id] })[0];
        confirmDelete(`¿Eliminar al cliente "${c.nombre} ${c.apellido}" (ID ${id})?`, () => {
          const polizas = DB.scalar('SELECT COUNT(*) FROM poliza WHERE id_cliente = ?', [id]);
          if (polizas > 0) {
            toast(`No se puede eliminar: el cliente tiene ${polizas} póliza(s) asociadas.`, 'error');
            return;
          }
          DB.delete('cliente', id);
          toast('Cliente eliminado.');
          renderClientes();
          renderDashboard();
        });
      }));
  }

  function openClienteForm(id = null) {
    $('#form-cliente').reset();
    $('#cliente-id').value = '';
    $('#modal-cliente-title').textContent = id ? `Editar Cliente #${id}` : 'Nuevo Cliente';
    if (id) {
      const c = DB.read('cliente', { where: 'id_cliente = ?', params: [id] })[0];
      if (!c) return;
      $('#cliente-id').value = c.id_cliente;
      $('#cliente-nombre').value = c.nombre;
      $('#cliente-apellido').value = c.apellido;
      $('#cliente-dni').value = c.dni;
      $('#cliente-email').value = c.email || '';
      $('#cliente-telefono').value = c.telefono || '';
    }
    openModal('modal-cliente');
  }

  function initClientes() {
    $('#btn-nuevo-cliente').addEventListener('click', () => openClienteForm());
    $('#cliente-search').addEventListener('input', renderClientes);

    $('#form-cliente').addEventListener('submit', e => {
      e.preventDefault();
      const data = {
        nombre: $('#cliente-nombre').value.trim(),
        apellido: $('#cliente-apellido').value.trim(),
        dni: $('#cliente-dni').value.trim(),
        email: $('#cliente-email').value.trim(),
        telefono: $('#cliente-telefono').value.trim()
      };
      if (!data.nombre || !data.apellido || !data.dni) {
        toast('Nombre, apellido y DNI son obligatorios.', 'error');
        return;
      }
      const id = $('#cliente-id').value;
      const dup = DB.read('cliente', {
        sql: 'SELECT id_cliente FROM cliente WHERE dni = ?' + (id ? ' AND id_cliente != ?' : ''),
        params: id ? [data.dni, +id] : [data.dni]
      });
      if (dup.length) {
        toast(`Ya existe un cliente con DNI ${data.dni}.`, 'error');
        return;
      }
      if (id) {
        DB.update('cliente', +id, data);
        toast('Cliente actualizado.');
      } else {
        DB.create('cliente', data);
        toast('Cliente creado.');
      }
      closeModal('modal-cliente');
      renderClientes();
      renderDashboard();
    });
  }

  /* ================== PÓLIZAS (Fase 2) ================== */

  function polizasFiltradas() {
    const clienteId = $('#filtro-cliente-poliza').value;
    const estado = $('#filtro-estado-poliza').value;
    const where = [];
    const params = [];
    if (clienteId) { where.push('p.id_cliente = ?'); params.push(+clienteId); }
    if (estado) { where.push('p.estado = ?'); params.push(estado); }
    return DB.read('poliza', {
      sql: `SELECT p.*, c.nombre, c.apellido, c.dni
            FROM poliza p JOIN cliente c ON c.id_cliente = p.id_cliente
            ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
            ORDER BY p.id_poliza`,
      params
    });
  }

  function loadPolizaFiltros() {
    const selCliente = $('#filtro-cliente-poliza');
    const selClienteModal = $('#poliza-cliente');
    const clientes = DB.read('cliente', { orderBy: 'apellido' });

    selCliente.innerHTML = '<option value="">Todos los clientes</option>' +
      clientes.map(c => `<option value="${c.id_cliente}">${esc(c.apellido)}, ${esc(c.nombre)} (${esc(c.dni)})</option>`).join('');

    selClienteModal.innerHTML = '<option value="">Seleccione un cliente...</option>' +
      clientes.map(c => `<option value="${c.id_cliente}">${esc(c.apellido)}, ${esc(c.nombre)} (${esc(c.dni)})</option>`).join('');

    const estados = DB.read('poliza', {
      sql: 'SELECT DISTINCT estado FROM poliza ORDER BY estado'
    }).map(r => r.estado);
    const actual = $('#filtro-estado-poliza').value;
    $('#filtro-estado-poliza').innerHTML = '<option value="">Todos los estados</option>' +
      estados.map(e => `<option value="${esc(e)}">${esc(e)}</option>`).join('');
    $('#filtro-estado-poliza').value = actual;
  }

  function renderPolizas() {
    const tbody = $('#tabla-polizas tbody');
    const rows = polizasFiltradas();
    if (!rows.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="8">No hay pólizas para el filtro seleccionado.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.id_poliza}</td>
        <td><strong>${esc(r.numero_poliza)}</strong></td>
        <td>${esc(r.nombre)} ${esc(r.apellido)}</td>
        <td>${esc(r.dni)}</td>
        <td>${formatFecha(r.fecha_inicio)}</td>
        <td>${formatFecha(r.fecha_fin)}</td>
        <td>${badge(r.estado)}</td>
        <td class="col-actions">
          <button class="btn-icon edit" title="Editar" data-edit="${r.id_poliza}">✎</button>
          <button class="btn-icon del" title="Eliminar" data-del="${r.id_poliza}">🗑</button>
        </td>
      </tr>`).join('');

    tbody.querySelectorAll('[data-edit]').forEach(btn =>
      btn.addEventListener('click', () => openPolizaForm(+btn.dataset.edit)));
    tbody.querySelectorAll('[data-del]').forEach(btn =>
      btn.addEventListener('click', () => {
        const id = +btn.dataset.del;
        const p = DB.read('poliza', { where: 'id_poliza = ?', params: [id] })[0];
        confirmDelete(`¿Eliminar la póliza "${p.numero_poliza}" (ID ${id})?`, () => {
          const siniestros = DB.scalar('SELECT COUNT(*) FROM siniestro WHERE id_poliza = ?', [id]);
          if (siniestros > 0) {
            toast(`No se puede eliminar: la póliza tiene ${siniestros} siniestro(s) registrados.`, 'error');
            return;
          }
          db_deleteHijos(id);
          DB.delete('poliza', id);
          toast('Póliza eliminada.');
          renderPolizas();
          renderDashboard();
        });
      }));
  }

  function db_deleteHijos(idPoliza) {
    // borra pagos y detalle de coberturas huérfanos de la póliza
    const pagos = DB.read('pago', { where: 'id_poliza = ?', params: [idPoliza] });
    pagos.forEach(p => DB.delete('pago', p.id_pago));
    const dets = DB.read('detalle_poliza_cobertura', { where: 'id_poliza = ?', params: [idPoliza] });
    dets.forEach(d => DB.delete('detalle_poliza_cobertura', d.id_detalle));
  }

  function openPolizaForm(id = null) {
    $('#form-poliza').reset();
    $('#poliza-id').value = '';
    $('#modal-poliza-title').textContent = id ? `Editar Póliza #${id}` : 'Nueva Póliza';
    $('#poliza-cliente-preview').hidden = true;
    if (id) {
      const p = DB.read('poliza', { where: 'id_poliza = ?', params: [id] })[0];
      if (!p) return;
      $('#poliza-id').value = p.id_poliza;
      $('#poliza-numero').value = p.numero_poliza;
      $('#poliza-cliente').value = p.id_cliente;
      $('#poliza-inicio').value = p.fecha_inicio;
      $('#poliza-fin').value = p.fecha_fin;
      $('#poliza-estado').value = p.estado;
      showClientePreview($('#poliza-cliente-preview'), p.id_cliente);
    }
    openModal('modal-poliza');
  }

  function showClientePreview(box, idCliente) {
    if (!idCliente) { box.hidden = true; return; }
    const c = DB.read('cliente', { where: 'id_cliente = ?', params: [idCliente] })[0];
    if (!c) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = `<strong>Cliente:</strong> ${esc(c.nombre)} ${esc(c.apellido)} ·
      DNI ${esc(c.dni)} · ${esc(c.email || 'sin email')} · ${esc(c.telefono || 'sin teléfono')}`;
  }

  function initPolizas() {
    $('#btn-nueva-poliza').addEventListener('click', () => openPolizaForm());
    $('#filtro-cliente-poliza').addEventListener('change', () => {
      renderPolizas();
      const id = $('#filtro-cliente-poliza').value;
      const card = $('#cliente-seleccionado-card');
      if (id) {
        const c = DB.read('cliente', { where: 'id_cliente = ?', params: [+id] })[0];
        card.hidden = false;
        $('#cliente-seleccionado-datos').innerHTML = `
          <div><span>Nombre:</span> <strong>${esc(c.nombre)} ${esc(c.apellido)}</strong></div>
          <div><span>DNI:</span> <strong>${esc(c.dni)}</strong></div>
          <div><span>Email:</span> <strong>${esc(c.email || '-')}</strong></div>
          <div><span>Teléfono:</span> <strong>${esc(c.telefono || '-')}</strong></div>`;
      } else {
        card.hidden = true;
      }
    });
    $('#filtro-estado-poliza').addEventListener('change', renderPolizas);

    $('#poliza-cliente').addEventListener('change', e =>
      showClientePreview($('#poliza-cliente-preview'), e.target.value));

    $('#form-poliza').addEventListener('submit', e => {
      e.preventDefault();
      const data = {
        numero_poliza: $('#poliza-numero').value.trim(),
        id_cliente: +$('#poliza-cliente').value,
        fecha_inicio: $('#poliza-inicio').value,
        fecha_fin: $('#poliza-fin').value,
        estado: $('#poliza-estado').value
      };
      if (!data.numero_poliza || !data.id_cliente || !data.fecha_inicio || !data.fecha_fin) {
        toast('Complete los campos obligatorios.', 'error');
        return;
      }
      if (data.fecha_fin <= data.fecha_inicio) {
        toast('La fecha de vencimiento debe ser posterior a la de inicio.', 'error');
        return;
      }
      const id = $('#poliza-id').value;
      const dup = DB.read('poliza', {
        sql: 'SELECT id_poliza FROM poliza WHERE numero_poliza = ?' + (id ? ' AND id_poliza != ?' : ''),
        params: id ? [data.numero_poliza, +id] : [data.numero_poliza]
      });
      if (dup.length) {
        toast(`Ya existe una póliza con número ${data.numero_poliza}.`, 'error');
        return;
      }
      if (id) {
        DB.update('poliza', +id, data);
        toast('Póliza actualizada.');
      } else {
        DB.create('poliza', data);
        toast('Póliza creada.');
      }
      closeModal('modal-poliza');
      loadPolizaFiltros();
      renderPolizas();
      renderDashboard();
    });
  }

  /* ================== SINIESTROS (Fase 2) ================== */

  function loadSiniestroPolizas() {
    const sel = $('#siniestro-poliza');
    const polizas = DB.read('poliza', {
      join: 'JOIN cliente c ON c.id_cliente = poliza.id_cliente',
      columns: 'poliza.*, c.nombre, c.apellido, c.dni',
      orderBy: 'poliza.numero_poliza'
    });
    sel.innerHTML = '<option value="">Seleccione una póliza...</option>' +
      polizas.map(p =>
        `<option value="${p.id_poliza}">${esc(p.numero_poliza)} — ${esc(p.apellido)}, ${esc(p.nombre)} (${esc(p.dni)})</option>`
      ).join('');
  }

  function renderSiniestros() {
    loadSiniestroPolizas();
    const tbody = $('#tabla-siniestros tbody');
    const rows = DB.read('siniestro', {
      join: 'JOIN poliza p ON p.id_poliza = siniestro.id_poliza JOIN cliente c ON c.id_cliente = p.id_cliente',
      columns: 'siniestro.*, p.numero_poliza, c.nombre, c.apellido',
      orderBy: 'siniestro.fecha DESC, siniestro.id_siniestro DESC'
    });
    if (!rows.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="8">No hay siniestros registrados.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.id_siniestro}</td>
        <td>${formatFecha(r.fecha)}</td>
        <td>${esc(r.tipo)}</td>
        <td class="cell-wrap">${esc(r.descripcion || '-')}</td>
        <td>${badge(r.estado)}</td>
        <td>${esc(r.numero_poliza)}</td>
        <td>${esc(r.nombre)} ${esc(r.apellido)}</td>
        <td class="col-actions">
          <button class="btn-icon edit" title="Editar" data-edit="${r.id_siniestro}">✎</button>
          <button class="btn-icon del" title="Eliminar" data-del="${r.id_siniestro}">🗑</button>
        </td>
      </tr>`).join('');

    tbody.querySelectorAll('[data-edit]').forEach(btn =>
      btn.addEventListener('click', () => openSiniestroForm(+btn.dataset.edit)));
    tbody.querySelectorAll('[data-del]').forEach(btn =>
      btn.addEventListener('click', () => {
        const id = +btn.dataset.del;
        confirmDelete(`¿Eliminar el siniestro #${id}?`, () => {
          DB.delete('siniestro', id);
          toast('Siniestro eliminado.');
          renderSiniestros();
          renderDashboard();
        });
      }));
  }

  let editingSiniestroId = null;

  function openSiniestroForm(id = null) {
    editingSiniestroId = id;
    $('#siniestro-fecha').value = '';
    $('#siniestro-tipo').value = 'Médica';
    $('#siniestro-descripcion').value = '';
    $('#siniestro-estado').value = 'Abierto';
    $('#siniestro-form-fields').hidden = false;

    if (id) {
      const s = DB.read('siniestro', { where: 'id_siniestro = ?', params: [id] })[0];
      if (!s) return;
      $('#siniestro-poliza').value = s.id_poliza;
      $('#siniestro-fecha').value = s.fecha;
      $('#siniestro-tipo').value = s.tipo;
      $('#siniestro-descripcion').value = s.descripcion || '';
      $('#siniestro-estado').value = s.estado;
      updateSiniestroPolizaInfo();
      toast(`Editando siniestro #${id}`, 'success');
      $('#view-siniestros').scrollIntoView({ behavior: 'smooth' });
      return;
    }
    $('#siniestro-poliza').value = '';
    $('#siniestro-poliza-info').hidden = true;
  }

  function updateSiniestroPolizaInfo() {
    const idPoliza = $('#siniestro-poliza').value;
    const box = $('#siniestro-poliza-info');
    if (!idPoliza) {
      box.hidden = true;
      $('#siniestro-form-fields').hidden = true;
      return;
    }
    const p = DB.read('poliza', {
      join: 'JOIN cliente c ON c.id_cliente = poliza.id_cliente',
      columns: 'poliza.*, c.nombre, c.apellido, c.dni, c.email, c.telefono',
      where: 'poliza.id_poliza = ?',
      params: [+idPoliza]
    })[0];
    box.hidden = false;
    $('#siniestro-form-fields').hidden = false;
    box.innerHTML = `<strong>Póliza:</strong> ${esc(p.numero_poliza)} (${esc(p.estado)}) ·
      <strong>Cliente:</strong> ${esc(p.nombre)} ${esc(p.apellido)} · DNI ${esc(p.dni)} ·
      ${esc(p.email || 'sin email')} · ${esc(p.telefono || 'sin teléfono')}`;
  }

  function initSiniestros() {
    $('#siniestro-poliza').addEventListener('change', () => {
      editingSiniestroId = null;
      updateSiniestroPolizaInfo();
    });
    $('#btn-nuevo-siniestro').addEventListener('click', () => {
      openSiniestroForm();
      $('#siniestro-poliza').focus();
    });

    $('#btn-guardar-siniestro').addEventListener('click', () => {
      const data = {
        id_poliza: +$('#siniestro-poliza').value,
        fecha: $('#siniestro-fecha').value,
        tipo: $('#siniestro-tipo').value,
        descripcion: $('#siniestro-descripcion').value.trim(),
        estado: $('#siniestro-estado').value
      };
      if (!data.id_poliza || !data.fecha || !data.tipo || !data.estado) {
        toast('Seleccione una póliza y complete fecha, tipo y estado.', 'error');
        return;
      }
      const poliza = DB.read('poliza', { where: 'id_poliza = ?', params: [data.id_poliza] })[0];
      if (!poliza) {
        toast('La póliza seleccionada no existe.', 'error');
        return;
      }
      if (editingSiniestroId) {
        DB.update('siniestro', editingSiniestroId, data);
        toast('Siniestro actualizado.');
        editingSiniestroId = null;
      } else {
        DB.create('siniestro', data);
        toast('Siniestro registrado.');
      }
      $('#siniestro-poliza').value = '';
      $('#siniestro-form-fields').hidden = true;
      $('#siniestro-poliza-info').hidden = true;
      renderSiniestros();
      renderDashboard();
    });
  }

  /* ================== init ================== */

  async function main() {
    initNav();
    initClientes();
    initPolizas();
    initSiniestros();

    const status = $('#db-status');
    try {
      const { source } = await DB.init();
      const labels = {
        archivo: 'seguros.db cargado (archivo original)',
        local: 'seguros.db restaurado (copia local de cambios)',
        servidor: 'seguros.db sincronizado con el servidor'
      };
      status.textContent = labels[source] || 'Conectado';
      status.classList.add('ok');
      renderDashboard();
      renderClientes();
      loadPolizaFiltros();
      renderPolizas();
      renderSiniestros();
    } catch (err) {
      console.error(err);
      status.textContent = 'Error de conexión';
      status.classList.add('error');
      toast(`Error al inicializar: ${err.message}`, 'error');
    }

    $('#btn-refresh-dashboard').addEventListener('click', () => {
      renderDashboard();
      toast('Dashboard actualizado.');
    });
  }

  document.addEventListener('DOMContentLoaded', main);
})();
