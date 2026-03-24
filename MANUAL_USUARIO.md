# Manual de Usuario - Sistema de Arqueo Pro V2

Este manual describe el funcionamiento del sistema, los pasos para realizar las tareas diarias y las responsabilidades de cada rol dentro de la organización.

---

## 1. Roles y Responsabilidades

### A. Supervisor
El Supervisor es el encargado de la operación en el punto de venta. Sus responsabilidades incluyen:
*   **Registro de Arqueos:** Realizar el conteo físico de caja al finalizar cada turno y registrarlo en el sistema.
*   **Registro de Gastos:** Documentar cualquier salida de dinero de la caja chica, especificando el motivo y quién autorizó el gasto.
*   **Registro de Pagos Móviles:** Ingresar cada transacción de pago móvil recibida, asegurando que los datos de referencia y banco sean correctos.
*   **Gestión de Visitas:** Registrar las visitas a clientes, incluyendo la toma de fotografías y geolocalización para validación de ruta.

### B. Verificador de Pagos
El Verificador de Pagos tiene un rol de auditoría operativa:
*   **Validación de Transacciones:** Revisar los pagos móviles registrados por los supervisores y marcarlos como "Verificados" una vez confirmados en la cuenta bancaria.
*   **Control de Duplicados:** Asegurar que no existan referencias bancarias duplicadas en el sistema.

### C. Contabilidad
El personal de Contabilidad se encarga del análisis y consolidación de la información:
*   **Revisión de Historial:** Consultar el histórico de arqueos, gastos y pagos para conciliación bancaria.
*   **Exportación de Datos:** Descargar la información consolidada para su procesamiento en sistemas contables externos.
*   **Auditoría de Gastos:** Verificar que todos los gastos registrados estén debidamente soportados y autorizados.

---

## 2. Pasos para Operaciones Diarias

### Paso 1: Inicio de Sesión
Cada usuario debe ingresar con su correo electrónico y contraseña asignada. El sistema detectará automáticamente su rol y le mostrará las opciones correspondientes.

### Paso 2: Registro de Arqueo (Solo Supervisores)
1.  Seleccione su tienda asignada.
2.  Ingrese la tasa del BCV del día.
3.  Complete los campos de efectivo (Bolívares y Dólares).
4.  Registre los lotes de los puntos de venta (Venezuela, Banplus, Mercantil).
5.  Verifique que el total coincida con el reporte Z de la máquina fiscal.
6.  Presione "Registrar Arqueo".

### Paso 3: Registro de Gastos y Pagos Móviles
*   **Gastos:** Ingrese el monto, descripción y tipo de gasto. Si el gasto fue autorizado por un superior, indique su nombre.
*   **Pagos Móviles:** Ingrese el número de referencia exacto y el banco emisor. El sistema alertará si la referencia ya fue registrada previamente.

### Paso 4: Verificación (Solo Verificadores)
1.  Vaya a la sección de "Pagos Móvil".
2.  Compare la lista de pagos pendientes con el estado de cuenta bancario.
3.  Haga clic en el botón de verificación para cada pago confirmado.

---

## 3. Sistema de Contingencia (Modo Offline)

Si se encuentra en una zona con mala conexión a internet (especialmente durante visitas a clientes):
1.  El sistema intentará guardar la información en la nube automáticamente.
2.  Si la conexión falla, el sistema guardará un **archivo JSON temporal** en su dispositivo.
3.  Se le notificará que los datos están guardados localmente.
4.  Una vez que recupere la conexión, el sistema le permitirá reintentar la subida de los datos pendientes para asegurar que no se pierda ninguna información.

---

## 4. Soporte Técnico
Para cualquier duda o inconveniente con el sistema, por favor contacte al departamento de sistemas indicando su correo de usuario y la captura de pantalla del error si es posible.
