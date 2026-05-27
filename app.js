/* =========================================================
   app.js - SISTEMA COMPLETO IPEM 146
   VERSION PROFESIONAL + PRECEPTOR
========================================================= */

const URL =
  "https://script.google.com/macros/s/AKfycbwi-d8EEfxY1JLr0X8PE3kipPi4t0erjsDIuo-N8wOktoHELwmFdn1uABRWZiEW5eVc/exec";

/* =========================================================
   VARIABLES
========================================================= */

let alumnos = [];
let docentes = [];
let salidas = [];
let historial = [];

let usuarioActivo = null;

let timers = {};

let procesando = false;

/* =========================================================
   INIT
========================================================= */

window.addEventListener("load", () => {
  // TEMA
  if (localStorage.getItem("modoTema") === "claro") {
    document.body.classList.add("light-mode");

    const btn = document.getElementById("themeToggle");

    if (btn) btn.innerHTML = "☀️";
  }

  // SESIÓN
  const sesionGuardada = localStorage.getItem("sesionActiva");

  if (sesionGuardada) {
    usuarioActivo = JSON.parse(sesionGuardada);

    activarSistema();
  }

  cargarDatos();
});

/* =========================================================
   CARGAR DATOS
========================================================= */

async function cargarDatos() {
  try {
    const loader = document.getElementById("loader");

    loader.style.display = "flex";

    const response = await fetch(URL);

    if (!response.ok) {
      throw new Error("Error");
    }

    const data = await response.json();

    alumnos = data.alumnos || [];

    docentes = data.docentes || [];

    salidas = data.salidas || [];

    historial = data.historial || [];

    cargarDocentes();

    cargarFiltros();

    render();

    renderHistorial();

    loader.style.display = "none";
  } catch (error) {
    console.error(error);

    document.getElementById("loader").innerHTML = `
      <div style="
        color:red;
        font-size:20px;
        text-align:center;
      ">
        ❌ Error de conexión
      </div>
    `;
  }
}

/* =========================================================
   LOGIN
========================================================= */

async function verificarAcceso() {
  if (procesando) return;

  procesando = true;

  const btn = document.getElementById("btnLogin");

  btn.disabled = true;

  btn.classList.add("loading");

  const nombre = document.getElementById("docentes").value;

  const pin = document.getElementById("passDocente").value;

  const user = docentes.find(
    (d) => d.nombre === nombre && String(d.password) === String(pin),
  );

  await new Promise((r) => setTimeout(r, 600));

  if (user) {
    usuarioActivo = user;

    // Si el usuario se llama Pepe, asignarle rol Preceptor
    if (String(user.rol).toLowerCase() === "preceptor") {
      usuarioActivo.rol = "Preceptor";
    }

    localStorage.setItem("sesionActiva", JSON.stringify(usuarioActivo));

    activarSistema();

    showToast(`✅ Bienvenido ${user.nombre}`);
  } else {
    const input = document.getElementById("passDocente");

    input.classList.add("shake");

    setTimeout(() => {
      input.classList.remove("shake");
    }, 500);

    showToast("❌ PIN incorrecto", "error");
  }

  btn.disabled = false;

  btn.classList.remove("loading");

  procesando = false;
}

/* =========================================================
   ACTIVAR SISTEMA
========================================================= */

function activarSistema() {
  document.querySelector(".grupo-sesion").style.display = "none";

  [
    "logoutBtn",
    "seccion-filtros",
    "contador-container",
    "buscador-box",
    "historial-container",
    "changePassBtn",
  ].forEach((id) => {
    const el = document.getElementById(id);

    if (el) {
      el.style.display = "block";
    }
  });

  // Asegurar que la sección de filtros/destino esté visible
  const seccionFiltros = document.getElementById("seccion-filtros");

  if (seccionFiltros) {
    seccionFiltros.style.display = "block";
  }

  // Configurar opciones de destino según el rol
  if (usuarioActivo && usuarioActivo.rol === "Preceptor") {
    configurarCausasPreceptor();
  } else {
    configurarCausasDefault();
  }
  // ROL
  const rolBox = document.getElementById("rolActivo");

  if (rolBox) {
    rolBox.innerHTML = `👤 ${usuarioActivo.nombre}
       (${usuarioActivo.rol || "Docente"})`;
  }

  render();
}

/* =========================================================
   RENDER
========================================================= */

function render() {
  const grid = document.getElementById("grid");

  if (!grid) return;

  const curso = document.getElementById("fCurso").value;

  const busqueda = document.getElementById("buscador").value.toLowerCase();

  const filtrados = alumnos.filter((a) => {
    return (
      a.curso == curso &&
      (a.nombre.toLowerCase().includes(busqueda) ||
        String(a.dni).includes(busqueda))
    );
  });

  actualizarContadores(filtrados);

  grid.innerHTML = "";

  const fragment = document.createDocumentFragment();

  filtrados.forEach((a) => {
    const reg = salidas.find(
      (s) =>
        String(s.dni) === String(a.dni) &&
        (s.regreso === "" ||
          s.regreso === null ||
          typeof s.regreso === "undefined"),
    );

    const div = document.createElement("div");

    div.id = `card-${a.dni}`;

    // ESTADO
    let estado = "in";

    if (a.estado === "AUSENTE") {
      estado = "ausente";
    } else if (a.estado === "TARDE") {
      estado = "tarde";
    } else if (a.estado === "RETIRO") {
      estado = "retiro";
    } else if (reg) {
      estado = "out";
    }

    div.className = `alumno ${estado}`;

    let html = `
      <span class="nombre">
        ${a.nombre}
      </span>
    `;

    // =====================
    // AUSENTE
    // =====================

    if (a.estado === "AUSENTE") {
      html += `
        <div class="label-ausente">
          ❌ AUSENTE
        </div>
      `;
    }

    // =====================
    // TARDE
    // =====================
    else if (a.estado === "TARDE") {
      html += `
        <div class="motivo-destacado">
          ⏰ LLEGADA TARDE
        </div>
      `;
    }

    // =====================
    // RETIRADOS
    // =====================
    else if (a.estado === "RETIRO") {
      html += `
        <div class="estado-retiro">
          ✅ RETIRADO
        </div>
      `;
    }

    // =====================
    // AFUERA
    // =====================
    else if (reg) {
      html += `
        <div class="motivo-destacado">
          🚪 ${reg.causa.toUpperCase()}
        </div>
      `;

      if (reg.causa.toLowerCase() === "baño") {
        html += `
          <div class="timer-box">
            ⏳
            <span id="timer-${a.dni}">
              15:00
            </span>
          </div>
        `;

        iniciarCronometro(a.dni, reg.inicioTime);
      }
    }

    // =====================
    // EN AULA
    // =====================
    else {
      html += `
        <div class="estado-aula">
          ✅ EN AULA
        </div>
      `;
    }

    // =====================
    // BOTONES DE ACCIÓN
    // =====================

    if (usuarioActivo && usuarioActivo.rol === "Preceptor") {
      const bloqueadoHoy = esAccionPreceptorBloqueada(a);

      html += `
        <div class="acciones-preceptor">

          <button
            class="btn-mini rojo"
            onclick="marcarAusente('${a.dni}')"
            ${bloqueadoHoy ? "disabled" : ""}>

            AUS

          </button>

          <button
            class="btn-mini naranja"
            onclick="marcarTarde('${a.dni}')"
            ${bloqueadoHoy ? "disabled" : ""}>

            TARDE

          </button>

          <button
            class="btn-mini azul"
            onclick="retiroTutor('${a.dni}')"
            ${bloqueadoHoy ? "disabled" : ""}>

            RETIRO

          </button>

        </div>
      `;
    }

    div.innerHTML = html;

    // CLICK NORMAL (no permitir a Preceptor registrar salidas/regresos)
    if (
      a.estado !== "AUSENTE" &&
      !(usuarioActivo && usuarioActivo.rol === "Preceptor")
    ) {
      div.onclick = (e) => {
        if (e.target.tagName !== "BUTTON") {
          procesarAccion(a, reg, div);
        }
      };
    }

    fragment.appendChild(div);
  });

  grid.appendChild(fragment);
}

function obtenerFechaHoy() {
  return new Date().toISOString().slice(0, 10);
}

function esAccionPreceptorBloqueada(alumno) {
  if (!alumno) return false;

  const hoy = obtenerFechaHoy();

  if (
    alumno.ultimaAccionPreceptor === hoy ||
    ["AUSENTE", "TARDE", "RETIRO"].includes(alumno.estado)
  ) {
    return true;
  }

  return false;
}

/* =========================================================
   PROCESAR ACCIÓN
========================================================= */

async function procesarAccion(alumno, registro, elemento) {
  if (procesando) return;

  // Si el usuario es Preceptor, no puede registrar salidas/regresos
  // (solo puede usar las funciones de marcar falta, tarde o retiro).
  if (usuarioActivo && usuarioActivo.rol === "Preceptor") {
    // quitar estado de procesando si llegó desde UI
    if (elemento) elemento.classList.remove("loading");

    showToast(
      "❌ Acceso denegado: Preceptor solo puede marcar faltas/tardes/retiros",
      "error",
    );

    return;
  }

  const causa = document.getElementById("causa").value;

  if (!registro && !causa) {
    showToast("📍 Seleccione destino", "error");

    return;
  }

  procesando = true;

  elemento.classList.add("loading");

  const data = {
    dni: alumno.dni,

    nombre: alumno.nombre,

    docente: usuarioActivo.nombre,

    tipo: registro ? "regreso" : "salida",

    causa: registro ? "" : causa,

    tipoAccion: "movimiento",
  };

  try {
    await fetch(URL, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(data),
    });

    // HISTORIAL
    agregarHistorial(
      alumno.nombre,
      registro ? "REGRESO" : causa,
      usuarioActivo.nombre,
    );

    // REGRESO
    if (registro) {
      clearInterval(timers[alumno.dni]);

      delete timers[alumno.dni];

      salidas = salidas.filter((s) => s.dni != alumno.dni);

      showToast("✅ Regreso registrado");
    }

    // SALIDA
    else {
      salidas.push({
        dni: alumno.dni,

        causa,

        inicioTime: new Date(),
      });

      showToast("🚪 Salida registrada");
    }

    render();
  } catch (error) {
    console.error(error);

    showToast("❌ Error", "error");
  }

  procesando = false;
}

/* =========================================================
   PRECEPTOR
========================================================= */

function marcarAusente(dni) {
  const alumno = alumnos.find((a) => a.dni == dni);

  if (!alumno) return;

  if (procesando) return;

  procesando = true;

  alumno.estado = "AUSENTE";
  alumno.ultimaAccionPreceptor = obtenerFechaHoy();

  const data = {
    dni: alumno.dni,
    nombre: alumno.nombre,
    docente: usuarioActivo ? usuarioActivo.nombre : "",
    tipoAccion: "preceptor",
    accion: "AUSENTE",
  };

  fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
    .catch((e) => console.error(e))
    .finally(() => {
      agregarHistorial(
        alumno.nombre,
        "AUSENTE",
        usuarioActivo ? usuarioActivo.nombre : "",
      );

      render();

      showToast("❌ Ausente");

      procesando = false;
    });
}

function marcarTarde(dni) {
  const alumno = alumnos.find((a) => a.dni == dni);

  if (!alumno) return;

  if (procesando) return;

  procesando = true;

  alumno.estado = "TARDE";
  alumno.ultimaAccionPreceptor = obtenerFechaHoy();

  const data = {
    dni: alumno.dni,
    nombre: alumno.nombre,
    docente: usuarioActivo ? usuarioActivo.nombre : "",
    tipoAccion: "preceptor",
    accion: "LLEGADA TARDE",
  };

  fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
    .catch((e) => console.error(e))
    .finally(() => {
      agregarHistorial(
        alumno.nombre,
        "LLEGADA TARDE",
        usuarioActivo ? usuarioActivo.nombre : "",
      );

      render();

      showToast("⏰ Llegada tarde");

      procesando = false;
    });
}

function retiroTutor(dni) {
  const alumno = alumnos.find((a) => a.dni == dni);

  if (!alumno) return;

  if (procesando) return;

  procesando = true;

  alumno.estado = "RETIRO";
  alumno.ultimaAccionPreceptor = obtenerFechaHoy();

  const data = {
    dni: alumno.dni,
    nombre: alumno.nombre,
    docente: usuarioActivo ? usuarioActivo.nombre : "",
    tipoAccion: "preceptor",
    accion: "RETIRO PADRE/TUTOR",
  };

  fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
    .catch((e) => console.error(e))
    .finally(() => {
      agregarHistorial(
        alumno.nombre,
        "RETIRO PADRE/TUTOR",
        usuarioActivo ? usuarioActivo.nombre : "",
      );

      render();

      showToast("👨‍👩‍👦 Retiro");

      procesando = false;
    });
}

/* =========================================================
   HISTORIAL
========================================================= */

function agregarHistorial(alumno, accion, usuario) {
  historial.unshift({
    alumno,

    accion,

    usuario,

    hora: new Date().toLocaleTimeString(),
  });

  renderHistorial();
}

function renderHistorial() {
  const box = document.getElementById("historial");

  if (!box) return;

  box.innerHTML = "";

  historial.slice(0, 30).forEach((h) => {
    box.innerHTML += `
        <div class="historial-item">

          <strong>
            ${h.alumno}
          </strong>

          - ${h.accion}

          <br>

          👤 ${h.usuario}

          • 🕒 ${h.hora}

        </div>
      `;
  });
}

function exportHistorialPDF() {
  const items = historial.slice(0, 100);

  let html = `
    <html>
      <head>
        <title>Movimientos Recientes</title>
        <style>
          body { font-family: Arial, Helvetica, sans-serif; padding:20px; }
          h1 { text-align:center; }
          .item { margin-bottom:12px; border-bottom:1px solid #ddd; padding-bottom:8px }
          .meta { color:#555; font-size:13px }
        </style>
      </head>
      <body>
        <h1>📋 MOVIMIENTOS RECIENTES</h1>
  `;

  items.forEach((h) => {
    html += `
      <div class="item">
        <div><strong>${h.alumno}</strong> - ${h.accion}</div>
        <div class="meta">👤 ${h.usuario} • 🕒 ${h.hora}</div>
      </div>
    `;
  });

  html += `</body></html>`;

  const w = window.open("", "_blank");

  if (!w) {
    showToast("❌ No se pudo abrir ventana para imprimir", "error");
    return;
  }

  w.document.open();
  w.document.write(html);
  w.document.close();

  w.focus();
  w.print();
  // w.close(); // dejar que el usuario cierre
}

function limpiarHistorial() {
  historial = [];

  renderHistorial();

  showToast("🗑 Historial limpio");
}

/* =========================================================
   CAMBIAR CONTRASEÑA
========================================================= */

function cambiarPassword() {
  const actual = prompt("Contraseña actual");

  if (String(actual) !== String(usuarioActivo.password)) {
    showToast("❌ Contraseña incorrecta", "error");

    return;
  }

  const nueva = prompt("Nueva contraseña");

  if (!nueva || nueva.length < 4) {
    showToast("⚠ Mínimo 4 caracteres", "error");

    return;
  }

  usuarioActivo.password = nueva;

  localStorage.setItem("sesionActiva", JSON.stringify(usuarioActivo));

  showToast("🔐 Contraseña cambiada");
}

/* =========================================================
   CRONÓMETRO
========================================================= */

function iniciarCronometro(dni, inicio) {
  if (timers[dni]) {
    clearInterval(timers[dni]);
  }

  const LIMITE = 15 * 60;

  timers[dni] = setInterval(() => {
    const restante =
      LIMITE - Math.floor((Date.now() - new Date(inicio).getTime()) / 1000);

    const display = document.getElementById(`timer-${dni}`);

    const card = document.getElementById(`card-${dni}`);

    if (!display || !card) {
      clearInterval(timers[dni]);

      return;
    }

    if (restante <= 0) {
      display.innerText = "⛔ TIEMPO";

      card.classList.add("tiempo-agotado");

      return;
    }

    const m = Math.floor(restante / 60);

    const s = restante % 60;

    display.innerText = `${m}:${s < 10 ? "0" : ""}${s}`;
  }, 1000);
}

/* =========================================================
   CONTADORES
========================================================= */

function actualizarContadores(filtrados) {
  const total = filtrados.length;

  const ausentes = filtrados.filter((a) => a.estado === "AUSENTE").length;

  const afuera = filtrados.filter((a) =>
    salidas.find((s) => s.dni == a.dni),
  ).length;

  document.getElementById("total-alumnos").innerText = total;

  document.getElementById("en-aula").innerText = total - ausentes - afuera;

  document.getElementById("afuera").innerText = afuera;

  document.getElementById("ausentes").innerText = ausentes;
}

/* =========================================================
   DOCENTES
========================================================= */

function cargarDocentes() {
  const select = document.getElementById("docentes");

  // opción por defecto
  select.innerHTML = `<option value="">
      Seleccione Usuario...
    </option>`;

  // Agrupar por rol: Preceptores, Dirección, Docentes
  const grupos = {
    preceptor: [],
    direccion: [],
    docente: [],
  };

  docentes.forEach((d) => {
    const r = (d.rol || "docente").toString().toLowerCase();

    if (r.includes("preceptor")) grupos.preceptor.push(d);
    else if (r.includes("direc") || r.includes("direcci"))
      grupos.direccion.push(d);
    else grupos.docente.push(d);
  });

  const appendGroup = (label, items) => {
    if (!items || items.length === 0) return;
    // crear optgroup y añadir opciones
    const og = document.createElement("optgroup");
    og.label = label;
    items.forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d.nombre;
      opt.text = `${d.nombre} (${d.rol || "Docente"})`;
      og.appendChild(opt);
    });
    select.appendChild(og);
  };

  appendGroup("Preceptores", grupos.preceptor);
  appendGroup("Dirección", grupos.direccion);
  appendGroup("Docentes", grupos.docente);
}

/* =========================================================
   FILTROS
========================================================= */

function cargarFiltros() {
  ["fCurso", "fDivision", "fTurno", "fEspecialidad"].forEach((id) => {
    const key = id.replace("f", "").toLowerCase();

    const select = document.getElementById(id);

    select.innerHTML = `<option value="">
        ${key.toUpperCase()}
      </option>`;

    [...new Set(alumnos.map((a) => a[key]))].sort().forEach((v) => {
      if (v) {
        select.innerHTML += `
          <option value="${v}">
            ${v}
          </option>
        `;
      }
    });

    select.onchange = render;
  });
}

// Opciones específicas para Preceptor en el select 'causa'
function configurarCausasPreceptor() {
  const causa = document.getElementById("causa");

  if (!causa) return;

  // Limpiar y añadir opciones relevantes para Preceptor
  causa.innerHTML = `
    <option value="">-- ACCIÓN PRECEPTOR --</option>
    <option value="AUSENTE">❌ Marcar Ausente</option>
    <option value="TARDE">⏰ Marcar Llegada Tarde</option>
    <option value="RETIRO">👨‍👩‍👦 Retiro por Tutor</option>
  `;
}

function configurarCausasDefault() {
  const causa = document.getElementById("causa");

  if (!causa) return;

  causa.innerHTML = `
    <option value="">
      -- SELECCIONAR DESTINO --
    </option>
    <option value="Baño">
      🚻 Baño (Máx 15 min)
    </option>
    <option value="Dirección">
      🏫 Dirección
    </option>
    <option value="Preceptoría">
      📁 Preceptoría
    </option>
    <option value="Biblioteca">
      📚 Biblioteca
    </option>
  `;
}

/* =========================================================
   TOAST
========================================================= */

function showToast(mensaje, tipo = "success") {
  const container = document.getElementById("toast-container");

  const toast = document.createElement("div");

  toast.className = `toast ${tipo === "error" ? "error" : ""}`;

  toast.innerText = mensaje;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("hide");

    setTimeout(() => {
      toast.remove();
    }, 400);
  }, 2500);
}

/* =========================================================
   THEME
========================================================= */

function toggleTheme() {
  document.body.classList.toggle("light-mode");

  const claro = document.body.classList.contains("light-mode");

  localStorage.setItem("modoTema", claro ? "claro" : "oscuro");

  document.getElementById("themeToggle").innerHTML = claro ? "☀️" : "🌙";
}

/* =========================================================
   LOGOUT
========================================================= */

function cerrarSesion() {
  Object.keys(timers).forEach((k) => {
    clearInterval(timers[k]);
  });

  timers = {};

  usuarioActivo = null;

  localStorage.removeItem("sesionActiva");

  showToast("👋 Sesión cerrada");

  setTimeout(() => {
    location.reload();
  }, 700);
}
