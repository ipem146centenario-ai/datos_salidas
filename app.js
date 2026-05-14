const URL =
  "https://script.google.com/macros/s/AKfycbxbAEu9d9joaeUItVH_T0mI_iK7AL2QK8xEGgVGfvu5zdAT6S4EbesydZSk0MXNmfb05g/exec";

// ===============================
// VARIABLES GLOBALES
// ===============================

let alumnos = [];
let docentes = [];
let salidas = [];
let historial = [];

let usuarioActivo = null;

let timers = {};

let procesando = false;

// ===============================
// INICIALIZACIÓN
// ===============================

window.addEventListener("load", () => {

  // TEMA
  if (localStorage.getItem("modoTema") === "claro") {

    document.body.classList.add("light-mode");

    const btnTheme = document.getElementById("themeToggle");

    if (btnTheme) {
      btnTheme.innerHTML = "☀️";
    }
  }

  cargarDatos();
});

// ===============================
// CARGA DE DATOS
// ===============================

async function cargarDatos() {

  try {

    const loader = document.getElementById("loader");

    if (loader) {
      loader.style.display = "block";
    }

    const response = await fetch(URL);

    if (!response.ok) {
      throw new Error("Error de conexión");
    }

    const data = await response.json();

    alumnos = data.alumnos || [];
    docentes = data.docentes || [];
    salidas = data.salidas || [];
    historial = data.historial || [];

    cargarDocentes();

    cargarFiltros();

    render();

    if (loader) {
      loader.style.display = "none";
    }

    showToast("✅ Datos cargados");

  } catch (error) {

    console.error(error);

    const loader = document.getElementById("loader");

    if (loader) {

      loader.innerHTML = `
        <div style="
          color:red;
          text-align:center;
          padding:20px;
          font-size:18px;
        ">
          ❌ Error de conexión
        </div>
      `;
    }

    showToast("❌ No se pudieron cargar datos", "error");
  }
}

// ===============================
// LOGIN
// ===============================

async function verificarAcceso() {

  if (procesando) return;

  procesando = true;

  const btn = document.getElementById("btnLogin");

  if (btn) {

    btn.disabled = true;

    btn.classList.add("loading");
  }

  const nombre = document.getElementById("docentes").value;

  const pin = document.getElementById("passDocente").value;

  const user = docentes.find(
    (d) =>
      d.nombre === nombre &&
      String(d.password) === String(pin)
  );

  await new Promise((resolve) => setTimeout(resolve, 600));

  if (user) {

    usuarioActivo = user;

    showToast("✅ Bienvenido/a");

    const grupoSesion = document.querySelector(".grupo-sesion");

    if (grupoSesion) {
      grupoSesion.style.display = "none";
    }

    [
      "logoutBtn",
      "seccion-filtros",
      "contador-container",
      "buscador-box",
      "historial-container"
    ].forEach((id) => {

      const el = document.getElementById(id);

      if (el) {
        el.style.display = "block";
      }
    });

    render();

  } else {

    const input = document.getElementById("passDocente");

    if (input) {

      input.classList.add("shake");

      setTimeout(() => {
        input.classList.remove("shake");
      }, 500);
    }

    showToast("❌ PIN incorrecto", "error");
  }

  if (btn) {

    btn.disabled = false;

    btn.classList.remove("loading");
  }

  procesando = false;
}

// ===============================
// RENDER
// ===============================

function render() {

  const grid = document.getElementById("grid");

  if (!grid) return;

  const curso = document.getElementById("fCurso")?.value || "";

  const busqueda =
    document.getElementById("buscador")?.value.toLowerCase() || "";

  if (!curso) {

    grid.innerHTML = `
      <div class="panel" style="
        text-align:center;
        color:var(--muted);
        padding:30px;
      ">
        📚 Seleccione un curso
      </div>
    `;

    return;
  }

  const filtrados = alumnos.filter((a) => {

    const coincideCurso = a.curso == curso;

    const coincideBusqueda =
      a.nombre.toLowerCase().includes(busqueda) ||
      String(a.dni).includes(busqueda);

    return coincideCurso && coincideBusqueda;
  });

  actualizarContadores(filtrados);

  grid.innerHTML = "";

  const fragment = document.createDocumentFragment();

  filtrados.forEach((a) => {

    const registro = salidas.find(
      (s) =>
        s.dni == a.dni &&
        !s.regreso
    );

    const esAusente = a.ausente === "AUSENTE";

    const div = document.createElement("div");

    div.id = `card-${a.dni}`;

    div.className = `
      alumno
      ${esAusente ? "ausente" : ""}
      ${registro ? "out" : "in"}
    `;

    let html = `
      <span class="nombre">
        ${a.nombre}
      </span>
    `;

    // =====================
    // AUSENTE
    // =====================

    if (esAusente) {

      html += `
        <div class="label-ausente">
          ❌ AUSENTE
        </div>
      `;
    }

    // =====================
    // AFUERA
    // =====================

    else if (registro) {

      html += `
        <div class="motivo-destacado">
          🚪 ${registro.causa.toUpperCase()}
        </div>
      `;

      if (
        registro.causa &&
        registro.causa.toLowerCase() === "baño"
      ) {

        html += `
          <div class="timer-box">
            ⏳
            <span id="timer-${a.dni}">
              15:00
            </span>
          </div>
        `;

        iniciarCronometro(
          a.dni,
          registro.inicioTime || new Date()
        );
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

    div.innerHTML = html;

    if (!esAusente) {

      div.onclick = () =>
        procesarAccion(a, registro, div);
    }

    fragment.appendChild(div);
  });

  grid.appendChild(fragment);
}

// ===============================
// PROCESAR ACCIÓN
// ===============================

async function procesarAccion(alumno, registro, elemento) {

  if (procesando) return;

  const causa = document.getElementById("causa")?.value || "";

  if (!registro && !causa) {

    showToast("📍 Selecciona un destino", "error");

    return;
  }

  procesando = true;

  elemento.classList.add("bloqueado");
  elemento.classList.add("loading");

  elemento.style.pointerEvents = "none";

  const data = {

    dni: alumno.dni,

    nombre: alumno.nombre,

    docente: usuarioActivo.nombre,

    tipo: registro ? "regreso" : "salida",

    causa: registro ? "" : causa,

    tipoAccion: "movimiento"
  };

  try {

    const response = await fetch(URL, {

      method: "POST",

      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error("Error al guardar");
    }

    elemento.classList.add("success");

    // =========================
    // REGRESO
    // =========================

    if (registro) {

      clearInterval(timers[alumno.dni]);

      delete timers[alumno.dni];

      salidas = salidas.filter(
        (s) => s.dni != alumno.dni
      );

      showToast("✅ Regreso registrado");
    }

    // =========================
    // SALIDA
    // =========================

    else {

      salidas.push({

        dni: alumno.dni,

        causa,

        inicioTime: new Date()
      });

      showToast("🚪 Salida registrada");
    }

    setTimeout(() => {
      render();
    }, 400);

  } catch (error) {

    console.error(error);

    showToast("❌ Error al guardar", "error");

  } finally {

    setTimeout(() => {

      procesando = false;

      elemento.classList.remove("bloqueado");
      elemento.classList.remove("loading");

      elemento.style.pointerEvents = "auto";

    }, 700);
  }
}

// ===============================
// CRONÓMETRO
// ===============================

function iniciarCronometro(dni, inicio) {

  // EVITA DUPLICADOS
  if (timers[dni]) {

    clearInterval(timers[dni]);
  }

  const LIMITE = 15 * 60;

  timers[dni] = setInterval(() => {

    const ahora = Date.now();

    const inicioMs = new Date(inicio).getTime();

    const transcurrido =
      Math.floor((ahora - inicioMs) / 1000);

    const restante = LIMITE - transcurrido;

    const display =
      document.getElementById(`timer-${dni}`);

    const card =
      document.getElementById(`card-${dni}`);

    // SI LA CARD YA NO EXISTE
    if (!display || !card) {

      clearInterval(timers[dni]);

      delete timers[dni];

      return;
    }

    // =====================
    // TIEMPO AGOTADO
    // =====================

    if (restante <= 0) {

      display.innerText = "⛔ TIEMPO";

      card.classList.add("tiempo-agotado");

      if (!card.dataset.alertado) {

        if (navigator.vibrate) {

          navigator.vibrate([
            300,
            100,
            300
          ]);
        }

        showToast(
          "⏰ Tiempo agotado",
          "error"
        );

        card.dataset.alertado = "1";
      }

      return;
    }

    const minutos =
      Math.floor(restante / 60);

    const segundos =
      restante % 60;

    display.innerText =
      `${minutos}:${segundos < 10 ? "0" : ""}${segundos}`;

  }, 1000);
}

// ===============================
// CONTADORES
// ===============================

function actualizarContadores(filtrados) {

  const total = filtrados.length;

  const ausentes = filtrados.filter(
    (a) => a.ausente === "AUSENTE"
  ).length;

  const afuera = filtrados.filter(
    (a) =>
      salidas.find((s) => s.dni == a.dni)
  ).length;

  const enAula =
    total - ausentes - afuera;

  document.getElementById("total-alumnos").innerText = total;

  document.getElementById("en-aula").innerText = enAula;

  document.getElementById("afuera").innerText = afuera;

  document.getElementById("ausentes").innerText = ausentes;
}

// ===============================
// DOCENTES
// ===============================

function cargarDocentes() {

  const select =
    document.getElementById("docentes");

  if (!select) return;

  select.innerHTML =
    `<option value="">DOCENTE</option>`;

  docentes.forEach((d) => {

    select.innerHTML += `
      <option value="${d.nombre}">
        ${d.nombre}
      </option>
    `;
  });
}

// ===============================
// FILTROS
// ===============================

function cargarFiltros() {

  [
    "fCurso",
    "fDivision",
    "fTurno",
    "fEspecialidad"
  ].forEach((id) => {

    const key =
      id.replace("f", "").toLowerCase();

    const select =
      document.getElementById(id);

    if (!select) return;

    select.innerHTML =
      `<option value="">
        ${key.toUpperCase()}
      </option>`;

    const valores = [
      ...new Set(
        alumnos.map((a) => a[key])
      )
    ];

    valores
      .sort()
      .forEach((v) => {

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

// ===============================
// TOAST
// ===============================

function showToast(
  mensaje,
  tipo = "success"
) {

  const container =
    document.getElementById("toast-container");

  if (!container) return;

  const toast =
    document.createElement("div");

  toast.className =
    `toast ${tipo === "error" ? "error" : ""}`;

  toast.innerText = mensaje;

  container.appendChild(toast);

  setTimeout(() => {

    toast.classList.add("hide");

    setTimeout(() => {
      toast.remove();
    }, 400);

  }, 2500);
}

// ===============================
// TEMA
// ===============================

function toggleTheme() {

  document.body.classList.toggle(
    "light-mode"
  );

  const esClaro =
    document.body.classList.contains(
      "light-mode"
    );

  localStorage.setItem(
    "modoTema",
    esClaro ? "claro" : "oscuro"
  );

  const btn =
    document.getElementById("themeToggle");

  if (btn) {

    btn.innerHTML =
      esClaro ? "☀️" : "🌙";
  }

  showToast(
    esClaro
      ? "☀️ Modo claro"
      : "🌙 Modo oscuro"
  );
}

// ===============================
// CERRAR SESIÓN
// ===============================

function cerrarSesion() {

  Object.keys(timers).forEach((key) => {

    clearInterval(timers[key]);
  });

  timers = {};

  usuarioActivo = null;

  showToast("👋 Sesión cerrada");

  setTimeout(() => {

    location.reload();

  }, 800);
}