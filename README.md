### 1. Arquitectura y Tecnologías

*   **Base de Datos:** SQLite (`seguros.db`)
*   **Lógica del Cliente (JS):** JavaScript puro o un framework ligero (ej. Vanilla JS) para la manipulación de la base de datos.
*   **Interfaz de Usuario (UI):** HTML, CSS (para el diseño y la navegación).

### 2. Fase 1: Configuración del Entorno y Acceso a Datos (Data Access Layer - DAL)

El paso más crítico es establecer cómo JavaScript se comunicará con SQLite. Necesitarás una librería o API que permita ejecutar consultas SQL directamente en el contexto del navegador.

**Tareas Clave:**

1.  **Configuración del Proyecto:** Crear la estructura básica de archivos (`index.html`, CSS, `script.js`).
2.  **Librería de Acceso a SQLite (JS):** Investigar e integrar una librería JavaScript que permita leer y escribir en archivos SQLite desde el navegador (Ejemplos: `sql.js` o implementaciones basadas en IndexedDB si se opta por un almacenamiento más nativo del navegador).
3.  **Funciones CRUD Base:** Desarrollar funciones de JavaScript para ejecutar las operaciones básicas de la base de datos:
    *   `read(tableName, query)` (SELECT)
    *   `create(tableName, data)` (INSERT)
    *   `update(tableName, id, data)` (UPDATE)
    *   `delete(tableName, id)` (DELETE / UPDATE con estado)

### 3. Fase 2: Implementación de las Vistas y Navegación (UI Structure)

Se construye la estructura visual del menú y las vistas requeridas.

**Tareas Clave:**

1.  **Menú Principal:** Crear la barra de navegación con las cuatro pestañas:
    *   INICIO / DASHBOARD
    *   CLIENTES
    *   PÓLIZAS
    *   SINIESTROS
2.  **Módulo Clientes (CRUD):**
    *   Diseñar la vista para **Consultar** clientes y mostrar una tabla con la opción de **Buscar**.
    *   Crear el formulario para **Crear/Editar** clientes, asegurando que los datos se inserten correctamente en `CLIENTE`.
3.  **Módulo Pólizas:**
    *   Diseñar la vista para listar todas las pólizas.
    *   Implementar una funcionalidad para seleccionar un cliente existente (usando las relaciones definidas en el DER) y mostrar sus datos asociados (`numero_poliza`, `cliente`, `fecha_inicio`, `vencimiento`, `estado`).
4.  **Módulo Siniestros:**
    *   Crear la vista donde el usuario puede **seleccionar una póliza existente** para registrar un siniestro.
    *   Implementar el formulario para capturar los datos mínimos del siniestro (`Póliza`, `Fecha`, `Tipo`, `Descripción`, `Estado`) y almacenarlo en la tabla `SINIESTRO`.

### 4. Fase 3: Implementación de Indicadores y Gráficos (Dashboard)

Esta fase se enfoca en la explotación de los datos para generar información visual, consultando directamente el archivo `seguros.db` a través de las funciones de lectura desarrolladas en la Fase 1.

**Tareas Clave:**

#### A. Indicadores del Dashboard (Consultas SQL):
Implementar las siguientes consultas y mostrar los resultados:

1.  **Cantidad de clientes:** `SELECT COUNT(id_cliente) FROM CLIENTE;`
2.  **Cantidad de pólizas activas:** `SELECT COUNT(id_poliza) FROM POLIZA WHERE estado = 'Activa';`
3.  **Cantidad de siniestros abiertos:** `SELECT COUNT(id_siniestro) FROM SINIESTRO WHERE estado = 'Abierto';`
4.  **Cantidad de siniestros cerrados:** `SELECT COUNT(id_siniestro) FROM SINIESTRO WHERE estado = 'Cerrado';`

#### B. Gráficos (Visualización):
Utilizar una librería de gráficos (ej. Chart.js o D3.js) para dibujar los siguientes gráficos, alimentándolos con las consultas SQL:

1.  **Pólizas por estado:** Consulta agrupando `POLIZA` por el campo `estado`.
2.  **Siniestros por tipo:** Consulta agrupando `SINIESTRO` por el campo `tipo`.
3.  **Siniestros por mes:** Consulta que agrupe los siniestros por la fecha de ocurrencia (`fecha`) y calcule la cantidad total por mes.

### Resumen del Flujo de Trabajo (Checklist)

| Módulo | Requisitos Cumplidos | Acciones en el Plan |
| :--- | :--- | :--- |
| **Estructura** | Menú completo. | Fase 2 |
| **Clientes** | CRUD completo + Formulario. | Fase 2 (Módulo Clientes) |
| **Pólizas** | Mostrar datos del cliente seleccionado. | Fase 2 (Módulo Pólizas) |
| **Siniestros**| Registro ligado a una póliza existente. | Fase 2 (Módulo Siniestros) |
| **Dashboard**| Cuatro indicadores clave, no escritos manualmente. | Fase 3 (Indicadores) |
| **Gráficos** | 3 gráficos alimentados por consultas SQL. | Fase 3 (Gráficos) |
